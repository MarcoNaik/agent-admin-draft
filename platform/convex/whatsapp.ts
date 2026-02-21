import { v } from "convex/values"
import { query, mutation, internalMutation, internalQuery, QueryCtx, MutationCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import { calculateWhatsAppCost } from "./lib/whatsappPricing"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))



async function isOrgAdmin(ctx: QueryCtx | MutationCtx, auth: { userId: Id<"users">; organizationId: Id<"organizations"> }) {
  const membership = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user_org", (q) =>
      q.eq("userId", auth.userId).eq("organizationId", auth.organizationId)
    )
    .first()
  return membership?.role === "admin"
}

async function requireOrgAdmin(ctx: QueryCtx | MutationCtx, auth: { userId: Id<"users">; organizationId: Id<"organizations"> }) {
  if (!(await isOrgAdmin(ctx, auth))) {
    throw new Error("Admin access required")
  }
}

async function requireWhatsAppEnabled(ctx: QueryCtx | MutationCtx, organizationId: Id<"organizations">, environment: "development" | "production" | "eval") {
  const integrationConfig = await ctx.db
    .query("integrationConfigs")
    .withIndex("by_org_env_provider", (q) =>
      q.eq("organizationId", organizationId).eq("environment", environment).eq("provider", "whatsapp")
    )
    .first()
  if (!integrationConfig || integrationConfig.status !== "active") {
    throw new Error("WhatsApp integration is not enabled")
  }
  return integrationConfig
}

export function parseWhatsAppExternalId(externalId: string): { connectionId: string; customerPhone: string } | null {
  const match = externalId.match(/^whatsapp:([^:]+):(.+)$/)
  if (!match) return null
  return { connectionId: match[1], customerPhone: match[2] }
}

export const addPhoneNumber = mutation({
  args: {
    environment: environmentValidator,
    label: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)
    const integrationConfig = await requireWhatsAppEnabled(ctx, auth.organizationId, args.environment)

    const pendingSetup = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org_env_status", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment).eq("status", "pending_setup")
      )
      .first()

    if (pendingSetup) {
      throw new Error("A phone number setup is already in progress. Complete or cancel it first.")
    }

    const config = (integrationConfig.config ?? {}) as Record<string, unknown>
    const existingKapsoCustomerId = config.kapsoCustomerId as string | undefined

    await ctx.scheduler.runAfter(0, internal.whatsappActions.createKapsoSetup, {
      organizationId: auth.organizationId,
      environment: args.environment,
      label: args.label,
      existingKapsoCustomerId,
    })
    return null
  },
})

export const handlePhoneConnected = internalMutation({
  args: {
    kapsoCustomerId: v.string(),
    kapsoPhoneNumberId: v.string(),
    phoneNumber: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const allConnections = await ctx.db.query("whatsappConnections").collect()
    const found = allConnections.find(
      (conn) => conn.kapsoCustomerId === args.kapsoCustomerId && conn.status === "pending_setup"
    )

    if (!found) {
      const alreadyConnected = allConnections.find(
        (conn) => conn.kapsoPhoneNumberId === args.kapsoPhoneNumberId && conn.status === "connected"
      )
      if (alreadyConnected) {
        return null
      }
      return null
    }

    const now = Date.now()
    await ctx.db.patch(found._id, {
      kapsoPhoneNumberId: args.kapsoPhoneNumberId,
      phoneNumber: args.phoneNumber,
      status: "connected",
      lastConnectedAt: now,
      setupLinkUrl: undefined,
      updatedAt: now,
    })

    await ctx.scheduler.runAfter(0, internal.whatsappActions.registerNumberWebhook, {
      kapsoPhoneNumberId: args.kapsoPhoneNumberId,
    })

    return null
  },
})

