import { v } from "convex/values"
import { query, mutation, internalMutation } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"

export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const user = await ctx.db.get(args.id)
    if (!user || user.organizationId !== auth.organizationId) {
      throw new Error("User not found")
    }
    return user
  },
})

export const getByClerkId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()
  },
})

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .first()
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx)
    return await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect()
  },
})

export const create = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    clerkUserId: v.string(),
    organizationId: v.id("organizations"),
    role: v.optional(
      v.union(v.literal("owner"), v.literal("admin"), v.literal("member"))
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    if (existing) {
      throw new Error("User already exists")
    }

    const now = Date.now()
    return await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      clerkUserId: args.clerkUserId,
      organizationId: args.organizationId,
      role: args.role ?? "member",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    role: v.optional(
      v.union(v.literal("owner"), v.literal("admin"), v.literal("member"))
    ),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const user = await ctx.db.get(args.id)

    if (!user || user.organizationId !== auth.organizationId) {
      throw new Error("User not found")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.role !== undefined) updates.role = args.role

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const user = await ctx.db.get(args.id)

    if (!user || user.organizationId !== auth.organizationId) {
      throw new Error("User not found")
    }

    await ctx.db.patch(args.id, { deletedAt: Date.now() })
    return { success: true }
  },
})

export const getOrCreateFromClerk = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    if (existing) {
      return existing._id
    }

    const now = Date.now()
    return await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      clerkUserId: args.clerkUserId,
      organizationId: args.organizationId,
      role: "member",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const clerkUserId = identity.subject
    const email = identity.email ?? `${clerkUserId}@unknown.com`
    const name = identity.name ?? identity.nickname ?? undefined

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .first()

    if (existing) {
      return { userId: existing._id, organizationId: existing.organizationId, created: false }
    }

    const now = Date.now()
    const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-")

    const organizationId = await ctx.db.insert("organizations", {
      name: name ? `${name}'s Workspace` : "My Workspace",
      slug: `${slug}-${now}`,
      plan: "free",
      createdAt: now,
      updatedAt: now,
    })

    const userId = await ctx.db.insert("users", {
      email,
      name,
      clerkUserId,
      organizationId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    })

    return { userId, organizationId, created: true }
  },
})
