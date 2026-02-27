import { v } from "convex/values"
import { query, action, internalMutation, internalAction, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import {
  FlowConfig,
  createFlowPaymentLinkAction,
  checkFlowOrderStatusAction,
} from "./lib/integrations/flow"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

interface PaymentData {
  amount: number
  currency: string
  description: string
  status: string
  paymentLinkUrl?: string
  providerReference?: string
  customerEmail?: string
  paidAt?: number
  failedAt?: number
  failureReason?: string
}

export const createPaymentLink = action({
  args: {
    paymentId: v.id("entities"),
    returnUrl: v.optional(v.string()),
  },
  returns: v.object({
    paymentLinkUrl: v.string(),
    flowOrderId: v.string(),
  }),
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo)
    if (!auth) throw new Error("Not authenticated")

    const payment = await ctx.runQuery(internal.payments.getPaymentInternal, {
      paymentId: args.paymentId,
      organizationId: auth.organizationId,
    })

    if (!payment) throw new Error("Payment not found")

    const paymentData = payment.data as PaymentData
    if (paymentData.status !== "pending" && paymentData.status !== "draft") {
      throw new Error("Payment is not in a valid state to generate a link")
    }

    const config = await ctx.runQuery(internal.integrations.getConfigInternal, {
      organizationId: auth.organizationId,
      environment: payment.environment,
      provider: "flow",
    })

    if (!config || config.status !== "active") {
      throw new Error("Flow integration not configured or inactive")
    }

    const flowConfig = config.config as FlowConfig
    const returnUrl = args.returnUrl || flowConfig.returnUrl || ""

    const result = await createFlowPaymentLinkAction(flowConfig, {
      paymentId: args.paymentId.toString(),
      amount: paymentData.amount,
      currency: paymentData.currency || flowConfig.defaultCurrency || "CLP",
      description: paymentData.description || "Payment",
      customerEmail: paymentData.customerEmail || "",
      returnUrl,
    })

    await ctx.runMutation(internal.payments.storePaymentLink, {
      paymentId: args.paymentId,
      paymentLinkUrl: result.url,
      providerReference: result.flowOrder,
    })

    await ctx.runMutation(internal.payments.emitPaymentEvent, {
      organizationId: auth.organizationId,
      environment: payment.environment,
      entityId: args.paymentId,
      eventType: "payment.link_created",
      actorId: auth.userId as unknown as string,
      actorType: auth.actorType,
      payload: {
        paymentLinkUrl: result.url,
        flowOrderId: result.flowOrder,
      },
    })

    return {
      paymentLinkUrl: result.url,
      flowOrderId: result.flowOrder,
    }
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

export const storePaymentLink = internalMutation({
  args: {
    paymentId: v.id("entities"),
    paymentLinkUrl: v.string(),
    providerReference: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment) return null

    const paymentData = payment.data as PaymentData
    await ctx.db.patch(args.paymentId, {
      data: {
        ...paymentData,
        paymentLinkUrl: args.paymentLinkUrl,
        providerReference: args.providerReference,
        status: "pending",
      },
      status: "pending",
      providerReference: args.providerReference,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const linkPaymentToEntity = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    paymentId: v.id("entities"),
    entityId: v.id("entities"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("entityRelations", {
      organizationId: args.organizationId,
      environment: args.environment,
      fromEntityId: args.paymentId,
      toEntityId: args.entityId,
      relationType: "payment_for",
      createdAt: Date.now(),
    })
    return null
  },
})

export const emitPaymentEvent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    entityId: v.id("entities"),
    eventType: v.string(),
    actorId: v.string(),
    actorType: v.string(),
    payload: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId: args.entityId,
      entityTypeSlug: "payment",
      eventType: args.eventType,
      schemaVersion: 1,
      actorId: args.actorId,
      actorType: args.actorType,
      payload: args.payload,
      timestamp: Date.now(),
    })
    return null
  },
})

export const getPaymentInternal = internalQuery({
  args: {
    paymentId: v.id("entities"),
    organizationId: v.id("organizations"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment || payment.organizationId !== args.organizationId) return null
    return payment
  },
})

