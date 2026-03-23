import { v } from "convex/values"
import { query, mutation, internalMutation } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { requireAuth } from "./lib/auth"
import { providerValidator } from "./lib/providers"

const MARKUP = 1.1

const processUsageEventRef = makeFunctionReference<"mutation">("sandboxSessions:processUsageEvent")
const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))
const keySourceValidator = v.optional(v.union(v.literal("platform"), v.literal("custom")))

export const create = mutation({
  args: {
    environment: environmentValidator,
    agentType: v.literal("opencode"),
    idleTimeoutMs: v.optional(v.number()),
    model: v.optional(v.string()),
    provider: v.optional(providerValidator),
    keySource: keySourceValidator,
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    if (args.keySource !== "custom") {
      const balance = await ctx.db
        .query("creditBalances")
        .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
        .first()
      if ((balance?.balance ?? 0) <= 0) {
        throw new Error("Insufficient credits")
      }
    }

    const existing = await ctx.db
      .query("sandboxSessions")
      .withIndex("by_org_env_user", (q) =>
        q.eq("organizationId", auth.organizationId)
          .eq("environment", args.environment)
          .eq("userId", auth.userId)
      )
      .collect()

    const active = existing.find((s) =>
      s.status === "provisioning" || s.status === "ready" || s.status === "active" || s.status === "idle"
    )

    if (active) {
      throw new Error("Active sandbox session already exists")
    }

    const now = Date.now()
    const model = args.model ?? "xai/grok-4-1-fast"
    const id = await ctx.db.insert("sandboxSessions", {
      organizationId: auth.organizationId,
      environment: args.environment,
      userId: auth.userId,
      status: "provisioning",
      sandboxProvider: "e2b",
      agentType: "opencode",
      lastActivityAt: now,
      idleTimeoutMs: args.idleTimeoutMs ?? 900000,
      createdAt: now,
      model,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCreditsConsumed: 0,
      provider: args.provider,
      keySource: args.keySource,
    })

    return id
  },
})

export const updateStatus = mutation({
  args: {
    id: v.id("sandboxSessions"),
    status: v.union(
      v.literal("provisioning"),
      v.literal("ready"),
      v.literal("active"),
      v.literal("idle"),
      v.literal("stopped"),
      v.literal("error")
    ),
    sandboxId: v.optional(v.string()),
    sandboxUrl: v.optional(v.string()),
    agentSessionId: v.optional(v.string()),
    acpServerId: v.optional(v.string()),
    apiKeyId: v.optional(v.id("apiKeys")),
    errorMessage: v.optional(v.string()),
    stoppedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const session = await ctx.db.get(args.id)
    if (!session || session.organizationId !== auth.organizationId) {
      throw new Error("Session not found")
    }

    const updates: Record<string, unknown> = { status: args.status }
    if (args.sandboxId !== undefined) updates.sandboxId = args.sandboxId
    if (args.sandboxUrl !== undefined) updates.sandboxUrl = args.sandboxUrl
    if (args.agentSessionId !== undefined) updates.agentSessionId = args.agentSessionId
    if (args.acpServerId !== undefined) updates.acpServerId = args.acpServerId
    if (args.apiKeyId !== undefined) updates.apiKeyId = args.apiKeyId
    if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage
    if (args.stoppedAt !== undefined) updates.stoppedAt = args.stoppedAt

    await ctx.db.patch(args.id, updates)
  },
})

export const getActive = query({
  args: {
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const sessions = await ctx.db
      .query("sandboxSessions")
      .withIndex("by_org_env_user", (q) =>
        q.eq("organizationId", auth.organizationId)
          .eq("environment", args.environment)
          .eq("userId", auth.userId)
      )
      .collect()

    return sessions.find((s) =>
      s.status === "provisioning" || s.status === "ready" || s.status === "active" || s.status === "idle"
    ) ?? null
  },
})

export const getActiveSafe = query({
  args: {
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const sessions = await ctx.db
      .query("sandboxSessions")
      .withIndex("by_org_env_user", (q) =>
        q.eq("organizationId", auth.organizationId)
          .eq("environment", args.environment)
          .eq("userId", auth.userId)
      )
      .collect()

    const session = sessions.find((s) =>
      s.status === "provisioning" || s.status === "ready" || s.status === "active" || s.status === "idle"
    )

    if (!session) return null

    return {
      _id: session._id,
      _creationTime: session._creationTime,
      organizationId: session.organizationId,
      environment: session.environment,
      userId: session.userId,
      status: session.status,
      sandboxProvider: session.sandboxProvider,
      agentType: session.agentType,
      lastActivityAt: session.lastActivityAt,
      idleTimeoutMs: session.idleTimeoutMs,
      createdAt: session.createdAt,
      errorMessage: session.errorMessage,
      stoppedAt: session.stoppedAt,
      totalInputTokens: session.totalInputTokens,
      totalOutputTokens: session.totalOutputTokens,
      totalCreditsConsumed: session.totalCreditsConsumed,
      model: session.model,
      provider: session.provider,
      keySource: session.keySource,
    }
  },
})

