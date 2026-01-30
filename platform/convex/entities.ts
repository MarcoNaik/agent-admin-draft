import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"
import { buildSearchText } from "./lib/utils"

export const list = query({
  args: {
    entityTypeId: v.optional(v.id("entityTypes")),
    entityTypeSlug: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    let entityTypeId = args.entityTypeId

    if (!entityTypeId && args.entityTypeSlug) {
      const slug = args.entityTypeSlug
      const entityType = await ctx.db
        .query("entityTypes")
        .withIndex("by_org_slug", (q) =>
          q
            .eq("organizationId", auth.organizationId)
            .eq("slug", slug)
        )
        .first()

      if (!entityType) {
        return []
      }
      entityTypeId = entityType._id
    }

    if (!entityTypeId) {
      throw new Error("entityTypeId or entityTypeSlug required")
    }

    const typeId = entityTypeId
    const status = args.status

    let q = status
      ? ctx.db
          .query("entities")
          .withIndex("by_org_type_status", (q) =>
            q
              .eq("organizationId", auth.organizationId)
              .eq("entityTypeId", typeId)
              .eq("status", status)
          )
      : ctx.db
          .query("entities")
          .withIndex("by_org_type", (q) =>
            q
              .eq("organizationId", auth.organizationId)
              .eq("entityTypeId", typeId)
          )

    const entities = await q.take(args.limit ?? 100)
    return entities.filter((e) => !e.deletedAt)
  },
})

export const get = query({
  args: { id: v.id("entities") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const entity = await ctx.db.get(args.id)

    if (!entity || entity.organizationId !== auth.organizationId) {
      return null
    }

    if (entity.deletedAt) {
      return null
    }

    return entity
  },
})

export const getWithType = query({
  args: { id: v.id("entities") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const entity = await ctx.db.get(args.id)

    if (!entity || entity.organizationId !== auth.organizationId) {
      return null
    }

    if (entity.deletedAt) {
      return null
    }

    const entityType = await ctx.db.get(entity.entityTypeId)

    return {
      ...entity,
      entityType,
    }
  },
})

export const search = query({
  args: {
    entityTypeSlug: v.optional(v.string()),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    const results = await ctx.db
      .query("entities")
      .withSearchIndex("search_text", (q) => q.search("searchText", args.query))
      .take(args.limit ?? 25)

    const filtered = results.filter(
      (e) => e.organizationId === auth.organizationId && !e.deletedAt
    )

    if (args.entityTypeSlug) {
      const slug = args.entityTypeSlug
      const entityType = await ctx.db
        .query("entityTypes")
        .withIndex("by_org_slug", (q) =>
          q
            .eq("organizationId", auth.organizationId)
            .eq("slug", slug)
        )
        .first()

      if (!entityType) return []
      return filtered.filter((e) => e.entityTypeId === entityType._id)
    }

    return filtered
  },
})

