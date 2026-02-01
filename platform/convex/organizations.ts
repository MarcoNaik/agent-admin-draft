import { v } from "convex/values"
import { query, mutation, internalMutation, internalQuery } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"
import { Id } from "./_generated/dataModel"

export const get = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    if (auth.organizationId !== args.id) {
      throw new Error("Access denied")
    }
    return await ctx.db.get(args.id)
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first()
  },
})

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx)
    return await ctx.db.get(auth.organizationId)
  },
})

export const listMyOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user) {
      throw new Error(`User not found for subject: ${identity.subject}`)
    }

    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.organizationId)
        return org
          ? {
              id: org._id,
              name: org.name,
              slug: org.slug,
              role: m.role,
            }
          : null
      })
    )

    return orgs.filter((o): o is NonNullable<typeof o> => o !== null)
  },
})

export const debugListOrgsForUser = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    if (!user) {
      return { error: "User not found", clerkUserId: args.clerkUserId }
    }

    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.organizationId)
        return org ? { id: org._id, name: org.name, slug: org.slug, role: m.role } : null
      })
    )

    return {
      user: { id: user._id, email: user.email, name: user.name, clerkUserId: user.clerkUserId },
      memberships: memberships.length,
      orgs: orgs.filter(Boolean),
    }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    clerkOrgId: v.optional(v.string()),
    plan: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise"))
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first()

    if (existing) {
      throw new Error("Organization slug already exists")
    }

    const now = Date.now()
    return await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      clerkOrgId: args.clerkOrgId,
      plan: args.plan ?? "free",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    plan: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise"))
    ),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    if (auth.organizationId !== args.id) {
      throw new Error("Access denied")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.plan !== undefined) updates.plan = args.plan

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const getByClerkOrgId = internalQuery({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()
  },
})

export const getOrCreateFromClerk = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        updatedAt: Date.now(),
      })
      return existing._id
    }

    let slug = args.slug
    let counter = 0
    while (true) {
      const slugCheck = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()
      if (!slugCheck) break
      counter++
      slug = `${args.slug}-${counter}`
    }

    const now = Date.now()
    return await ctx.db.insert("organizations", {
      name: args.name,
      slug,
      clerkOrgId: args.clerkOrgId,
      plan: "free",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const markAsDeleted = internalMutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()

    if (!org) return

    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect()

    for (const membership of memberships) {
      await ctx.db.delete(membership._id)
    }
  },
})

export const syncMembership = internalMutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    clerkMembershipId: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()

    if (!org) {
      throw new Error(`Organization not found for clerkOrgId: ${args.clerkOrgId}`)
    }

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    const now = Date.now()

    if (!user) {
      const userId = await ctx.db.insert("users", {
        email: args.userEmail ?? `${args.clerkUserId}@unknown.com`,
        name: args.userName,
        clerkUserId: args.clerkUserId,
        createdAt: now,
        updatedAt: now,
      })
      user = await ctx.db.get(userId)
    }

    if (!user) {
      throw new Error("Failed to create user")
    }

    const existing = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", org._id)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        clerkMembershipId: args.clerkMembershipId,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert("userOrganizations", {
      userId: user._id,
      organizationId: org._id,
      role: args.role,
      clerkMembershipId: args.clerkMembershipId,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const removeMembership = internalMutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()

    if (!org) return

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    if (!user) return

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", org._id)
      )
      .first()

    if (membership) {
      await ctx.db.delete(membership._id)
    }
  },
})

export const getUserMembership = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId)
      )
      .first()
  },
})

export const getInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.organizationId)
  },
})