export const getById = query({
  args: { id: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const session = await ctx.db.get(args.id)
    if (!session || session.organizationId !== auth.organizationId) {
      return null
    }
    return session
  },
})

export const list = query({
  args: {
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    return await ctx.db
      .query("sandboxSessions")
      .withIndex("by_org_env_status", (q) =>
        q.eq("organizationId", auth.organizationId)
          .eq("environment", args.environment)
      )
      .collect()
  },
})

export const appendEvents = mutation({
  args: {
    sessionId: v.id("sandboxSessions"),
    events: v.array(v.object({
      sequence: v.number(),
      eventType: v.string(),
      sender: v.union(v.literal("agent"), v.literal("user"), v.literal("system")),
      payload: v.optional(v.any()),
      createdAt: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.organizationId !== auth.organizationId) {
      throw new Error("Session not found")
    }

    for (const event of args.events) {
      await ctx.db.insert("sandboxEvents", {
        sessionId: args.sessionId,
        sequence: event.sequence,
        eventType: event.eventType,
        sender: event.sender,
        payload: event.payload,
        createdAt: event.createdAt,
      })
    }

    await ctx.db.patch(args.sessionId, { lastActivityAt: Date.now() })
  },
})

export const getEvents = query({
  args: {
    sessionId: v.id("sandboxSessions"),
    afterSequence: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.organizationId !== auth.organizationId) {
      throw new Error("Session not found")
    }

    const afterSeq = args.afterSequence ?? -1
    const limit = args.limit ?? 200

    const events = await ctx.db
      .query("sandboxEvents")
      .withIndex("by_session_sequence", (q) =>
        q.eq("sessionId", args.sessionId).gt("sequence", afterSeq)
      )
      .take(limit)

    return events
  },
})

export const recordActivity = mutation({
  args: {
    id: v.id("sandboxSessions"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const session = await ctx.db.get(args.id)
    if (!session || session.organizationId !== auth.organizationId) {
      throw new Error("Session not found")
    }

    await ctx.db.patch(args.id, {
      lastActivityAt: Date.now(),
      status: session.status === "idle" ? "active" : session.status,
    })
  },
})

export const cleanup = mutation({
  args: {
    id: v.id("sandboxSessions"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const session = await ctx.db.get(args.id)
    if (!session || session.organizationId !== auth.organizationId) {
      throw new Error("Session not found")
    }

    await ctx.db.patch(args.id, {
      status: "stopped",
      stoppedAt: Date.now(),
    })
  },
})

export const markIdle = internalMutation({
  args: {
    id: v.id("sandboxSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id)
    if (!session) return

    if (session.status !== "active" && session.status !== "ready" && session.status !== "idle") return

    const now = Date.now()
    if (now - session.lastActivityAt > session.idleTimeoutMs) {
      await ctx.db.patch(args.id, {
        status: "stopped",
        stoppedAt: now,
      })
    }
  },
})

export const checkIdleSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const activeStatuses = ["provisioning", "ready", "active", "idle"] as const

    for (const status of activeStatuses) {
      const sessions = await ctx.db
        .query("sandboxSessions")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect()

      for (const session of sessions) {
        if (now - session.lastActivityAt > session.idleTimeoutMs) {
          await ctx.db.patch(session._id, {
            status: "stopped",
            stoppedAt: now,
          })
        }
      }
    }
  },
})

export const recordUsage = mutation({
  args: {
    sessionId: v.id("sandboxSessions"),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.organizationId !== auth.organizationId) {
      throw new Error("Session not found")
    }

    await ctx.scheduler.runAfter(0, processUsageEventRef, {
      sessionId: args.sessionId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
    } as any)
  },
})

export const processUsageEvent = internalMutation({
  args: {
    sessionId: v.id("sandboxSessions"),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) return

    const model = session.model ?? "xai/grok-4-1-fast"
    const openRouterId = model.indexOf("/") !== -1 ? model : ""
    const normalized = model.indexOf("/") !== -1 ? model.slice(model.indexOf("/") + 1) : model

    let dbPricing = null
    if (openRouterId) {
      dbPricing = await ctx.db
        .query("modelPricing")
        .withIndex("by_model", (q) => q.eq("modelId", openRouterId))
        .unique()
    }
    if (!dbPricing) {
      dbPricing = await ctx.db
        .query("modelPricing")
        .withIndex("by_model", (q) => q.eq("modelId", normalized))
        .unique()
    }

    let cost = 0
    if (dbPricing) {
      const inputCost = dbPricing.inputPerMTok * MARKUP
      const outputCost = dbPricing.outputPerMTok * MARKUP
      const costUsd = (args.inputTokens * inputCost + args.outputTokens * outputCost) / 1_000_000
      cost = Math.round(costUsd * 1_000_000)
    }

    await ctx.db.patch(args.sessionId, {
      totalInputTokens: (session.totalInputTokens ?? 0) + args.inputTokens,
      totalOutputTokens: (session.totalOutputTokens ?? 0) + args.outputTokens,
      totalCreditsConsumed: (session.totalCreditsConsumed ?? 0) + cost,
    })
  },
})
