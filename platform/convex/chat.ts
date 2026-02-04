import { v } from "convex/values"
import { action, query, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"

interface AuthInfo {
  userId: Id<"users">
  organizationId: Id<"organizations">
}

export const send = action({
  args: {
    agentId: v.id("agents"),
    message: v.string(),
    threadId: v.optional(v.id("threads")),
    environment: v.optional(v.union(v.literal("development"), v.literal("production"))),
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
    const auth = await ctx.runQuery(internal.chat.getAuthInfo) as AuthInfo | null

    if (!auth) {
      throw new Error("Not authenticated")
    }

    return await ctx.runAction(internal.agent.chatAuthenticated, {
      organizationId: auth.organizationId,
      userId: auth.userId,
      agentId: args.agentId,
      message: args.message,
      threadId: args.threadId,
      environment: args.environment,
    })
  },
})

export const sendBySlug = action({
  args: {
    slug: v.string(),
    message: v.string(),
    threadId: v.optional(v.id("threads")),
    environment: v.optional(v.union(v.literal("development"), v.literal("production"))),
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
    const auth = await ctx.runQuery(internal.chat.getAuthInfo) as AuthInfo | null

    if (!auth) {
      throw new Error("Not authenticated")
    }

    const agent = await ctx.runQuery(internal.agent.getAgentBySlugInternal, {
      slug: args.slug,
      organizationId: auth.organizationId,
    }) as { _id: Id<"agents"> } | null

    if (!agent) {
      throw new Error(`No agent with slug "${args.slug}" exists`)
    }

    return await ctx.runAction(internal.agent.chatAuthenticated, {
      organizationId: auth.organizationId,
      userId: auth.userId,
      agentId: agent._id,
      message: args.message,
      threadId: args.threadId,
      environment: args.environment,
    })
  },
})

export const getAuthInfo = internalQuery({
  args: {},
  returns: v.union(
    v.object({
      userId: v.id("users"),
      organizationId: v.id("organizations"),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const clerkUserId = identity.subject
    const clerkOrgId = (identity as { org_id?: string }).org_id

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .first()

    if (!user) {
      return null
    }

    if (clerkOrgId) {
      const clerkOrg = await ctx.db
        .query("organizations")
        .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", clerkOrgId))
        .first()

      if (clerkOrg) {
        const membership = await ctx.db
          .query("userOrganizations")
          .withIndex("by_user_org", (q) =>
            q.eq("userId", user._id).eq("organizationId", clerkOrg._id)
          )
          .first()

        if (membership) {
          return {
            userId: user._id,
            organizationId: clerkOrg._id,
          }
        }
      }
    }

    const firstMembership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first()

    if (!firstMembership) {
      return null
    }

    return {
      userId: user._id,
      organizationId: firstMembership.organizationId,
    }
  },
})

export const getAgentBySlug = query({
  args: { slug: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const clerkUserId = identity.subject
    const clerkOrgId = (identity as { org_id?: string }).org_id

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .first()

    if (!user) {
      return null
    }

    let organizationId: Id<"organizations"> | null = null

    if (clerkOrgId) {
      const clerkOrg = await ctx.db
        .query("organizations")
        .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", clerkOrgId))
        .first()

      if (clerkOrg) {
        const membership = await ctx.db
          .query("userOrganizations")
          .withIndex("by_user_org", (q) =>
            q.eq("userId", user._id).eq("organizationId", clerkOrg._id)
          )
          .first()

        if (membership) {
          organizationId = clerkOrg._id
        }
      }
    }

    if (!organizationId) {
      const firstMembership = await ctx.db
        .query("userOrganizations")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first()

      if (!firstMembership) {
        return null
      }
      organizationId = firstMembership.organizationId
    }

    const agent = await ctx.db
      .query("agents")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", organizationId!).eq("slug", args.slug)
      )
      .first()

    if (!agent || agent.status === "deleted") {
      return null
    }

    const devConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) => q.eq("agentId", agent._id).eq("environment", "development"))
      .first()
    const prodConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) => q.eq("agentId", agent._id).eq("environment", "production"))
      .first()

    return {
      ...agent,
      developmentConfig: devConfig,
      productionConfig: prodConfig,
    }
  },
})
