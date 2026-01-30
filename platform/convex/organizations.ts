import { v } from "convex/values"
import { query, mutation, internalMutation } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"

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

export const getOrCreatePersonal = internalMutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const personalSlug = `personal-${args.clerkUserId.slice(-8)}`

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", personalSlug))
      .first()

    if (existing) {
      return existing._id
    }

    const now = Date.now()
    return await ctx.db.insert("organizations", {
      name: `${args.name}'s Workspace`,
      slug: personalSlug,
      plan: "free",
      createdAt: now,
      updatedAt: now,
    })
  },
})
