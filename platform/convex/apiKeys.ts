import { v } from "convex/values"
import { query, mutation, internalMutation, internalQuery } from "./_generated/server"
import { getAuthContext, requireAuth, requireOrgAdmin } from "./lib/auth"
import { generateApiKey, hashApiKey } from "./lib/utils"


export const list = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx)

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    return keys
      .filter((k) => k.type !== "studio")
      .map((k) => ({
        id: k._id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        permissions: k.permissions,
        environment: k.environment,
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
    environment: v.union(v.literal("development"), v.literal("production"), v.literal("eval")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

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
    await requireOrgAdmin(ctx, auth)
    const apiKey = await ctx.db.get(args.id)

    if (!apiKey || apiKey.organizationId !== auth.organizationId) {
      throw new Error("API key not found")
    }

    if (apiKey.type === "studio") {
      throw new Error("Studio keys cannot be modified")
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
    await requireOrgAdmin(ctx, auth)
    const apiKey = await ctx.db.get(args.id)

    if (!apiKey || apiKey.organizationId !== auth.organizationId) {
      throw new Error("API key not found")
    }

    if (apiKey.type === "studio") {
      throw new Error("Studio keys cannot be deleted")
    }

    await ctx.db.delete(args.id)
    return { success: true }
  },
})

export const recordUsage = internalMutation({
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

export const ensureStudioKey = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    environment: v.union(v.literal("development"), v.literal("production"), v.literal("eval")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment)
      )
      .collect()

    const studioKey = existing.find((k) => k.type === "studio")
    if (studioKey && studioKey.rawKey) {
      return { id: studioKey._id, key: studioKey.rawKey }
    }
    if (studioKey && !studioKey.rawKey) {
      const { key, prefix } = generateApiKey()
      const keyHash = await hashApiKey(key)
      await ctx.db.patch(studioKey._id, { rawKey: key, keyHash, keyPrefix: prefix })
      return { id: studioKey._id, key }
    }

    const { key, prefix } = generateApiKey()
    const keyHash = await hashApiKey(key)
    const now = Date.now()

    const id = await ctx.db.insert("apiKeys", {
      organizationId: args.organizationId,
      environment: args.environment,
      name: "Studio",
      keyHash,
      keyPrefix: prefix,
      permissions: ["*"],
      createdAt: now,
      type: "studio",
      rawKey: key,
    })

    return { id, key }
  },
})

export const cleanupSandboxKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allKeys = await ctx.db.query("apiKeys").collect()
    let deleted = 0
    for (const key of allKeys) {
      if (key.name.startsWith("sandbox-")) {
        await ctx.db.delete(key._id)
        deleted++
      }
    }
    return { deleted }
  },
})

export const getStudioKey = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    environment: v.union(v.literal("development"), v.literal("production"), v.literal("eval")),
  },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment)
      )
      .collect()

    const studioKey = keys.find((k) => k.type === "studio")
    if (!studioKey || !studioKey.rawKey) return null
    return { id: studioKey._id, key: studioKey.rawKey }
  },
})

export const getStudioKeyStatus = query({
  args: {
    environment: v.union(v.literal("development"), v.literal("production"), v.literal("eval")),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment)
      )
      .collect()

    const studioKey = keys.find((k) => k.type === "studio")
    if (!studioKey) return null

    return {
      active: true,
      keyPrefix: studioKey.keyPrefix,
      lastUsedAt: studioKey.lastUsedAt,
      createdAt: studioKey.createdAt,
    }
  },
})