export const create = mutation({
  args: {
    entityTypeId: v.optional(v.id("entityTypes")),
    entityTypeSlug: v.optional(v.string()),
    data: v.any(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    let entityTypeId = args.entityTypeId

    if (!entityTypeId && args.entityTypeSlug) {
      const slug = args.entityTypeSlug
      const foundType = await ctx.db
        .query("entityTypes")
        .withIndex("by_org_slug", (q) =>
          q
            .eq("organizationId", auth.organizationId)
            .eq("slug", slug)
        )
        .first()

      if (!foundType) {
        throw new Error(`Entity type ${slug} not found`)
      }
      entityTypeId = foundType._id
    }

    if (!entityTypeId) {
      throw new Error("entityTypeId or entityTypeSlug required")
    }

    const entityType = await ctx.db.get(entityTypeId)
    if (!entityType || entityType.organizationId !== auth.organizationId) {
      throw new Error("Entity type not found")
    }

    const now = Date.now()
    const searchText = buildSearchText(args.data, entityType.searchFields ?? undefined)

    const entityId = await ctx.db.insert("entities", {
      organizationId: auth.organizationId,
      entityTypeId,
      status: args.status ?? "active",
      data: args.data,
      searchText,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      entityId,
      entityTypeSlug: entityType.slug,
      eventType: `${entityType.slug}.created`,
      schemaVersion: 1,
      actorId: auth.userId,
      actorType: auth.actorType,
      payload: { data: args.data },
      timestamp: now,
    })

    return entityId
  },
})

export const update = mutation({
  args: {
    id: v.id("entities"),
    data: v.any(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const entity = await ctx.db.get(args.id)

    if (!entity || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
    }

    if (entity.deletedAt) {
      throw new Error("Entity has been deleted")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    const mergedData = { ...entity.data, ...args.data }
    const now = Date.now()

    const updates: Record<string, unknown> = {
      data: mergedData,
      searchText: buildSearchText(mergedData, entityType?.searchFields ?? undefined),
      updatedAt: now,
    }

    if (args.status !== undefined) {
      updates.status = args.status
    }

    await ctx.db.patch(args.id, updates)

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      entityId: args.id,
      entityTypeSlug: entityType?.slug,
      eventType: `${entityType?.slug ?? "entity"}.updated`,
      schemaVersion: 1,
      actorId: auth.userId,
      actorType: auth.actorType,
      payload: { changes: args.data },
      timestamp: now,
    })

    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: { id: v.id("entities") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const entity = await ctx.db.get(args.id)

    if (!entity || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    const now = Date.now()

    await ctx.db.patch(args.id, { deletedAt: now })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      entityId: args.id,
      entityTypeSlug: entityType?.slug,
      eventType: `${entityType?.slug ?? "entity"}.deleted`,
      schemaVersion: 1,
      actorId: auth.userId,
      actorType: auth.actorType,
      payload: {},
      timestamp: now,
    })

    return { success: true }
  },
})

export const link = mutation({
  args: {
    fromId: v.id("entities"),
    toId: v.id("entities"),
    relationType: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const fromEntity = await ctx.db.get(args.fromId)
    const toEntity = await ctx.db.get(args.toId)

    if (
      !fromEntity ||
      fromEntity.organizationId !== auth.organizationId ||
      !toEntity ||
      toEntity.organizationId !== auth.organizationId
    ) {
      throw new Error("Entity not found")
    }

    const existing = await ctx.db
      .query("entityRelations")
      .withIndex("by_from", (q) =>
        q.eq("fromEntityId", args.fromId).eq("relationType", args.relationType)
      )
      .filter((q) => q.eq(q.field("toEntityId"), args.toId))
      .first()

    if (existing) {
      throw new Error("Relation already exists")
    }

    return await ctx.db.insert("entityRelations", {
      organizationId: auth.organizationId,
      fromEntityId: args.fromId,
      toEntityId: args.toId,
      relationType: args.relationType,
      metadata: args.metadata,
      createdAt: Date.now(),
    })
  },
})

export const unlink = mutation({
  args: {
    fromId: v.id("entities"),
    toId: v.id("entities"),
    relationType: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const relation = await ctx.db
      .query("entityRelations")
      .withIndex("by_from", (q) =>
        q.eq("fromEntityId", args.fromId).eq("relationType", args.relationType)
      )
      .filter((q) => q.eq(q.field("toEntityId"), args.toId))
      .first()

    if (!relation || relation.organizationId !== auth.organizationId) {
      throw new Error("Relation not found")
    }

    await ctx.db.delete(relation._id)
    return { success: true }
  },
})

export const getRelated = query({
  args: {
    entityId: v.id("entities"),
    relationType: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("from"), v.literal("to"))),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const entity = await ctx.db.get(args.entityId)

    if (!entity || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
    }

    const direction = args.direction ?? "from"
    const indexName = direction === "from" ? "by_from" : "by_to"
    const entityField = direction === "from" ? "fromEntityId" : "toEntityId"

    let relations
    if (args.relationType) {
      const relType = args.relationType
      relations = await ctx.db
        .query("entityRelations")
        .withIndex(indexName, (q) =>
          q.eq(entityField, args.entityId).eq("relationType", relType)
        )
        .collect()
    } else {
      relations = await ctx.db
        .query("entityRelations")
        .withIndex(indexName, (q) => q.eq(entityField, args.entityId))
        .collect()
    }

    const relatedIds = relations.map((r) =>
      direction === "from" ? r.toEntityId : r.fromEntityId
    )

    const relatedEntities = await Promise.all(
      relatedIds.map((id) => ctx.db.get(id))
    )

    return relatedEntities.filter(
      (e) => e && e.organizationId === auth.organizationId && !e.deletedAt
    )
  },
})
