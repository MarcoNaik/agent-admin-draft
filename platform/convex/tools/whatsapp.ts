import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { sendViaGateway } from "../lib/integrations/whatsapp"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

export const whatsappSend = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    to: v.string(),
    text: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(internal.whatsapp.getConnectionInternal, {
      organizationId: args.organizationId,
      environment: args.environment,
    })

    if (!connection || connection.status !== "connected") {
      throw new Error("WhatsApp is not connected for this organization")
    }

    const result = await sendViaGateway(
      args.organizationId as string,
      args.to,
      args.text
    )

    await ctx.runMutation(internal.whatsapp.storeOutboundMessage, {
      organizationId: args.organizationId,
      phoneNumber: args.to,
      messageId: result.messageId,
      text: args.text,
    })

    return {
      messageId: result.messageId,
      to: args.to,
      status: "sent",
    }
  },
})

export const whatsappGetConversation = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.runQuery(internal.whatsapp.getConversationMessagesInternal, {
      organizationId: args.organizationId,
      phoneNumber: args.phoneNumber,
      limit: args.limit,
    })
  },
})

export const whatsappGetStatus = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    const connection: any = await ctx.runQuery(internal.whatsapp.getConnectionInternal, {
      organizationId: args.organizationId,
      environment: args.environment,
    })

    if (!connection) {
      return { connected: false, status: "not_configured" }
    }

    return {
      connected: connection.status === "connected",
      status: connection.status,
      phoneNumber: connection.phoneNumber,
      lastConnectedAt: connection.lastConnectedAt,
    }
  },
})
