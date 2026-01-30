import { v } from "convex/values"
import { query, mutation, internalQuery } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"
import { generateSlug } from "./lib/utils"

export const list = query({
  args: {
    status: v.optional(
      v.union(v.literal("active"), v.literal("paused"), v.literal("deleted"))
    ),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    let q = ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))

    const agents = await q.collect()

    if (args.status) {
      return agents.filter((a) => a.status === args.status)
    }

    return agents.filter((a) => a.status !== "deleted")
  },
})

export const get = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const agent = await ctx.db.get(args.id)

    if (!agent || agent.organizationId !== auth.organizationId) {
      return null
    }

    return agent
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    return await ctx.db
      .query("agents")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", args.slug)
      )
      .first()
  },
})

export const getWithConfig = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const agent = await ctx.db.get(args.id)

    if (!agent || agent.organizationId !== auth.organizationId) {
      return null
    }

    let devConfig = null
    let prodConfig = null

    if (agent.developmentConfigId) {
      devConfig = await ctx.db.get(agent.developmentConfigId)
    }

    if (agent.productionConfigId) {
      prodConfig = await ctx.db.get(agent.productionConfigId)
    }

    return {
      ...agent,
      developmentConfig: devConfig,
      productionConfig: prodConfig,
    }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const slug = args.slug || generateSlug(args.name)

    const existing = await ctx.db
      .query("agents")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", slug)
      )
      .first()

    if (existing) {
      throw new Error("Agent with this slug already exists")
    }

    const now = Date.now()
    return await ctx.db.insert("agents", {
      organizationId: auth.organizationId,
      name: args.name,
      slug,
      description: args.description,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("agents"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("paused"), v.literal("deleted"))
    ),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const agent = await ctx.db.get(args.id)

    if (!agent || agent.organizationId !== auth.organizationId) {
      throw new Error("Agent not found")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description
    if (args.status !== undefined) updates.status = args.status

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const agent = await ctx.db.get(args.id)

    if (!agent || agent.organizationId !== auth.organizationId) {
      throw new Error("Agent not found")
    }

    await ctx.db.patch(args.id, {
      status: "deleted",
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const syncDevelopment = mutation({
  args: {
    agentId: v.id("agents"),
    config: v.object({
      name: v.string(),
      version: v.string(),
      systemPrompt: v.string(),
      model: v.object({
        provider: v.string(),
        name: v.string(),
        temperature: v.optional(v.number()),
        maxTokens: v.optional(v.number()),
      }),
      tools: v.array(
        v.object({
          name: v.string(),
          description: v.string(),
          parameters: v.any(),
          handlerCode: v.optional(v.string()),
          isBuiltin: v.boolean(),
        })
      ),
    }),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const agent = await ctx.db.get(args.agentId)

    if (!agent || agent.organizationId !== auth.organizationId) {
      throw new Error("Agent not found")
    }

    const now = Date.now()

    const existingConfig = agent.developmentConfigId
      ? await ctx.db.get(agent.developmentConfigId)
      : null

    if (existingConfig) {
      await ctx.db.patch(existingConfig._id, {
        ...args.config,
        environment: "development",
        deployedBy: auth.userId,
      })
    } else {
      const configId = await ctx.db.insert("agentConfigs", {
        agentId: args.agentId,
        ...args.config,
        environment: "development",
        createdAt: now,
        deployedBy: auth.userId,
      })

      await ctx.db.patch(args.agentId, {
        developmentConfigId: configId,
        updatedAt: now,
      })
    }

    return { success: true }
  },
})

export const deploy = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const agent = await ctx.db.get(args.agentId)

    if (!agent || agent.organizationId !== auth.organizationId) {
      throw new Error("Agent not found")
    }

    if (!agent.developmentConfigId) {
      throw new Error("No development configuration to deploy")
    }

    const devConfig = await ctx.db.get(agent.developmentConfigId)
    if (!devConfig) {
      throw new Error("Development configuration not found")
    }

    const now = Date.now()

    const prodConfigId = await ctx.db.insert("agentConfigs", {
      agentId: args.agentId,
      name: devConfig.name,
      version: devConfig.version,
      systemPrompt: devConfig.systemPrompt,
      model: devConfig.model,
      tools: devConfig.tools,
      environment: "production",
      createdAt: now,
      deployedBy: auth.userId,
    })

    await ctx.db.patch(args.agentId, {
      productionConfigId: prodConfigId,
      updatedAt: now,
    })

    return { success: true, configId: prodConfigId }
  },
})

export const getActiveConfig = internalQuery({
  args: {
    agentId: v.id("agents"),
    environment: v.optional(
      v.union(v.literal("development"), v.literal("production"))
    ),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId)
    if (!agent) {
      throw new Error("Agent not found")
    }

    const env = args.environment ?? "production"
    const configId =
      env === "production"
        ? agent.productionConfigId
        : agent.developmentConfigId

    if (!configId) {
      throw new Error(`No ${env} configuration found`)
    }

    const config = await ctx.db.get(configId)
    if (!config) {
      throw new Error("Configuration not found")
    }

    return config
  },
})
