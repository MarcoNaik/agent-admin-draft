import { internalMutation, internalQuery } from "./_generated/server"

export const debugState = internalQuery({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect()
    const users = await ctx.db.query("users").collect()
    const memberships = await ctx.db.query("userOrganizations").collect()
    return { orgs, users, memberships }
  },
})

import { query } from "./_generated/server"

export const debugIdentity = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    return identity
  },
})

export const debugTest = query({
  args: {},
  handler: async () => {
    return { test: "works", timestamp: Date.now() }
  },
})

export const debugAllOrgs = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect()
    return orgs
  },
})

export const debugListOrgs = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: "Not authenticated", identity: null }
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user) {
      return { error: "User not found", identity, subject: identity.subject }
    }

    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    return { identity, user, memberships }
  },
})

import { v } from "convex/values"

export const manualSyncClerkOrg = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    clerkUserId: v.string(),
    userRole: v.union(v.literal("admin"), v.literal("member")),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()

    const now = Date.now()

    if (!org) {
      const orgId = await ctx.db.insert("organizations", {
        name: args.name,
        slug: args.slug,
        clerkOrgId: args.clerkOrgId,
        plan: "free",
        createdAt: now,
        updatedAt: now,
      })
      org = await ctx.db.get(orgId)
    }

    if (!org) throw new Error("Failed to create org")

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    if (!user) {
      const userId = await ctx.db.insert("users", {
        email: args.userEmail || `${args.clerkUserId}@unknown.com`,
        name: args.userName,
        clerkUserId: args.clerkUserId,
        createdAt: now,
        updatedAt: now,
      })
      user = await ctx.db.get(userId)
    }

    if (!user) throw new Error("Failed to create user")

    const existingMembership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", org._id)
      )
      .first()

    if (!existingMembership) {
      await ctx.db.insert("userOrganizations", {
        userId: user._id,
        organizationId: org._id,
        role: args.userRole,
        createdAt: now,
        updatedAt: now,
      })
    }

    return { orgId: org._id, userId: user._id }
  },
})

export const cleanupLegacyUserData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect()

    for (const user of users) {
      const userData = user as unknown as Record<string, unknown>
      if ("organizationId" in userData || "role" in userData) {
        const { organizationId, role, ...cleanUser } = userData
        await ctx.db.replace(user._id, {
          email: cleanUser.email as string,
          name: cleanUser.name as string | undefined,
          clerkUserId: cleanUser.clerkUserId as string,
          createdAt: cleanUser.createdAt as number,
          updatedAt: Date.now(),
          deletedAt: cleanUser.deletedAt as number | undefined,
        })
      }
    }

    return { cleaned: users.length }
  },
})

export const cleanupLegacyOrganizations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect()
    const deleted: string[] = []

    for (const org of orgs) {
      if (!org.clerkOrgId) {
        await ctx.db.delete(org._id)
        deleted.push(org.name)
      }
    }

    return { deleted }
  },
})

export const migrateOwnerToAdmin = internalMutation({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db.query("userOrganizations").collect()
    let updated = 0

    for (const membership of memberships) {
      if ((membership as unknown as { role: string }).role === "owner") {
        await ctx.db.patch(membership._id, { role: "admin" as const })
        updated++
      }
    }

    return { updated }
  },
})
