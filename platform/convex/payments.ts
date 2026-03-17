import { v } from "convex/values"
import { query, action, internalMutation, internalAction, internalQuery, mutation } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import { log } from "./lib/logger"
import { createEntityMutation, updateEntityMutation } from "./lib/entityMutations"

const getIntegrationConfigInternalRef = makeFunctionReference<"query">("integrations:getConfigInternal")
const getPendingPaymentsRef = makeFunctionReference<"query">("payments:getPendingPayments")
const markAsPaidRef = makeFunctionReference<"mutation">("payments:markAsPaid")
const markAsFailedRef = makeFunctionReference<"mutation">("payments:markAsFailed")
const getAuthInfoRef = makeFunctionReference<"query">("chat:getAuthInfo")
const getPaymentInternalRef = makeFunctionReference<"query">("payments:getPaymentInternal")
const storePaymentLinkRef = makeFunctionReference<"mutation">("payments:storePaymentLink")
const emitPaymentEventRef = makeFunctionReference<"mutation">("payments:emitPaymentEvent")
import {
  FlowConfig,
  createFlowPaymentLinkAction,
  checkFlowOrderStatusAction,
  verifyPaymentStatusAction,
} from "./lib/integrations/flow"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

interface PaymentData {
  [key: string]: unknown
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

async function queryConfigInternal(
  ctx: any,
  organizationId: Id<"organizations">,
  environment: string,
): Promise<any> {
  return await ctx.runQuery(getIntegrationConfigInternalRef, {
    organizationId,
    environment,
    provider: "flow" as const,
  })
}

async function queryPendingPayments(ctx: any): Promise<any[]> {
  return await ctx.runQuery(getPendingPaymentsRef)
}

async function runMarkAsPaid(ctx: any, providerReference: string, paidAt: number): Promise<void> {
  await ctx.runMutation(markAsPaidRef, { providerReference, paidAt } as any)
}

async function runMarkAsFailed(ctx: any, providerReference: string, reason: string): Promise<void> {
  await ctx.runMutation(markAsFailedRef, { providerReference, reason } as any)
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
    const auth = await ctx.runQuery(getAuthInfoRef)
    if (!auth) throw new Error("Not authenticated")

    const payment = await (ctx as any).runQuery(getPaymentInternalRef, {
      paymentId: args.paymentId,
      organizationId: auth.organizationId,
    })

    if (!payment) throw new Error("Payment not found")

    const paymentData = payment.data as PaymentData
    if (paymentData.status !== "pending" && paymentData.status !== "draft") {
      throw new Error("Payment is not in a valid state to generate a link")
    }

    const config = await queryConfigInternal(ctx, auth.organizationId, payment.environment)

    if (!config || config.status !== "active") {
      throw new Error("Flow integration not configured or inactive")
    }

    const flowConfig = config.config as FlowConfig
    const returnUrl = args.returnUrl || flowConfig.returnUrl || ""

    if (!paymentData.customerEmail) {
      throw new Error("payment.create requires 'customerEmail' parameter (required by Flow)")
    }

    if (!returnUrl) {
      throw new Error("Flow configuration is missing returnUrl")
    }

    const result = await createFlowPaymentLinkAction(flowConfig, {
      paymentId: args.paymentId.toString(),
      amount: paymentData.amount,
      currency: paymentData.currency || flowConfig.defaultCurrency || "CLP",
      description: paymentData.description || "Payment",
      customerEmail: paymentData.customerEmail || "",
      returnUrl,
    })

    await (ctx as any).runMutation(storePaymentLinkRef, {
      paymentId: args.paymentId,
      paymentLinkUrl: result.url,
      providerReference: result.flowOrder,
      flowToken: result.token,
    })

    await (ctx as any).runMutation(emitPaymentEventRef, {
      organizationId: auth.organizationId,
      environment: payment.environment,
      entityId: args.paymentId,
      eventType: "payment.link_created",
      actorId: auth.userId as unknown as string,
      actorType: "user" as const,
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
      log.warn("Payment not found when marking as paid", {
        providerReference: args.providerReference,
      })
      return null
    }

    const paymentData = payment.data as PaymentData
    if (paymentData.status === "paid") {
      return null
    }

    await updateEntityMutation(ctx, {
      organizationId: payment.organizationId,
      environment: payment.environment as "development" | "production" | "eval",
      entityId: payment._id,
      entityTypeSlug: "payment",
      data: { ...paymentData, status: "paid", paidAt: args.paidAt },
      previousData: paymentData,
      status: "paid",
      actor: { actorId: "system", actorType: "webhook" },
      eventType: "payment.paid",
      eventPayload: {
        providerReference: args.providerReference,
        paidAt: args.paidAt,
      },
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
      log.warn("Payment not found when marking as failed", {
        providerReference: args.providerReference,
        reason: args.reason,
      })
      return null
    }

    const paymentData = payment.data as PaymentData
    if (paymentData.status === "paid" || paymentData.status === "failed") {
      return null
    }

    const now = Date.now()

    await updateEntityMutation(ctx, {
      organizationId: payment.organizationId,
      environment: payment.environment as "development" | "production" | "eval",
      entityId: payment._id,
      entityTypeSlug: "payment",
      data: { ...paymentData, status: "failed", failedAt: now, failureReason: args.reason },
      previousData: paymentData,
      status: "failed",
      actor: { actorId: "system", actorType: "webhook" },
      eventType: "payment.failed",
      eventPayload: {
        providerReference: args.providerReference,
        reason: args.reason,
      },
    })

    return null
  },
})

export const storePaymentLink = internalMutation({
  args: {
    paymentId: v.id("entities"),
    paymentLinkUrl: v.string(),
    providerReference: v.string(),
    flowToken: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment) return null

    const paymentData = payment.data as PaymentData

    await updateEntityMutation(ctx, {
      organizationId: payment.organizationId,
      environment: payment.environment as "development" | "production" | "eval",
      entityId: args.paymentId,
      entityTypeSlug: "payment",
      data: {
        ...paymentData,
        paymentLinkUrl: args.paymentLinkUrl,
        providerReference: args.providerReference,
        status: "pending",
      },
      previousData: paymentData,
      status: "pending",
      actor: { actorId: "system", actorType: "system" },
      extraFields: {
        providerReference: args.providerReference,
        flowToken: args.flowToken,
      },
      skipTriggers: true,
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
    actorType: v.union(v.literal("user"), v.literal("system"), v.literal("agent"), v.literal("webhook")),
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

export const getPaymentByFlowToken = internalQuery({
  args: {
    flowToken: v.string(),
  },
  returns: v.union(
    v.object({
      organizationId: v.id("organizations"),
      environment: environmentValidator,
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("entities")
      .withIndex("by_flow_token", (q) =>
        q.eq("flowToken", args.flowToken)
      )
      .first()

    if (!payment) return null

    return {
      organizationId: payment.organizationId,
      environment: payment.environment as "development" | "production" | "eval",
    }
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

export const ensurePaymentEntityType = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
  },
  returns: v.object({ _id: v.id("entityTypes"), slug: v.string() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment).eq("slug", "payment")
      )
      .first()
    if (existing) return { _id: existing._id, slug: existing.slug }

    const now = Date.now()
    const id = await ctx.db.insert("entityTypes", {
      organizationId: args.organizationId,
      environment: args.environment,
      name: "Payment",
      slug: "payment",
      schema: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["draft", "pending", "paid", "failed", "cancelled"] },
          customerEmail: { type: "string", format: "email" },
          paymentLinkUrl: { type: "string" },
          providerReference: { type: "string" },
          paidAt: { type: "number" },
          failedAt: { type: "number" },
          failureReason: { type: "string" },
        },
        required: ["amount", "currency", "status"],
      },
      searchFields: ["status", "customerEmail", "providerReference"],
      createdAt: now,
      updatedAt: now,
    })
    return { _id: id, slug: "payment" }
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
    return await createEntityMutation(ctx, {
      organizationId: args.organizationId,
      environment: args.environment,
      entityTypeId: args.entityTypeId,
      entityTypeSlug: "payment",
      data: args.data,
      status: "draft",
      actor: { actorId: args.actorId, actorType: args.actorType as "user" | "agent" | "system" | "webhook" },
      eventType: "payment.created",
      eventPayload: args.data,
    })
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
    const pendingPayments = await queryPendingPayments(ctx) as Array<{
      _id: Id<"entities">
      organizationId: Id<"organizations">
      environment: "development" | "production" | "eval"
      data: PaymentData
    }>

    let reconciled = 0

    for (const payment of pendingPayments) {
      try {
        const config = await queryConfigInternal(ctx, payment.organizationId, payment.environment)

        if (!config || config.status !== "active") continue

        const flowConfig = config.config as FlowConfig
        const flowStatus = await checkFlowOrderStatusAction(flowConfig, payment.data.providerReference!)

        if (flowStatus.status === 2) {
          await runMarkAsPaid(ctx, payment.data.providerReference!, Date.now())
          reconciled++
        } else if (flowStatus.status === 3 || flowStatus.status === 4) {
          await runMarkAsFailed(ctx, payment.data.providerReference!, flowStatus.statusMessage)
        }
      } catch (error) {
        log.error("Payment reconciliation failed", {
          paymentId: payment._id,
          providerReference: payment.data.providerReference,
          error: error instanceof Error ? error : new Error(String(error)),
        })
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
    commerceOrder: v.string(),
    status: v.number(),
    statusMessage: v.string(),
    amount: v.number(),
    currency: v.string(),
    payer: v.string(),
  }),
  handler: async (ctx, args) => {
    const config = await queryConfigInternal(ctx, args.organizationId, args.environment)

    if (!config || config.status !== "active") {
      throw new Error("Flow integration not configured")
    }

    const flowConfig = config.config as FlowConfig
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

export const createPayment = mutation({
  args: {
    amount: v.number(),
    currency: v.string(),
    description: v.string(),
    environment: environmentValidator,
  },
  returns: v.id("entities"),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const paymentType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment).eq("slug", "payment")
      )
      .first()

    if (!paymentType) {
      throw new Error("Payment entity type not found")
    }

    const data = {
      amount: args.amount,
      currency: args.currency,
      description: args.description,
      status: "draft",
    }

    return await createEntityMutation(ctx, {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityTypeId: paymentType._id,
      entityTypeSlug: "payment",
      data,
      status: "draft",
      actor: { actorId: auth.userId as unknown as string, actorType: auth.actorType as "user" | "agent" | "system" | "webhook" },
      eventType: "payment.created",
      eventPayload: {
        amount: args.amount,
        currency: args.currency,
        description: args.description,
      },
    })
  },
})
