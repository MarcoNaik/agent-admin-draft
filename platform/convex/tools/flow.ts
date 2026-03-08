import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { makeFunctionReference } from "convex/server"
import { Id } from "../_generated/dataModel"

const getIntegrationConfigInternalRef = makeFunctionReference<"query">("integrations:getConfigInternal")
const getPaymentEntityTypeRef = makeFunctionReference<"query">("payments:getPaymentEntityType")
const ensurePaymentEntityTypeRef = makeFunctionReference<"mutation">("payments:ensurePaymentEntityType")
const createPaymentEntityRef = makeFunctionReference<"mutation">("payments:createPaymentEntity")
const storePaymentLinkRef = makeFunctionReference<"mutation">("payments:storePaymentLink")
const linkPaymentToEntityRef = makeFunctionReference<"mutation">("payments:linkPaymentToEntity")
const getPaymentInternalRef = makeFunctionReference<"query">("payments:getPaymentInternal")
import {
  FlowConfig,
  createFlowPaymentLinkAction,
  checkFlowOrderStatusAction,
} from "../lib/integrations/flow"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

type Environment = "development" | "production" | "eval"

async function resolveFlowConfig(
  ctx: any,
  organizationId: Id<"organizations">,
  environment: Environment
): Promise<FlowConfig> {
  let config = await ctx.runQuery(getIntegrationConfigInternalRef, {
    organizationId,
    environment,
    provider: "flow" as const,
  })
  if ((!config || config.status !== "active") && environment === "eval") {
    config = await ctx.runQuery(getIntegrationConfigInternalRef, {
      organizationId,
      environment: "development" as const,
      provider: "flow" as const,
    })
  }
  if (!config || config.status !== "active") {
    throw new Error("Flow integration is not configured or not active")
  }
  const flowConfig = config.config as FlowConfig
  if (!flowConfig.apiUrl || !flowConfig.apiKey || !flowConfig.secretKey) {
    throw new Error("Flow configuration is incomplete")
  }
  return flowConfig
}

async function queryPaymentEntityType(
  ctx: any,
  organizationId: Id<"organizations">,
  environment: Environment
): Promise<{ _id: Id<"entityTypes">; slug: string }> {
  return await ctx.runMutation(ensurePaymentEntityTypeRef, {
    organizationId,
    environment,
  })
}

async function createPaymentEntityMutation(
  ctx: any,
  args: {
    organizationId: Id<"organizations">
    environment: Environment
    entityTypeId: Id<"entityTypes">
    data: Record<string, unknown>
    actorId: string
    actorType: string
  }
): Promise<Id<"entities">> {
  return await ctx.runMutation(createPaymentEntityRef, args)
}

async function storePaymentLinkMutation(
  ctx: any,
  args: { paymentId: Id<"entities">; paymentLinkUrl: string; providerReference: string; flowToken?: string }
): Promise<void> {
  await ctx.runMutation(storePaymentLinkRef, args)
}

async function linkPaymentMutation(
  ctx: any,
  args: {
    organizationId: Id<"organizations">
    environment: Environment
    paymentId: Id<"entities">
    entityId: Id<"entities">
  }
): Promise<void> {
  await ctx.runMutation(linkPaymentToEntityRef, args)
}

async function queryPaymentInternal(
  ctx: any,
  paymentId: Id<"entities">,
  organizationId: Id<"organizations">
): Promise<Record<string, unknown> | null> {
  return await ctx.runQuery(getPaymentInternalRef, {
    paymentId,
    organizationId,
  })
}

export const paymentCreate = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    amount: v.number(),
    description: v.string(),
    currency: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    entityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await resolveFlowConfig(ctx, args.organizationId, args.environment as Environment)
    const currency = args.currency || config.defaultCurrency || "CLP"
    const returnUrl = config.returnUrl || ""

    if (!args.customerEmail) {
      throw new Error("payment.create requires 'customerEmail' parameter (required by Flow)")
    }

    if (!returnUrl) {
      throw new Error("Flow configuration is missing returnUrl")
    }

    const paymentType = await queryPaymentEntityType(ctx, args.organizationId, args.environment as Environment)

    const paymentId = await createPaymentEntityMutation(ctx, {
      organizationId: args.organizationId,
      environment: args.environment as Environment,
      entityTypeId: paymentType._id,
      data: {
        amount: args.amount,
        currency,
        description: args.description,
        status: "pending",
        customerEmail: args.customerEmail || "",
      },
      actorId: args.actorId,
      actorType: args.actorType,
    })

    const result = await createFlowPaymentLinkAction(config, {
      paymentId: paymentId.toString(),
      amount: args.amount,
      currency,
      description: args.description,
      customerEmail: args.customerEmail || "",
      returnUrl,
    })

    await storePaymentLinkMutation(ctx, {
      paymentId,
      paymentLinkUrl: result.url,
      providerReference: result.flowOrder,
      flowToken: result.token,
    })

    if (args.entityId) {
      await linkPaymentMutation(ctx, {
        organizationId: args.organizationId,
        environment: args.environment as Environment,
        paymentId,
        entityId: args.entityId as Id<"entities">,
      })
    }

    return {
      paymentId: paymentId.toString(),
      paymentLinkUrl: result.url,
      flowOrderId: result.flowOrder,
    }
  },
})

export const paymentGetStatus = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const entity = await queryPaymentInternal(ctx, args.entityId as Id<"entities">, args.organizationId)

    if (!entity) {
      throw new Error("Payment entity not found")
    }

    const data = entity.data as {
      status: string
      amount?: number
      currency?: string
      paymentLinkUrl?: string
      providerReference?: string
    }

    if (data.providerReference) {
      try {
        const config = await resolveFlowConfig(ctx, args.organizationId, args.environment as Environment)
        const flowStatus = await checkFlowOrderStatusAction(config, data.providerReference)
        return {
          entityId: args.entityId,
          status: data.status,
          flowStatus: flowStatus.status,
          flowStatusMessage: flowStatus.statusMessage,
          paymentLinkUrl: data.paymentLinkUrl,
          amount: data.amount,
          currency: data.currency,
        }
      } catch {
      }
    }

    return {
      entityId: args.entityId,
      status: data.status,
      paymentLinkUrl: data.paymentLinkUrl,
      amount: data.amount,
      currency: data.currency,
    }
  },
})
