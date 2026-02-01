import { v } from "convex/values"
import { query, mutation, internalQuery } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"
import { generateSlug } from "./lib/utils"
import { buildActorContext, assertCanPerform } from "./lib/permissions"

export const list = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx)

    return await ctx.db
      .query("entityTypes")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()
  },
})

export const get = query({
  args: { id: v.id("entityTypes") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const entityType = await ctx.db.get(args.id)

    if (!entityType || entityType.organizationId !== auth.organizationId) {
      return null
    }

    return entityType
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    return await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", args.slug)
      )
      .first()
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
    schema: v.any(),
    indexMapping: v.optional(v.any()),
    searchFields: v.optional(v.array(v.string())),
    displayConfig: v.optional(v.any()),
  },
  returns: v.id("entityTypes"),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    await assertCanPerform(ctx, actor, "create", "entityType")

    const slug = args.slug || generateSlug(args.name)

    const existing = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", slug)
      )
      .first()

    if (existing) {
      throw new Error("Entity type with this slug already exists")
    }

    const now = Date.now()
    return await ctx.db.insert("entityTypes", {
      organizationId: auth.organizationId,
      name: args.name,
      slug,
      schema: args.schema,
      indexMapping: args.indexMapping,
      searchFields: args.searchFields,
      displayConfig: args.displayConfig,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("entityTypes"),
    name: v.optional(v.string()),
    schema: v.optional(v.any()),
    indexMapping: v.optional(v.any()),
    searchFields: v.optional(v.array(v.string())),
    displayConfig: v.optional(v.any()),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const entityType = await ctx.db.get(args.id)

    if (!entityType || entityType.organizationId !== auth.organizationId) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    await assertCanPerform(ctx, actor, "update", "entityType")

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.schema !== undefined) updates.schema = args.schema
    if (args.indexMapping !== undefined) updates.indexMapping = args.indexMapping
    if (args.searchFields !== undefined) updates.searchFields = args.searchFields
    if (args.displayConfig !== undefined)
      updates.displayConfig = args.displayConfig

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: { id: v.id("entityTypes") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const entityType = await ctx.db.get(args.id)

    if (!entityType || entityType.organizationId !== auth.organizationId) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    await assertCanPerform(ctx, actor, "delete", "entityType")

    const entities = await ctx.db
      .query("entities")
      .withIndex("by_org_type", (q) =>
        q.eq("organizationId", auth.organizationId).eq("entityTypeId", args.id)
      )
      .first()

    if (entities) {
      throw new Error("Cannot delete entity type with existing entities")
    }

    await ctx.db.delete(args.id)
    return { success: true }
  },
})

export const listInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("entityTypes")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect()
  },
})