export const disconnectPhoneNumber = mutation({
  args: {
    connectionId: v.id("whatsappConnections"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const connection = await ctx.db.get(args.connectionId)
    if (!connection || connection.organizationId !== auth.organizationId) {
      throw new Error("Connection not found")
    }

    if (connection.kapsoPhoneNumberId) {
      await ctx.scheduler.runAfter(0, internal.whatsappActions.disconnectFromKapso, {
        kapsoPhoneNumberId: connection.kapsoPhoneNumberId,
      })
    }

    await ctx.db.patch(args.connectionId, {
      status: "disconnected",
      kapsoPhoneNumberId: undefined,
      phoneNumber: undefined,
      setupLinkUrl: undefined,
      lastDisconnectedAt: Date.now(),
      updatedAt: Date.now(),
    })

    return null
  },
})

export const removeConnection = mutation({
  args: {
    connectionId: v.id("whatsappConnections"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const connection = await ctx.db.get(args.connectionId)
    if (!connection || connection.organizationId !== auth.organizationId) {
      throw new Error("Connection not found")
    }

    if (connection.kapsoPhoneNumberId) {
      await ctx.scheduler.runAfter(0, internal.whatsappActions.disconnectFromKapso, {
        kapsoPhoneNumberId: connection.kapsoPhoneNumberId,
      })
    }

    await ctx.db.delete(args.connectionId)

    return null
  },
})

export const setPhoneAgent = mutation({
  args: {
    connectionId: v.id("whatsappConnections"),
    agentId: v.optional(v.id("agents")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const connection = await ctx.db.get(args.connectionId)
    if (!connection || connection.organizationId !== auth.organizationId) {
      throw new Error("Connection not found")
    }

    await requireWhatsAppEnabled(ctx, auth.organizationId, connection.environment)

    await ctx.db.patch(args.connectionId, {
      agentId: args.agentId,
      updatedAt: Date.now(),
    })

    return null
  },
})

export const updatePhoneLabel = mutation({
  args: {
    connectionId: v.id("whatsappConnections"),
    label: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const connection = await ctx.db.get(args.connectionId)
    if (!connection || connection.organizationId !== auth.organizationId) {
      throw new Error("Connection not found")
    }

    await ctx.db.patch(args.connectionId, {
      label: args.label,
      updatedAt: Date.now(),
    })

    return null
  },
})

export const listConnections = query({
  args: {
    environment: environmentValidator,
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const connections = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment)
      )
      .collect()

    const agentCache = new Map<string, string>()
    const results = []

    for (const conn of connections) {
      let agentName: string | undefined
      if (conn.agentId) {
        if (agentCache.has(conn.agentId)) {
          agentName = agentCache.get(conn.agentId)
        } else {
          const agent = await ctx.db.get(conn.agentId)
          if (agent) {
            agentName = agent.name
            agentCache.set(conn.agentId, agent.name)
          }
        }
      }
      results.push({ ...conn, agentName })
    }

    return results
  },
})

export const getConnectionByIdInternal = internalQuery({
  args: {
    connectionId: v.id("whatsappConnections"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.connectionId)
  },
})

export const getConnectionByKapsoPhone = internalQuery({
  args: {
    kapsoPhoneNumberId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsappConnections")
      .withIndex("by_kapso_phone", (q) =>
        q.eq("kapsoPhoneNumberId", args.kapsoPhoneNumberId)
      )
      .first()
  },
})

export const getConnectionByAgentInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const connections = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment)
      )
      .collect()

    return connections.find(
      (c) => c.agentId === args.agentId && c.status === "connected"
    ) ?? null
  },
})

export const listConnectionsInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment)
      )
      .collect()
  },
})

