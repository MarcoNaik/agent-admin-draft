"use node"

import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { sendTextMessage } from "../lib/integrations/kapso"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

export const whatsappSend = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    to: v.string(),
    text: v.string(),
    connectionId: v.optional(v.id("whatsappConnections")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    let connection: any

    if (args.connectionId) {
      connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
        connectionId: args.connectionId,
      })
    } else if (args.actorType === "agent") {
      connection = await ctx.runQuery(internal.whatsapp.getConnectionByAgentInternal, {
        organizationId: args.organizationId,
        environment: args.environment,
        agentId: args.actorId as any,
      })
    }

    if (!connection) {
      const connections: any[] = await ctx.runQuery(internal.whatsapp.listConnectionsInternal, {
        organizationId: args.organizationId,
        environment: args.environment,
      })
      connection = connections.find((c: any) => c.status === "connected")
    }

    if (!connection || connection.status !== "connected" || !connection.kapsoPhoneNumberId) {
      throw new Error("No connected WhatsApp number found for this organization")
    }

    const result = await sendTextMessage(
      connection.kapsoPhoneNumberId,
      args.to,
      args.text
    )

    await ctx.runMutation(internal.whatsapp.storeOutboundMessage, {
      organizationId: args.organizationId,
      connectionId: connection._id,
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
    connectionId: v.optional(v.id("whatsappConnections")),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.runQuery(internal.whatsapp.getConversationMessagesInternal, {
      organizationId: args.organizationId,
      phoneNumber: args.phoneNumber,
      connectionId: args.connectionId,
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
    const connections: any[] = await ctx.runQuery(internal.whatsapp.listConnectionsInternal, {
      organizationId: args.organizationId,
      environment: args.environment,
    })

    if (connections.length === 0) {
      return { connected: false, status: "not_configured", connections: [] }
    }

    return {
      connected: connections.some((c: any) => c.status === "connected"),
      status: connections.some((c: any) => c.status === "connected") ? "connected" : "disconnected",
      connections: connections.map((c: any) => ({
        id: c._id,
        status: c.status,
        label: c.label,
        phoneNumber: c.phoneNumber,
        agentId: c.agentId,
        lastConnectedAt: c.lastConnectedAt,
      })),
    }
  },
})
