import { v } from "convex/values"
import { query, mutation, internalMutation, internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import { createPaymentLink as createFlowPaymentLink, checkFlowOrderStatus } from "./lib/integrations/flow"

interface PaymentData {
  amount: number
  currency: string
  description: string
  status: string
  sessionId?: string
  guardianId?: string
  paymentLinkUrl?: string
  providerReference?: string
  paidAt?: number
  failedAt?: number
  failureReason?: string
}

export const createPaymentLink = mutation({
  args: {
    paymentId: v.id("entities"),
    returnUrl: v.string(),
  },
  returns: v.object({
    paymentLinkUrl: v.string(),
    flowOrderId: v.string(),
  }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const payment = await ctx.db.get(args.paymentId)
    if (!payment || payment.organizationId !== auth.organizationId) {
      throw new Error("Payment not found")
    }

    const paymentData = payment.data as PaymentData
    if (paymentData.status !== "pending" && paymentData.status !== "draft") {
      throw new Error("Payment is not in a valid state to generate a link")
    }

    let customerEmail = ""
    if (paymentData.guardianId) {
      const guardian = await ctx.db.get(paymentData.guardianId as Id<"entities">)
      if (guardian && guardian.data) {
        customerEmail = (guardian.data as { email?: string }).email || ""
      }
    }

    const result = await createFlowPaymentLink(ctx, {
      organizationId: auth.organizationId,
      environment: payment.environment,
      paymentId: args.paymentId,
      amount: paymentData.amount,
      currency: paymentData.currency || "CLP",
      description: paymentData.description || "Pago de clase",
      customerEmail,
      returnUrl: args.returnUrl,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment: payment.environment,
      entityId: args.paymentId,
      entityTypeSlug: "payment",
      eventType: "payment.link_created",
      schemaVersion: 1,
      actorId: auth.userId as unknown as string,
      actorType: auth.actorType,
      payload: {
        paymentLinkUrl: result.paymentLinkUrl,
        flowOrderId: result.flowOrderId,
      },
      timestamp: Date.now(),
    })

    return result
  },
})

export const markAsPaid = internalMutation({
  args: {
    providerReference: v.string(),
    paidAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("entities")
      .withIndex("by_provider_reference", (q) =>
        q.eq("providerReference", args.providerReference)
      )
      .first()

    if (!payment) {
      console.warn("Payment not found:", args.providerReference)
      return null
    }

    const paymentData = payment.data as PaymentData
    if (paymentData.status === "paid") {
      return null
    }

    const now = Date.now()
    await ctx.db.patch(payment._id, {
      data: {
        ...paymentData,
        status: "paid",
        paidAt: args.paidAt,
      },
      status: "paid",
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: payment.organizationId,
      environment: payment.environment,
      entityId: payment._id,
      entityTypeSlug: "payment",
      eventType: "payment.paid",
      schemaVersion: 1,
      actorId: "system",
      actorType: "webhook",
      payload: {
        providerReference: args.providerReference,
        paidAt: args.paidAt,
      },
      timestamp: now,
    })

    if (paymentData.sessionId) {
      const session = await ctx.db.get(paymentData.sessionId as Id<"entities">)
      if (session && !session.deletedAt) {
        const sessionData = session.data as { status: string }
        if (sessionData.status === "pending_payment") {
          await ctx.db.patch(paymentData.sessionId as Id<"entities">, {
            data: {
              ...session.data,
              status: "scheduled",
              paymentId: payment._id.toString(),
            },
            status: "scheduled",
            updatedAt: now,
          })

          await ctx.db.insert("events", {
            organizationId: payment.organizationId,
            environment: payment.environment,
            entityId: paymentData.sessionId as Id<"entities">,
            entityTypeSlug: "session",
            eventType: "session.confirmed",
            schemaVersion: 1,
            actorId: "system",
            actorType: "webhook",
            payload: { paymentId: payment._id },
            timestamp: now,
          })
        }
      }
    }

    return null
  },
})

export const markAsFailed = internalMutation({
  args: {
    providerReference: v.string(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("entities")
      .withIndex("by_provider_reference", (q) =>
        q.eq("providerReference", args.providerReference)
      )
      .first()

    if (!payment) {
      console.warn("Payment not found:", args.providerReference)
      return null
    }

    const paymentData = payment.data as PaymentData
    if (paymentData.status === "paid" || paymentData.status === "failed") {
      return null
    }

    const now = Date.now()
    await ctx.db.patch(payment._id, {
      data: {
        ...paymentData,
        status: "failed",
        failedAt: now,
        failureReason: args.reason,
      },
      status: "failed",
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: payment.organizationId,
      environment: payment.environment,
      entityId: payment._id,
      entityTypeSlug: "payment",
      eventType: "payment.failed",
      schemaVersion: 1,
      actorId: "system",
      actorType: "webhook",
      payload: {
        providerReference: args.providerReference,
        reason: args.reason,
      },
      timestamp: now,
    })

    return null
  },
})

export const reconcilePayments = internalMutation({
  args: {},
  returns: v.object({ reconciled: v.number() }),
  handler: async (ctx) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    const paymentTypes = await ctx.db
      .query("entityTypes")
      .withIndex("by_slug", (q) => q.eq("slug", "payment"))
      .collect()

    if (paymentTypes.length === 0) {
      return { reconciled: 0 }
    }

    const pendingPayments: Array<{
      _id: Id<"entities">
      organizationId: Id<"organizations">
      environment: "development" | "production"
      data: PaymentData
      createdAt: number
    }> = []

    for (const paymentType of paymentTypes) {
      const payments = await ctx.db
        .query("entities")
        .withIndex("by_org_type", (q) =>
          q.eq("organizationId", paymentType.organizationId).eq("entityTypeId", paymentType._id)
        )
        .collect()

      for (const payment of payments) {
        const paymentData = payment.data as PaymentData
        if (
          paymentData.status === "pending" &&
          paymentData.providerReference &&
          payment.createdAt < oneHourAgo
        ) {
          pendingPayments.push({
            _id: payment._id,
            organizationId: payment.organizationId,
            environment: payment.environment,
            data: paymentData,
            createdAt: payment.createdAt,
          })
        }
      }
    }

    let reconciled = 0

    for (const payment of pendingPayments) {
      try {
        const flowStatus = await checkFlowOrderStatus(
          ctx,
          payment.organizationId,
          payment.environment,
          payment.data.providerReference!
        )

        if (flowStatus.status === "2") {
          await ctx.db.patch(payment._id, {
            data: {
              ...payment.data,
              status: "paid",
              paidAt: Date.now(),
            },
            status: "paid",
            updatedAt: Date.now(),
          })

          if (payment.data.sessionId) {
            const session = await ctx.db.get(payment.data.sessionId as Id<"entities">)
            if (session && !session.deletedAt) {
              const sessionData = session.data as { status: string }
              if (sessionData.status === "pending_payment") {
                await ctx.db.patch(payment.data.sessionId as Id<"entities">, {
                  data: {
                    ...session.data,
                    status: "scheduled",
                  },
                  status: "scheduled",
                  updatedAt: Date.now(),
                })
              }
            }
          }

          reconciled++
        } else if (flowStatus.status === "3" || flowStatus.status === "4") {
          await ctx.db.patch(payment._id, {
            data: {
              ...payment.data,
              status: "failed",
              failedAt: Date.now(),
              failureReason: flowStatus.statusMessage,
            },
            status: "failed",
            updatedAt: Date.now(),
          })
        }
      } catch (error) {
        console.error("Reconciliation error for payment:", payment._id, error)
      }
    }

    return { reconciled }
  },
})

export const getPayment = query({
  args: {
    paymentId: v.id("entities"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const payment = await ctx.db.get(args.paymentId)
    if (!payment || payment.organizationId !== auth.organizationId) {
      return null
    }

    return payment
  },
})

export const listPayments = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const paymentType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", "payment")
      )
      .first()

    if (!paymentType) {
      return []
    }

    let payments = await ctx.db
      .query("entities")
      .withIndex("by_org_type", (q) =>
        q.eq("organizationId", auth.organizationId).eq("entityTypeId", paymentType._id)
      )
      .order("desc")
      .take(args.limit ?? 50)

    if (args.status) {
      payments = payments.filter((p) => (p.data as PaymentData).status === args.status)
    }

    return payments
  },
})

