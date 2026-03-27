import { v } from "convex/values"
import { query, mutation, internalMutation, internalQuery, QueryCtx, MutationCtx } from "./_generated/server"
import { Id } from "./_generated/dataModel"
import { makeFunctionReference } from "convex/server"
import { requireAuth, requireOrgAdmin, isOrgAdmin } from "./lib/auth"
import { calculateWhatsAppCost } from "./lib/whatsappPricing"
import { getPlanLimits, getProductPlan } from "./lib/plans"
import { polar } from "./polarClient"

const createKapsoSetupRef = makeFunctionReference<"action">("whatsappActions:createKapsoSetup")
const registerNumberWebhookRef = makeFunctionReference<"action">("whatsappActions:registerNumberWebhook")
const disconnectFromKapsoRef = makeFunctionReference<"action">("whatsappActions:disconnectFromKapso")
const downloadAndStoreMediaRef = makeFunctionReference<"action">("whatsappActions:downloadAndStoreMedia")
const routeInboundToAgentRef = makeFunctionReference<"action">("whatsappActions:routeInboundToAgent")
const deductCreditsRef = makeFunctionReference<"mutation">("billing:deductCredits")

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

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

    const sub = await polar.getCurrentSubscription(ctx, { userId: auth.organizationId as string })
    const plan = (sub && sub.status === "active") ? getProductPlan(sub.productId) : "free"
    const limits = getPlanLimits(plan)
    const existingConnections = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment)
      )
      .collect()
    const activeCount = existingConnections.filter((c) => c.status !== "disconnected").length
    if (activeCount >= limits.maxWhatsAppConnections) {
      throw new Error(`WhatsApp connection limit reached. Your plan allows up to ${limits.maxWhatsAppConnections} connections.`)
    }

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

    await ctx.scheduler.runAfter(0, createKapsoSetupRef, {
      organizationId: auth.organizationId,
      environment: args.environment,
      label: args.label,
      existingKapsoCustomerId,
    } as any)
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

    await ctx.scheduler.runAfter(0, registerNumberWebhookRef, {
      kapsoPhoneNumberId: args.kapsoPhoneNumberId,
    } as any)

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
      await ctx.scheduler.runAfter(0, disconnectFromKapsoRef, {
        kapsoPhoneNumberId: connection.kapsoPhoneNumberId,
      } as any)
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
      await ctx.scheduler.runAfter(0, disconnectFromKapsoRef, {
        kapsoPhoneNumberId: connection.kapsoPhoneNumberId,
      } as any)
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
    let externalIdPrefix: string | undefined
    if (args.connectionId) {
      externalIdPrefix = `whatsapp:${args.connectionId}:${args.phoneNumber}`
    }

    let thread
    if (externalIdPrefix) {
      thread = await ctx.db
        .query("threads")
        .withIndex("by_external", (q) => q.eq("externalId", externalIdPrefix))
        .first()
    }

    if (!thread) {
      const allThreads = await ctx.db
        .query("threads")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .collect()
      thread = allThreads.find((t) => {
        if (t.channel !== "whatsapp") return false
        return t.externalId?.endsWith(`:${args.phoneNumber}`)
      })
    }

    if (!thread) return []

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .order("desc")
      .take(args.limit ?? 50)

    return messages.reverse().map((msg) => ({
      id: msg._id,
      direction: msg.direction ?? (msg.role === "user" ? "inbound" : "outbound"),
      text: msg.content,
      type: (msg.channelData as Record<string, unknown>)?.type ?? "text",
      status: msg.status ?? (msg.role === "user" ? "received" : "sent"),
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
    const sub = await polar.getCurrentSubscription(ctx, { userId: args.organizationId as string })
    const plan = (sub && sub.status === "active") ? getProductPlan(sub.productId) : "free"
    const limits = getPlanLimits(plan)
    const existingConnections = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment)
      )
      .collect()
    const activeCount = existingConnections.filter((c) => c.status !== "disconnected").length
    if (activeCount >= limits.maxWhatsAppConnections) {
      throw new Error(`WhatsApp connection limit reached. Your plan allows up to ${limits.maxWhatsAppConnections} connections.`)
    }

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
    agentId: v.optional(v.id("agents")),
    environment: v.optional(v.union(v.literal("development"), v.literal("production"), v.literal("eval"))),
  },
  returns: v.union(v.object({ messageId: v.id("messages"), threadId: v.id("threads") }), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_externalMessageId", (q) => q.eq("externalMessageId", args.messageId))
      .first()

    if (existing) {
      return null
    }

    const connection = await ctx.db.get(args.connectionId)
    if (!connection || !connection.agentId || connection.status !== "connected") {
      return null
    }

    const agentId = args.agentId ?? connection.agentId
    const environment = args.environment ?? connection.environment

    const externalId = `whatsapp:${args.connectionId}:${args.from}`
    let thread = await ctx.db
      .query("threads")
      .withIndex("by_external", (q) => q.eq("externalId", externalId))
      .first()

    const channelParams: Record<string, unknown> = {
      phoneNumber: args.from,
      lastInboundAt: args.timestamp,
    }
    if (args.contactName) channelParams.contactName = args.contactName

    if (thread && thread.organizationId === args.organizationId) {
      const existingParams = (thread.channelParams ?? {}) as Record<string, unknown>
      await ctx.db.patch(thread._id, {
        channel: "whatsapp",
        channelParams: { ...existingParams, ...channelParams },
        updatedAt: args.timestamp,
      })
    } else {
      const now = Date.now()
      const threadId = await ctx.db.insert("threads", {
        organizationId: args.organizationId,
        agentId,
        environment,
        channel: "whatsapp",
        channelParams,
        externalId,
        createdAt: now,
        updatedAt: now,
      })
      thread = await ctx.db.get(threadId)
    }

    const msgId = await ctx.db.insert("messages", {
      threadId: thread!._id,
      organizationId: args.organizationId,
      role: "user",
      content: args.text ?? "",
      externalMessageId: args.messageId,
      direction: "inbound",
      status: "received",
      channelData: {
        type: args.type,
        mediaCaption: args.mediaCaption,
        interactiveData: args.interactiveData,
        mediaDirectUrl: args.mediaDirectUrl,
        connectionId: args.connectionId,
      },
      createdAt: args.timestamp,
    })

    return { messageId: msgId, threadId: thread!._id }
  },
})

