import { v } from "convex/values"
import { query, mutation, internalMutation, internalQuery } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"

export const list = query({
  args: {
    agentId: v.optional(v.id("agents")),
    environment: v.optional(v.union(v.literal("development"), v.literal("production"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    if (args.agentId) {
      return await ctx.db
        .query("threads")
        .withIndex("by_agent_env", (q) => q.eq("agentId", args.agentId!).eq("environment", environment))
        .order("desc")
        .take(args.limit ?? 50)
    }

    return await ctx.db
      .query("threads")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", environment))
      .order("desc")
      .take(args.limit ?? 50)
  },
})

export const get = query({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const thread = await ctx.db.get(args.id)

    if (!thread || thread.organizationId !== auth.organizationId) {
      return null
    }

    return thread
  },
})

export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_external", (q) => q.eq("externalId", args.externalId))
      .first()

    if (!thread || thread.organizationId !== auth.organizationId) {
      return null
    }

    return thread
  },
})

export const getWithMessages = query({
  args: {
    id: v.id("threads"),
    messageLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const thread = await ctx.db.get(args.id)

    if (!thread || thread.organizationId !== auth.organizationId) {
      return null
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.id))
      .order("asc")
      .take(args.messageLimit ?? 100)

    return {
      ...thread,
      messages,
    }
  },
})

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    externalId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    environment: v.union(v.literal("development"), v.literal("production")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const agent = await ctx.db.get(args.agentId)
    if (!agent || agent.organizationId !== auth.organizationId) {
      throw new Error("Agent not found")
    }

    const now = Date.now()
    return await ctx.db.insert("threads", {
      organizationId: auth.organizationId,
      environment: args.environment,
      agentId: args.agentId,
      userId: auth.userId,
      externalId: args.externalId,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("threads"),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const thread = await ctx.db.get(args.id)

    if (!thread || thread.organizationId !== auth.organizationId) {
      throw new Error("Thread not found")
    }

    await ctx.db.patch(args.id, {
      metadata: args.metadata,
      updatedAt: Date.now(),
    })

    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const thread = await ctx.db.get(args.id)

    if (!thread || thread.organizationId !== auth.organizationId) {
      throw new Error("Thread not found")
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.id))
      .collect()

    for (const message of messages) {
      await ctx.db.delete(message._id)
    }

    await ctx.db.delete(args.id)
    return { success: true }
  },
})

export const addMessage = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    ),
    content: v.string(),
    toolCalls: v.optional(v.array(v.any())),
    toolCallId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const thread = await ctx.db.get(args.threadId)

    if (!thread || thread.organizationId !== auth.organizationId) {
      throw new Error("Thread not found")
    }

    const now = Date.now()

    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      toolCalls: args.toolCalls,
      toolCallId: args.toolCallId,
      createdAt: now,
    })

    await ctx.db.patch(args.threadId, { updatedAt: now })

    return messageId
  },
})

export const getMessages = query({
  args: {
    threadId: v.id("threads"),
    limit: v.optional(v.number()),
    before: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const thread = await ctx.db.get(args.threadId)

    if (!thread || thread.organizationId !== auth.organizationId) {
      throw new Error("Thread not found")
    }

    let messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .take(args.limit ?? 100)

    if (args.before) {
      messages = messages.filter((m) => m.createdAt < args.before!)
    }

    return messages
  },
})

export const getThreadInternal = internalQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId)
  },
})

export const getOrCreate = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    agentId: v.id("agents"),
    externalId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    metadata: v.optional(v.any()),
    environment: v.optional(v.union(v.literal("development"), v.literal("production"))),
  },
  handler: async (ctx, args) => {
    if (args.externalId) {
      const existing = await ctx.db
        .query("threads")
        .withIndex("by_external", (q) => q.eq("externalId", args.externalId))
        .first()

      if (existing && existing.organizationId === args.organizationId) {
        return existing._id
      }
    }

    const now = Date.now()
    return await ctx.db.insert("threads", {
      organizationId: args.organizationId,
      agentId: args.agentId,
      userId: args.userId,
      externalId: args.externalId,
      metadata: args.metadata,
      environment: args.environment ?? "development",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const appendMessages = internalMutation({
  args: {
    threadId: v.id("threads"),
    messages: v.array(
      v.object({
        role: v.union(
          v.literal("user"),
          v.literal("assistant"),
          v.literal("system"),
          v.literal("tool")
        ),
        content: v.string(),
        toolCalls: v.optional(v.array(v.any())),
        toolCallId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    for (const msg of args.messages) {
      await ctx.db.insert("messages", {
        threadId: args.threadId,
        role: msg.role,
        content: msg.content,
        toolCalls: msg.toolCalls,
        toolCallId: msg.toolCallId,
        createdAt: now,
      })
    }

    await ctx.db.patch(args.threadId, { updatedAt: now })

    return { success: true, count: args.messages.length }
  },
})
