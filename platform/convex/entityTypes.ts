import { v } from "convex/values"
import { query, mutation, internalQuery } from "./_generated/server"
import { getAuthContextForOrg, requireAuth } from "./lib/auth"
import { generateSlug } from "./lib/utils"
import { buildActorContext, assertCanPerform } from "./lib/permissions"

export const list = query({
  args: {
    environment: v.optional(v.union(v.literal("development"), v.literal("production"), v.literal("eval"))),
    organizationId: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
    const environment = args.environment ?? "development"

    return await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment)
      )
      .collect()
  },
})

export const get = query({
  args: {
    id: v.id("entityTypes"),
    organizationId: v.optional(v.string()),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
    const entityType = await ctx.db.get(args.id)

    if (!entityType || entityType.organizationId !== auth.organizationId) {
      return null
    }

    return entityType
  },
})

export const getBySlug = query({
  args: {
    slug: v.string(),
    environment: v.optional(v.union(v.literal("development"), v.literal("production"), v.literal("eval"))),
    organizationId: v.optional(v.string()),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
    const environment = args.environment ?? "development"

    return await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("slug", args.slug)
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
    boundToRole: v.optional(v.string()),
    userIdField: v.optional(v.string()),
    environment: v.union(v.literal("development"), v.literal("production"), v.literal("eval")),
  },
  returns: v.id("entityTypes"),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId as unknown as string,
      environment: args.environment,
    })

    await assertCanPerform(ctx, actor, "create", "entityType")

    const slug = args.slug || generateSlug(args.name)

    const existing = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment).eq("slug", slug)
      )
      .first()

    if (existing) {
      throw new Error("Entity type with this slug already exists")
    }

    const now = Date.now()
    return await ctx.db.insert("entityTypes", {
      organizationId: auth.organizationId,
      environment: args.environment,
      name: args.name,
      slug,
      schema: args.schema,
      indexMapping: args.indexMapping,
      searchFields: args.searchFields,
      displayConfig: args.displayConfig,
      boundToRole: args.boundToRole,
      userIdField: args.userIdField,
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
    boundToRole: v.optional(v.string()),
    userIdField: v.optional(v.string()),
    environment: v.union(v.literal("development"), v.literal("production"), v.literal("eval")),
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
      actorId: auth.userId as unknown as string,
      environment: args.environment,
    })

    await assertCanPerform(ctx, actor, "update", "entityType")

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.schema !== undefined) updates.schema = args.schema
    if (args.indexMapping !== undefined) updates.indexMapping = args.indexMapping
    if (args.searchFields !== undefined) updates.searchFields = args.searchFields
    if (args.displayConfig !== undefined)
      updates.displayConfig = args.displayConfig
    if (args.boundToRole !== undefined) updates.boundToRole = args.boundToRole
    if (args.userIdField !== undefined) updates.userIdField = args.userIdField

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: {
    id: v.id("entityTypes"),
    environment: v.union(v.literal("development"), v.literal("production"), v.literal("eval")),
  },
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
      actorId: auth.userId as unknown as string,
      environment: args.environment,
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
  args: {
    organizationId: v.id("organizations"),
    environment: v.optional(v.union(v.literal("development"), v.literal("production"), v.literal("eval"))),
  },
  handler: async (ctx, args) => {
    if (args.environment) {
      return await ctx.db
        .query("entityTypes")
        .withIndex("by_org_env", (q) => q.eq("organizationId", args.organizationId).eq("environment", args.environment!))
        .collect()
    }
    return await ctx.db
      .query("entityTypes")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect()
  },
})