export const createPayment = mutation({
  args: {
    amount: v.number(),
    currency: v.string(),
    description: v.string(),
    sessionId: v.optional(v.string()),
    guardianId: v.optional(v.string()),
    environment: v.union(v.literal("development"), v.literal("production")),
  },
  returns: v.id("entities"),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const paymentType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", "payment")
      )
      .first()

    if (!paymentType) {
      throw new Error("Payment entity type not found. Please install the tutoring pack first.")
    }

    const now = Date.now()
    const paymentData: PaymentData = {
      amount: args.amount,
      currency: args.currency,
      description: args.description,
      status: "draft",
      sessionId: args.sessionId,
      guardianId: args.guardianId,
    }

    const paymentId = await ctx.db.insert("entities", {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityTypeId: paymentType._id,
      status: "draft",
      data: paymentData,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityId: paymentId,
      entityTypeSlug: "payment",
      eventType: "payment.created",
      schemaVersion: 1,
      actorId: auth.userId as unknown as string,
      actorType: auth.actorType,
      payload: paymentData,
      timestamp: now,
    })

    return paymentId
  },
})

export const verifyPaymentFromWebhook = internalAction({
  args: {
    token: v.string(),
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    flowOrder: v.number(),
    status: v.string(),
    statusMessage: v.string(),
    amount: v.number(),
    currency: v.string(),
    payer: v.string(),
  }),
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(internal.integrations.getConfigInternal, {
      organizationId: args.organizationId,
      environment: "production",
      provider: "flow",
    })

    if (!config || config.status !== "active") {
      throw new Error("Flow integration not configured")
    }

    const flowConfig = config.config as {
      apiUrl: string
      apiKey: string
      secretKey: string
    }

    const { signFlowRequest } = await import("./lib/integrations/flow")

    const params: Record<string, unknown> = {
      apiKey: flowConfig.apiKey,
      token: args.token,
    }
    const signature = signFlowRequest(params, flowConfig.secretKey)

    const formData = new URLSearchParams()
    formData.append("apiKey", flowConfig.apiKey)
    formData.append("token", args.token)
    formData.append("s", signature)

    const response = await fetch(`${flowConfig.apiUrl}/payment/getStatus`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(`Flow API error: ${await response.text()}`)
    }

    return await response.json()
  },
})
