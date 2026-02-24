import { v } from "convex/values"
import { query, action, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"

export const getPublicAgent = query({
  args: {
    orgSlug: v.string(),
    agentSlug: v.string(),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first()

    if (!org) return null

    const agent = await ctx.db
      .query("agents")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", org._id).eq("slug", args.agentSlug)
      )
      .first()

    if (!agent || agent.status !== "active") return null

    const prodConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) =>
        q.eq("agentId", agent._id).eq("environment", "production")
      )
      .first()

    if (!prodConfig) return null

    return {
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      model: { name: prodConfig.model.name },
      orgName: org.name,
    }
  },
})

export const getPublicThreadMessages = query({
  args: { threadId: v.id("threads") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .take(100)
  },
})

export const resolvePublicAgent = internalQuery({
  args: {
    orgSlug: v.string(),
    agentSlug: v.string(),
  },
  returns: v.union(
    v.object({
      organizationId: v.id("organizations"),
      agentId: v.id("agents"),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first()

    if (!org) return null

    const agent = await ctx.db
      .query("agents")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", org._id).eq("slug", args.agentSlug)
      )
      .first()

    if (!agent || agent.status !== "active") return null

    const prodConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) =>
        q.eq("agentId", agent._id).eq("environment", "production")
      )
      .first()

    if (!prodConfig) return null

    return {
      organizationId: org._id,
      agentId: agent._id,
    }
  },
})

export const sendPublicChat = action({
  args: {
    orgSlug: v.string(),
    agentSlug: v.string(),
    message: v.string(),
    threadId: v.optional(v.id("threads")),
  },
  returns: v.object({
    message: v.string(),
    threadId: v.id("threads"),
    usage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
    }),
  }),
  handler: async (ctx, args): Promise<{
    message: string
    threadId: Id<"threads">
    usage: { inputTokens: number; outputTokens: number; totalTokens: number }
  }> => {
    const resolved = await ctx.runQuery(internal.publicChat.resolvePublicAgent, {
      orgSlug: args.orgSlug,
      agentSlug: args.agentSlug,
    })

    if (!resolved) {
      throw new Error("Agent not found or not available")
    }

    return await ctx.runAction(internal.agent.chatAuthenticated, {
      organizationId: resolved.organizationId,
      userId: undefined,
      agentId: resolved.agentId,
      message: args.message,
      threadId: args.threadId,
      environment: "production",
    })
  },
})
