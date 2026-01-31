import { v } from "convex/values"
import { query, mutation, internalMutation } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"

export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const user = await ctx.db.get(args.id)
    if (!user) {
      throw new Error("User not found")
    }
    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", auth.organizationId)
      )
      .first()
    if (!membership) {
      throw new Error("User not found in organization")
    }
    return { ...user, role: membership.role }
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
    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    const users = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId)
        if (!user || user.deletedAt) return null
        return { ...user, role: membership.role }
      })
    )

    return users.filter((u): u is NonNullable<typeof u> => u !== null)
  },
})

export const update = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const user = await ctx.db.get(args.id)

    if (!user) {
      throw new Error("User not found")
    }

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", auth.organizationId)
      )
      .first()

    if (!membership) {
      throw new Error("User not found in organization")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const user = await ctx.db.get(args.id)

    if (!user) {
      throw new Error("User not found")
    }

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", auth.organizationId)
      )
      .first()

    if (!membership) {
      throw new Error("User not found in organization")
    }

    await ctx.db.delete(membership._id)
    return { success: true }
  },
})

export const getOrCreateFromClerkNoOrg = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    if (existing) {
      if (args.name && args.name !== existing.name) {
        await ctx.db.patch(existing._id, {
          name: args.name,
          updatedAt: Date.now(),
        })
      }
      return existing._id
    }

    const now = Date.now()
    return await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      clerkUserId: args.clerkUserId,
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
      return { userId: existing._id, created: false }
    }

    const now = Date.now()
    const userId = await ctx.db.insert("users", {
      email,
      name,
      clerkUserId,
      createdAt: now,
      updatedAt: now,
    })

    return { userId, created: true }
  },
})
