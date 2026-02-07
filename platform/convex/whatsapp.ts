import { v } from "convex/values"
import { query, mutation, internalMutation, internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { requireAuth } from "./lib/auth"
import {
  connectViaGateway,
  disconnectViaGateway,
  sendViaGateway,
} from "./lib/integrations/whatsapp"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

export const connect = internalAction({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.whatsapp.upsertConnection, {
      organizationId: args.organizationId,
      environment: args.environment,
      status: "connecting",
    })
    try {
      const result = await connectViaGateway(args.organizationId as string)
      if (result.status === "connected") {
        await ctx.runMutation(internal.whatsapp.upsertConnection, {
          organizationId: args.organizationId,
          environment: args.environment,
          status: "connected",
          phoneNumber: result.phoneNumber,
        })
      }
    } catch (err) {
      await ctx.runMutation(internal.whatsapp.upsertConnection, {
        organizationId: args.organizationId,
        environment: args.environment,
        status: "disconnected",
      })
      throw err
    }
    return null
  },
})

export const disconnect = internalAction({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await disconnectViaGateway(args.organizationId as string)
    await ctx.runMutation(internal.whatsapp.upsertConnection, {
      organizationId: args.organizationId,
      environment: args.environment,
      status: "disconnected",
    })
    return null
  },
})

export const connectWhatsApp = mutation({
  args: {
    environment: environmentValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await ctx.scheduler.runAfter(0, internal.whatsapp.connect, {
      organizationId: auth.organizationId,
      environment: args.environment,
    })
    return null
  },
})

export const disconnectWhatsApp = mutation({
  args: {
    environment: environmentValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await ctx.scheduler.runAfter(0, internal.whatsapp.disconnect, {
      organizationId: auth.organizationId,
      environment: args.environment,
    })
    return null
  },
})

export const setWhatsAppAgent = mutation({
  args: {
    agentId: v.optional(v.id("agents")),
    environment: environmentValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const connection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment)
      )
      .first()

    if (connection) {
      await ctx.db.patch(connection._id, {
        agentId: args.agentId,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert("whatsappConnections", {
        organizationId: auth.organizationId,
        status: "disconnected",
        agentId: args.agentId,
        environment: args.environment,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    return null
  },
})

export const getConnection = query({
  args: {
    environment: environmentValidator,
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    return await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment)
      )
      .first()
  },
})

export const upsertConnection = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    status: v.union(
      v.literal("disconnected"),
      v.literal("connecting"),
      v.literal("qr_ready"),
      v.literal("connected")
    ),
    phoneNumber: v.optional(v.string()),
    qrCode: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment)
      )
      .first()

    const now = Date.now()

    if (existing) {
      const patch: Record<string, unknown> = {
        status: args.status,
        updatedAt: now,
      }
      if (args.phoneNumber !== undefined) patch.phoneNumber = args.phoneNumber
      if (args.qrCode !== undefined) patch.qrCode = args.qrCode
      if (args.status === "connected") patch.lastConnectedAt = now
      if (args.status === "disconnected") patch.lastDisconnectedAt = now
      if (args.status === "connected") patch.qrCode = undefined
      await ctx.db.patch(existing._id, patch)
    } else {
      await ctx.db.insert("whatsappConnections", {
        organizationId: args.organizationId,
        environment: args.environment,
        status: args.status,
        phoneNumber: args.phoneNumber,
        qrCode: args.qrCode,
        lastConnectedAt: args.status === "connected" ? now : undefined,
        lastDisconnectedAt: args.status === "disconnected" ? now : undefined,
        createdAt: now,
        updatedAt: now,
      })
    }

    return null
  },
})

export const updateQRCode = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    qrCode: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connections = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect()

    for (const conn of connections) {
      if (conn.status === "connecting" || conn.status === "qr_ready") {
        await ctx.db.patch(conn._id, {
          qrCode: args.qrCode,
          status: "qr_ready",
          updatedAt: Date.now(),
        })
      }
    }

    return null
  },
})