export const getPaymentEntityType = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
  },
  returns: v.union(
    v.object({ _id: v.id("entityTypes"), slug: v.string() }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const entityType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment).eq("slug", "payment")
      )
      .first()
    if (!entityType) return null
    return { _id: entityType._id, slug: entityType.slug }
  },
})

export const createPaymentEntity = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    entityTypeId: v.id("entityTypes"),
    data: v.any(),
    actorId: v.string(),
    actorType: v.string(),
  },
  returns: v.id("entities"),
  handler: async (ctx, args) => {
    const now = Date.now()
    const paymentId = await ctx.db.insert("entities", {
      organizationId: args.organizationId,
      environment: args.environment,
      entityTypeId: args.entityTypeId,
      status: "draft",
      data: args.data,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId: paymentId,
      entityTypeSlug: "payment",
      eventType: "payment.created",
      schemaVersion: 1,
      actorId: args.actorId,
      actorType: args.actorType,
      payload: args.data,
      timestamp: now,
    })

    return paymentId
  },
})

export const getPendingPayments = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    const paymentTypes = await ctx.db
      .query("entityTypes")
      .withIndex("by_slug", (q) => q.eq("slug", "payment"))
      .collect()

    if (paymentTypes.length === 0) return []

    const pendingPayments: Array<Record<string, unknown>> = []

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

    return pendingPayments
  },
})

export const reconcilePayments = internalAction({
  args: {},
  returns: v.object({ reconciled: v.number() }),
  handler: async (ctx) => {
    const pendingPayments = await ctx.runQuery(internal.payments.getPendingPayments) as Array<{
      _id: Id<"entities">
      organizationId: Id<"organizations">
      environment: "development" | "production" | "eval"
      data: PaymentData
    }>

    let reconciled = 0

    for (const payment of pendingPayments) {
      try {
        const config = await ctx.runQuery(internal.integrations.getConfigInternal, {
          organizationId: payment.organizationId,
          environment: payment.environment,
          provider: "flow" as const,
        })

        if (!config || config.status !== "active") continue

        const flowConfig = config.config as FlowConfig
        const flowStatus = await checkFlowOrderStatusAction(flowConfig, payment.data.providerReference!)

        if (flowStatus.status === "2") {
          await ctx.runMutation(internal.payments.markAsPaid, {
            providerReference: payment.data.providerReference!,
            paidAt: Date.now(),
          })
          reconciled++
        } else if (flowStatus.status === "3" || flowStatus.status === "4") {
          await ctx.runMutation(internal.payments.markAsFailed, {
            providerReference: payment.data.providerReference!,
            reason: flowStatus.statusMessage,
          })
        }
      } catch (error) {
        console.error("Reconciliation error for payment:", payment._id, error)
      }
    }

    return { reconciled }
  },
})

export const verifyPaymentFromWebhook = internalAction({
  args: {
    token: v.string(),
    organizationId: v.id("organizations"),
    environment: environmentValidator,
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
      environment: args.environment,
      provider: "flow",
    })

    if (!config || config.status !== "active") {
      throw new Error("Flow integration not configured")
    }

    const flowConfig = config.config as FlowConfig
    const { verifyPaymentStatusAction } = await import("./lib/integrations/flow")

    return await verifyPaymentStatusAction(flowConfig, args.token)
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

export const createPayment = action({
  args: {
    amount: v.number(),
    currency: v.string(),
    description: v.string(),
    environment: environmentValidator,
  },
  returns: v.id("entities"),
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo)
    if (!auth) throw new Error("Not authenticated")

    const paymentType = await ctx.runQuery(internal.payments.getPaymentEntityType, {
      organizationId: auth.organizationId,
      environment: args.environment,
    })

    if (!paymentType) {
      throw new Error("Payment entity type not found")
    }

    return await ctx.runMutation(internal.payments.createPaymentEntity, {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityTypeId: paymentType._id,
      data: {
        amount: args.amount,
        currency: args.currency,
        description: args.description,
        status: "draft",
      },
      actorId: auth.userId as unknown as string,
      actorType: auth.actorType,
    })
  },
})
