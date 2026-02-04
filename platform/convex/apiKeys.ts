import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"
import { generateApiKey, hashApiKey } from "./lib/utils"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx)

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    return keys.map((k) => ({
      id: k._id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      permissions: k.permissions,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }))
  },
})

export const get = query({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const apiKey = await ctx.db.get(args.id)

    if (!apiKey || apiKey.organizationId !== auth.organizationId) {
      return null
    }

    return {
      id: apiKey._id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
    }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    permissions: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    environment: v.union(v.literal("development"), v.literal("production")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const { key, prefix } = generateApiKey()
    const keyHash = await hashApiKey(key)

    const now = Date.now()
    const id = await ctx.db.insert("apiKeys", {
      organizationId: auth.organizationId,
      environment: args.environment,
      name: args.name,
      keyHash,
      keyPrefix: prefix,
      permissions: args.permissions,
      expiresAt: args.expiresAt,
      createdAt: now,
    })

    return {
      id,
      key,
      name: args.name,
      keyPrefix: prefix,
      permissions: args.permissions,
      expiresAt: args.expiresAt,
      createdAt: now,
    }
  },
})

export const update = mutation({
  args: {
    id: v.id("apiKeys"),
    name: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const apiKey = await ctx.db.get(args.id)

    if (!apiKey || apiKey.organizationId !== auth.organizationId) {
      throw new Error("API key not found")
    }

    const updates: Record<string, unknown> = {}
    if (args.name !== undefined) updates.name = args.name
    if (args.permissions !== undefined) updates.permissions = args.permissions
    if (args.expiresAt !== undefined) updates.expiresAt = args.expiresAt

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const apiKey = await ctx.db.get(args.id)

    if (!apiKey || apiKey.organizationId !== auth.organizationId) {
      throw new Error("API key not found")
    }

    await ctx.db.delete(args.id)
    return { success: true }
  },
})

export const recordUsage = mutation({
  args: { keyPrefix: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_prefix", (q) => q.eq("keyPrefix", args.keyPrefix))
      .first()

    if (apiKey) {
      await ctx.db.patch(apiKey._id, { lastUsedAt: Date.now() })
    }
  },
})