export const getConversationMessagesInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    phoneNumber: v.string(),
    connectionId: v.optional(v.id("whatsappConnections")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let messages
    if (args.connectionId) {
      messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_connection_phone", (q) =>
          q.eq("connectionId", args.connectionId).eq("phoneNumber", args.phoneNumber)
        )
        .order("desc")
        .take(args.limit ?? 50)
    } else {
      messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_org_phone", (q) =>
          q.eq("organizationId", args.organizationId).eq("phoneNumber", args.phoneNumber)
        )
        .order("desc")
        .take(args.limit ?? 50)
    }

    return messages.reverse().map((msg) => ({
      id: msg._id,
      direction: msg.direction,
      text: msg.text,
      type: msg.type,
      status: msg.status,
      timestamp: msg.createdAt,
    }))
  },
})

export const createConnection = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    status: v.union(v.literal("disconnected"), v.literal("pending_setup"), v.literal("connected")),
    kapsoCustomerId: v.string(),
    kapsoPhoneNumberId: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    setupLinkUrl: v.optional(v.string()),
    label: v.optional(v.string()),
  },
  returns: v.id("whatsappConnections"),
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("whatsappConnections", {
      organizationId: args.organizationId,
      environment: args.environment,
      status: args.status,
      label: args.label,
      kapsoCustomerId: args.kapsoCustomerId,
      kapsoPhoneNumberId: args.kapsoPhoneNumberId,
      phoneNumber: args.phoneNumber,
      setupLinkUrl: args.setupLinkUrl,
      lastConnectedAt: args.status === "connected" ? now : undefined,
      lastDisconnectedAt: args.status === "disconnected" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const handlePhoneDeleted = internalMutation({
  args: {
    kapsoPhoneNumberId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_kapso_phone", (q) =>
        q.eq("kapsoPhoneNumberId", args.kapsoPhoneNumberId)
      )
      .first()

    if (connection) {
      await ctx.db.patch(connection._id, {
        status: "disconnected",
        lastDisconnectedAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    return null
  },
})

export const processInboundMessage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    connectionId: v.id("whatsappConnections"),
    from: v.string(),
    messageId: v.string(),
    timestamp: v.number(),
    type: v.string(),
    text: v.optional(v.string()),
    contactName: v.optional(v.string()),
    mediaCaption: v.optional(v.string()),
    interactiveData: v.optional(v.any()),
    mediaDirectUrl: v.optional(v.string()),
  },
  returns: v.union(v.id("whatsappMessages"), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .first()

    if (existing) {
      return null
    }

    const msgId = await ctx.db.insert("whatsappMessages", {
      organizationId: args.organizationId,
      connectionId: args.connectionId,
      direction: "inbound",
      phoneNumber: args.from,
      messageId: args.messageId,
      type: args.type,
      text: args.text,
      mediaCaption: args.mediaCaption,
      interactiveData: args.interactiveData,
      mediaDirectUrl: args.mediaDirectUrl,
      status: "received",
      createdAt: args.timestamp,
    })

    const externalId = `whatsapp:${args.connectionId}:${args.from}`
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_external", (q) => q.eq("externalId", externalId))
      .first()

    if (thread && thread.organizationId === args.organizationId) {
      const metadata: Record<string, unknown> = { ...(thread.metadata ?? {}), lastInboundAt: args.timestamp }
      if (args.contactName) metadata.contactName = args.contactName
      await ctx.db.patch(thread._id, { metadata, updatedAt: args.timestamp })
    }

    return msgId
  },
})

export const updateMessageStatus = internalMutation({
  args: {
    messageId: v.string(),
    status: v.string(),
    pricingBillable: v.optional(v.boolean()),
    pricingModel: v.optional(v.string()),
    pricingCategory: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const msg = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .first()

    if (msg) {
      const validStatuses = ["sent", "delivered", "read", "failed"]
      if (validStatuses.includes(args.status)) {
        const patch: Record<string, unknown> = {
          status: args.status as "sent" | "delivered" | "read" | "failed",
        }

        if (args.status === "sent" && args.pricingCategory && !msg.creditsConsumed) {
          const billable = args.pricingBillable !== false
          patch.pricingBillable = billable
          patch.pricingModel = args.pricingModel
          patch.pricingCategory = args.pricingCategory

          const cost = calculateWhatsAppCost(msg.phoneNumber, args.pricingCategory, billable)
          patch.creditsConsumed = cost

          if (cost > 0) {
            await ctx.scheduler.runAfter(0, internal.billing.deductCredits, {
              organizationId: msg.organizationId,
              amount: cost,
              description: `WhatsApp ${args.pricingCategory} to +${msg.phoneNumber}`,
              metadata: { whatsappMessageId: msg._id, category: args.pricingCategory },
            })
          }
        }

        await ctx.db.patch(msg._id, patch)
      }
    }

    return null
  },
})

export const scheduleMediaDownload = internalMutation({
  args: {
    whatsappMessageId: v.id("whatsappMessages"),
    mediaId: v.string(),
    kapsoPhoneNumberId: v.string(),
    mediaUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.whatsappActions.downloadAndStoreMedia, {
      whatsappMessageId: args.whatsappMessageId,
      mediaId: args.mediaId,
      kapsoPhoneNumberId: args.kapsoPhoneNumberId,
      mediaUrl: args.mediaUrl,
    })
    return null
  },
})