export const updateConnectionStatus = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    status: v.union(
      v.literal("disconnected"),
      v.literal("connecting"),
      v.literal("qr_ready"),
      v.literal("connected")
    ),
    phoneNumber: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connections = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect()

    const now = Date.now()

    for (const conn of connections) {
      if (conn.status === "disconnected" && args.status !== "connecting") continue

      const patch: Record<string, unknown> = {
        status: args.status,
        updatedAt: now,
      }
      if (args.phoneNumber) patch.phoneNumber = args.phoneNumber
      if (args.status === "connected") {
        patch.lastConnectedAt = now
        patch.qrCode = undefined
      }
      if (args.status === "disconnected") {
        patch.lastDisconnectedAt = now
        patch.qrCode = undefined
      }
      await ctx.db.patch(conn._id, patch)
    }

    return null
  },
})

export const processInboundMessage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    from: v.string(),
    messageId: v.string(),
    timestamp: v.number(),
    type: v.string(),
    text: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .first()

    if (existing) {
      return false
    }

    await ctx.db.insert("whatsappMessages", {
      organizationId: args.organizationId,
      direction: "inbound",
      phoneNumber: args.from,
      messageId: args.messageId,
      type: args.type,
      text: args.text,
      status: "received",
      createdAt: args.timestamp,
    })
    return true
  },
})

export const storeOutboundMessage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    phoneNumber: v.string(),
    messageId: v.string(),
    text: v.string(),
    threadId: v.optional(v.id("threads")),
    status: v.optional(v.union(v.literal("sent"), v.literal("failed"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("whatsappMessages", {
      organizationId: args.organizationId,
      direction: "outbound",
      phoneNumber: args.phoneNumber,
      messageId: args.messageId,
      type: "text",
      text: args.text,
      threadId: args.threadId,
      status: args.status ?? "sent",
      createdAt: Date.now(),
    })
    return null
  },
})

export const scheduleAgentRouting = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    phoneNumber: v.string(),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connections = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect()

    for (const conn of connections) {
      if (conn.agentId && conn.status === "connected") {
        await ctx.scheduler.runAfter(0, internal.whatsapp.routeInboundToAgent, {
          organizationId: args.organizationId,
          phoneNumber: args.phoneNumber,
          text: args.text,
          environment: conn.environment,
          agentId: conn.agentId,
        })
        break
      }
    }

    return null
  },
})

export const routeInboundToAgent = internalAction({
  args: {
    organizationId: v.id("organizations"),
    phoneNumber: v.string(),
    text: v.string(),
    environment: environmentValidator,
    agentId: v.id("agents"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const externalThreadId = `whatsapp:${args.phoneNumber}`

    const threadId = await ctx.runMutation(internal.threads.getOrCreate, {
      organizationId: args.organizationId,
      agentId: args.agentId,
      externalId: externalThreadId,
      environment: args.environment,
    })

    const result = await ctx.runAction(internal.agent.chatAuthenticated, {
      organizationId: args.organizationId,
      agentId: args.agentId,
      message: args.text,
      threadId,
      environment: args.environment,
    })

    const responseText = result.message

    if (responseText) {
      let messageId = `failed_${Date.now()}`
      let status: "sent" | "failed" = "sent"

      try {
        const sendResult = await sendViaGateway(
          args.organizationId as string,
          args.phoneNumber,
          responseText
        )
        messageId = sendResult.messageId
      } catch (err) {
        console.error("Failed to send via WhatsApp gateway:", err)
        status = "failed"
      }

      await ctx.runMutation(internal.whatsapp.storeOutboundMessage, {
        organizationId: args.organizationId,
        phoneNumber: args.phoneNumber,
        messageId,
        text: responseText,
        threadId: result.threadId,
        status,
      })
    }

    return null
  },
})

export const getConversationMessages = query({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_org_phone", (q) =>
        q.eq("organizationId", auth.organizationId).eq("phoneNumber", args.phoneNumber)
      )
      .order("desc")
      .take(args.limit ?? 50)

    return messages.reverse()
  },
})

export const listConversations = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .order("desc")
      .take(500)

    const phoneMap = new Map<string, { phoneNumber: string; lastMessage: string | undefined; lastMessageAt: number; direction: string }>()
    for (const msg of messages) {
      if (!phoneMap.has(msg.phoneNumber)) {
        phoneMap.set(msg.phoneNumber, {
          phoneNumber: msg.phoneNumber,
          lastMessage: msg.text,
          lastMessageAt: msg.createdAt,
          direction: msg.direction,
        })
      }
    }

    return Array.from(phoneMap.values()).slice(0, args.limit ?? 50)
  },
})