export const processOutboundBusinessAppMessage = internalMutation({
  args: {
    kapsoPhoneNumberId: v.string(),
    messageId: v.string(),
    timestamp: v.number(),
    text: v.optional(v.string()),
    type: v.string(),
    customerPhone: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_externalMessageId", (q) => q.eq("externalMessageId", args.messageId))
      .first()

    if (existing) {
      return null
    }

    const connection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_kapso_phone", (q) => q.eq("kapsoPhoneNumberId", args.kapsoPhoneNumberId))
      .first()

    if (!connection || !connection.agentId || connection.status !== "connected") {
      return null
    }

    const normalizedPhone = args.customerPhone.replace(/^\+/, "")
    const externalId = `whatsapp:${connection._id}:${normalizedPhone}`

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_external", (q) => q.eq("externalId", externalId))
      .first()

    if (!thread) {
      return null
    }

    await ctx.db.insert("messages", {
      threadId: thread._id,
      organizationId: connection.organizationId,
      role: "assistant",
      content: args.text ?? "",
      externalMessageId: args.messageId,
      direction: "outbound",
      status: "sent",
      channelData: {
        type: args.type,
        origin: "business_app",
        authorType: "human_operator",
        connectionId: connection._id,
      },
      createdAt: args.timestamp,
    })

    if (thread.agentPaused !== true) {
      const now = Date.now()
      await ctx.db.patch(thread._id, { agentPaused: true, updatedAt: now })
      await ctx.db.insert("messages", {
        threadId: thread._id,
        organizationId: connection.organizationId,
        role: "system",
        content: "Human takeover detected — a message was sent from the WhatsApp Business app. Agent paused.",
        channelData: { systemType: "human_takeover", visible: true },
        createdAt: now,
      })
    }

    return null
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
      .query("messages")
      .withIndex("by_externalMessageId", (q) => q.eq("externalMessageId", args.messageId))
      .first()

    if (msg) {
      const validStatuses = ["sent", "delivered", "read", "failed"]
      if (validStatuses.includes(args.status)) {
        const patch: Record<string, unknown> = {
          status: args.status as "sent" | "delivered" | "read" | "failed",
        }

        const cd = (msg.channelData ?? {}) as Record<string, unknown>
        if (args.status === "sent" && args.pricingCategory && !cd.creditsConsumed) {
          const billable = args.pricingBillable !== false

          const thread = await ctx.db.get(msg.threadId)
          const channelParams = (thread?.channelParams ?? {}) as Record<string, unknown>
          const phoneNumber = (channelParams.phoneNumber as string) ?? ""

          const cost = calculateWhatsAppCost(phoneNumber, args.pricingCategory, billable)

          patch.channelData = {
            ...cd,
            pricingBillable: billable,
            pricingModel: args.pricingModel,
            pricingCategory: args.pricingCategory,
            creditsConsumed: cost,
          }

          if (cost > 0 && msg.organizationId) {
            await ctx.scheduler.runAfter(0, deductCreditsRef, {
              organizationId: msg.organizationId,
              amount: cost,
              description: `WhatsApp ${args.pricingCategory} to +${phoneNumber}`,
              metadata: { messageId: msg._id, category: args.pricingCategory },
              costDriver: "whatsapp",
              channel: "whatsapp",
            } as any)
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
    messageId: v.id("messages"),
    mediaId: v.string(),
    kapsoPhoneNumberId: v.string(),
    mediaUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, downloadAndStoreMediaRef, {
      messageId: args.messageId,
      mediaId: args.mediaId,
      kapsoPhoneNumberId: args.kapsoPhoneNumberId,
      mediaUrl: args.mediaUrl,
    } as any)
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
    mediaDirectUrl: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    threadId: v.optional(v.id("threads")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId)

    if (args.threadId) {
      const thread = await ctx.db.get(args.threadId)
      if (thread?.agentPaused === true) {
        return null
      }
    }

    if (connection?.agentId && connection.status === "connected") {
      const attachments = args.mediaDirectUrl && args.mediaType === "image"
        ? [{ type: "image" as const, url: args.mediaDirectUrl, mimeType: "image/jpeg" }]
        : undefined
      await ctx.scheduler.runAfter(0, routeInboundToAgentRef, {
        organizationId: args.organizationId,
        phoneNumber: args.phoneNumber,
        text: args.text,
        environment: args.environment,
        agentId: connection.agentId,
        connectionId: args.connectionId,
        attachments,
        threadId: args.threadId,
      } as any)
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

    let externalIdPrefix: string | undefined
    if (args.connectionId) {
      externalIdPrefix = `whatsapp:${args.connectionId}:${args.phoneNumber}`
    }

    let thread
    if (externalIdPrefix) {
      thread = await ctx.db
        .query("threads")
        .withIndex("by_external", (q) => q.eq("externalId", externalIdPrefix))
        .first()
    }

    if (!thread) {
      const allThreads = await ctx.db
        .query("threads")
        .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
        .collect()
      thread = allThreads.find((t) => {
        if (t.channel !== "whatsapp") return false
        return t.externalId?.endsWith(`:${args.phoneNumber}`)
      })
    }

    if (!thread) return []

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .order("desc")
      .take(args.limit ?? 50)

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

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .order("desc")
      .take(200)

    const whatsappThreads = threads.filter((t) => t.channel === "whatsapp")

    const result = []
    for (const thread of whatsappThreads) {
      if (args.connectionId) {
        const parsed = thread.externalId ? parseWhatsAppExternalId(thread.externalId) : null
        if (!parsed || parsed.connectionId !== (args.connectionId as string)) continue
      }

      const lastMsg = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .order("desc")
        .first()

      const channelParams = (thread.channelParams ?? {}) as Record<string, unknown>
      const parsed = thread.externalId ? parseWhatsAppExternalId(thread.externalId) : null

      result.push({
        phoneNumber: (channelParams.phoneNumber as string) ?? parsed?.customerPhone ?? "",
        lastMessage: lastMsg?.content,
        lastMessageAt: lastMsg?.createdAt ?? thread.updatedAt,
        direction: lastMsg?.direction ?? "inbound",
      })

      if (result.length >= (args.limit ?? 50)) break
    }

    return result
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

export const registerOwnedTemplate = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    templateName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappOwnedTemplates")
      .withIndex("by_org_name", (q) =>
        q.eq("organizationId", args.organizationId).eq("templateName", args.templateName)
      )
      .first()
    if (existing) return null

    await ctx.db.insert("whatsappOwnedTemplates", {
      organizationId: args.organizationId,
      templateName: args.templateName,
      createdAt: Date.now(),
    })
    return null
  },
})

export const unregisterOwnedTemplate = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    templateName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappOwnedTemplates")
      .withIndex("by_org_name", (q) =>
        q.eq("organizationId", args.organizationId).eq("templateName", args.templateName)
      )
      .first()
    if (existing) {
      await ctx.db.delete(existing._id)
    }
    return null
  },
})

export const getOwnedTemplateNames = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("whatsappOwnedTemplates")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect()
    return rows.map((r) => r.templateName)
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

    const admin = await isOrgAdmin(ctx, auth)
    if (!admin) {
      const userRoles = await ctx.db
        .query("userRoles")
        .withIndex("by_user", (q: any) => q.eq("userId", auth.userId))
        .collect()
      const slugs = new Set<string>()
      for (const ur of userRoles) {
        const role = await ctx.db.get(ur.roleId)
        if (role && role.environment === thread.environment && role.organizationId === auth.organizationId && (role as any).agentAccess) {
          for (const slug of (role as any).agentAccess) slugs.add(slug)
        }
      }
      if (slugs.size > 0) {
        const agent = await ctx.db.get(thread.agentId)
        if (!agent || !slugs.has(agent.slug)) return []
      } else {
        return []
      }
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect()

    const seen = new Set<string>()
    const timeline = []
    for (const msg of messages) {
      if (msg.role === "system") {
        const scd = (msg.channelData ?? {}) as Record<string, unknown>
        if (!scd.visible) continue
      }
      if (msg.externalMessageId) {
        const dedupKey = `${msg.externalMessageId}:${msg.role}`
        if (seen.has(dedupKey)) continue
        seen.add(dedupKey)
      }
      const cd = (msg.channelData ?? {}) as Record<string, unknown>
      let mediaUrl: string | null = null
      if (cd.mediaStorageId) {
        mediaUrl = await ctx.storage.getUrl(cd.mediaStorageId as Id<"_storage">)
      }
      timeline.push({
        id: msg._id,
        direction: msg.direction ?? (msg.role === "user" ? "inbound" : "outbound"),
        type: cd.type ?? "text",
        text: msg.content,
        mediaUrl,
        mediaMimeType: cd.mediaMimeType,
        mediaCaption: cd.mediaCaption,
        mediaFileName: cd.mediaFileName,
        interactiveData: cd.interactiveData,
        status: msg.status,
        createdAt: msg.createdAt,
        toolCalls: msg.toolCalls,
        toolCallId: msg.toolCallId,
        role: msg.role,
        origin: cd.origin,
        systemType: cd.systemType,
        authorType: cd.authorType,
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

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(100)

    const statusMap: Record<string, string> = {}
    for (const msg of messages) {
      if (msg.direction === "outbound" && msg.status) {
        statusMap[msg.createdAt.toString()] = msg.status
      }
    }
    return statusMap
  },
})