export const attachMediaToMessage = internalMutation({
  args: {
    whatsappMessageId: v.id("whatsappMessages"),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    fileName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.whatsappMessageId, {
      mediaStorageId: args.storageId,
      mediaMimeType: args.mimeType,
      mediaFileName: args.fileName,
    })
    return null
  },
})

export const storeOutboundMessage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    connectionId: v.optional(v.id("whatsappConnections")),
    phoneNumber: v.string(),
    messageId: v.string(),
    text: v.optional(v.string()),
    threadId: v.optional(v.id("threads")),
    status: v.optional(v.union(v.literal("sent"), v.literal("failed"))),
    type: v.optional(v.string()),
    interactiveData: v.optional(v.any()),
    mediaDirectUrl: v.optional(v.string()),
    mediaCaption: v.optional(v.string()),
    mediaMimeType: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("whatsappMessages", {
      organizationId: args.organizationId,
      connectionId: args.connectionId,
      direction: "outbound",
      phoneNumber: args.phoneNumber,
      messageId: args.messageId,
      type: args.type ?? "text",
      text: args.text,
      threadId: args.threadId,
      status: args.status ?? "sent",
      createdAt: Date.now(),
      interactiveData: args.interactiveData,
      mediaDirectUrl: args.mediaDirectUrl,
      mediaCaption: args.mediaCaption,
      mediaMimeType: args.mediaMimeType,
    })
    return null
  },
})

export const storeOutboundMediaMessage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    connectionId: v.optional(v.id("whatsappConnections")),
    phoneNumber: v.string(),
    messageId: v.string(),
    type: v.string(),
    text: v.string(),
    threadId: v.optional(v.id("threads")),
    mediaStorageId: v.id("_storage"),
    mediaMimeType: v.string(),
    mediaFileName: v.optional(v.string()),
    mediaCaption: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("whatsappMessages", {
      organizationId: args.organizationId,
      connectionId: args.connectionId,
      direction: "outbound",
      phoneNumber: args.phoneNumber,
      messageId: args.messageId,
      type: args.type,
      text: args.text,
      threadId: args.threadId,
      mediaStorageId: args.mediaStorageId,
      mediaMimeType: args.mediaMimeType,
      mediaFileName: args.mediaFileName,
      mediaCaption: args.mediaCaption,
      status: "sent",
      createdAt: Date.now(),
    })
    return null
  },
})

export const scheduleAgentRouting = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    connectionId: v.id("whatsappConnections"),
    phoneNumber: v.string(),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId)

    if (connection?.agentId && connection.status === "connected") {
      await ctx.scheduler.runAfter(0, internal.whatsappActions.routeInboundToAgent, {
        organizationId: args.organizationId,
        phoneNumber: args.phoneNumber,
        text: args.text,
        environment: args.environment,
        agentId: connection.agentId,
        connectionId: args.connectionId,
      })
    }

    return null
  },
})

export const getConversationMessages = query({
  args: {
    phoneNumber: v.string(),
    connectionId: v.optional(v.id("whatsappConnections")),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    let messages
    if (args.connectionId) {
      messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_connection_phone", (q) =>
          q.eq("connectionId", args.connectionId).eq("phoneNumber", args.phoneNumber)
        )
        .order("desc")
        .take(args.limit ?? 50)
    } else {
      messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_org_phone", (q) =>
          q.eq("organizationId", auth.organizationId).eq("phoneNumber", args.phoneNumber)
        )
        .order("desc")
        .take(args.limit ?? 50)
    }

    return messages.reverse()
  },
})

export const listConversations = query({
  args: {
    connectionId: v.optional(v.id("whatsappConnections")),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .order("desc")
      .take(500)

    const phoneMap = new Map<string, { phoneNumber: string; lastMessage: string | undefined; lastMessageAt: number; direction: string }>()
    for (const msg of messages) {
      if (args.connectionId && msg.connectionId !== args.connectionId) continue
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

export const enableWhatsApp = mutation({
  args: {
    environment: environmentValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const existing = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_env_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment).eq("provider", "whatsapp")
      )
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "active",
        updatedAt: now,
      })
    } else {
      await ctx.db.insert("integrationConfigs", {
        organizationId: auth.organizationId,
        environment: args.environment,
        provider: "whatsapp",
        config: {},
        status: "active",
        lastVerifiedAt: null,
        createdAt: now,
        updatedAt: now,
      })
    }

    return null
  },
})

export const disableWhatsApp = mutation({
  args: {
    environment: environmentValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const existing = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_env_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment).eq("provider", "whatsapp")
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "inactive",
        updatedAt: Date.now(),
      })
    }

    return null
  },
})

export const getMediaUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAuth(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const getWhatsAppTimeline = query({
  args: { threadId: v.id("threads") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.organizationId !== auth.organizationId) return []
    if (!thread.externalId?.startsWith("whatsapp:")) return []

    const parsed = parseWhatsAppExternalId(thread.externalId)
    if (!parsed) return []

    const { connectionId, customerPhone } = parsed

    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_connection_phone", (q) =>
        q.eq("connectionId", connectionId as Id<"whatsappConnections">).eq("phoneNumber", customerPhone)
      )
      .order("asc")
      .take(200)

    const timeline = []
    for (const msg of messages) {
      let mediaUrl: string | null = null
      if (msg.mediaStorageId) {
        mediaUrl = await ctx.storage.getUrl(msg.mediaStorageId)
      }
      timeline.push({
        id: msg._id,
        direction: msg.direction,
        type: msg.type,
        text: msg.text,
        mediaUrl,
        mediaMimeType: msg.mediaMimeType,
        mediaCaption: msg.mediaCaption,
        mediaFileName: msg.mediaFileName,
        interactiveData: msg.interactiveData,
        status: msg.status,
        createdAt: msg.createdAt,
      })
    }

    return timeline
  },
})

export const getMessageStatuses = query({
  args: { threadId: v.id("threads") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.organizationId !== auth.organizationId) return {}
    if (!thread.externalId?.startsWith("whatsapp:")) return {}

    const parsed = parseWhatsAppExternalId(thread.externalId)
    if (!parsed) return {}

    const { connectionId, customerPhone } = parsed

    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_connection_phone", (q) =>
        q.eq("connectionId", connectionId as Id<"whatsappConnections">).eq("phoneNumber", customerPhone)
      )
      .order("desc")
      .take(100)

    const statusMap: Record<string, string> = {}
    for (const msg of messages) {
      if (msg.direction === "outbound") {
        statusMap[msg.createdAt.toString()] = msg.status
      }
    }
    return statusMap
  },
})
