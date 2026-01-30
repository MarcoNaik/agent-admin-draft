import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { buildSearchText } from "../lib/utils"
import { Id } from "../_generated/dataModel"

export const entityCreate = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("webhook")
    ),
    type: v.string(),
    data: v.any(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entityType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", args.type)
      )
      .first()

    if (!entityType) {
      throw new Error(`Entity type ${args.type} not found`)
    }

    const now = Date.now()
    const searchText = buildSearchText(args.data, entityType.searchFields ?? undefined)

    const entityId = await ctx.db.insert("entities", {
      organizationId: args.organizationId,
      entityTypeId: entityType._id,
      status: args.status ?? "active",
      data: args.data,
      searchText,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      entityId,
      entityTypeSlug: args.type,
      eventType: `${args.type}.created`,
      schemaVersion: 1,
      actorId: args.actorId,
      actorType: args.actorType,
      payload: { data: args.data },
      timestamp: now,
    })

    return { id: entityId }
  },
})

export const entityGet = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const entity = await ctx.db.get(args.id as Id<"entities">)

    if (!entity || entity.organizationId !== args.organizationId) {
      throw new Error("Entity not found")
    }

    if (entity.deletedAt) {
      throw new Error("Entity has been deleted")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)

    return {
      id: entity._id,
      type: entityType?.slug,
      status: entity.status,
      data: entity.data,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    }
  },
})

export const entityQuery = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    type: v.string(),
    filters: v.optional(v.any()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const entityType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", args.type)
      )
      .first()

    if (!entityType) {
      return []
    }

    const typeId = entityType._id
    const status = args.status

    const query = status
      ? ctx.db
          .query("entities")
          .withIndex("by_org_type_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("entityTypeId", typeId)
              .eq("status", status)
          )
      : ctx.db
          .query("entities")
          .withIndex("by_org_type", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("entityTypeId", typeId)
          )

    const entities = await query.take(args.limit ?? 100)

    let filtered = entities.filter((e) => !e.deletedAt)

    if (args.filters) {
      filtered = filtered.filter((e) => {
        for (const [key, value] of Object.entries(args.filters)) {
          if (e.data[key] !== value) {
            return false
          }
        }
        return true
      })
    }

    return filtered.map((e) => ({
      id: e._id,
      type: args.type,
      status: e.status,
      data: e.data,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }))
  },
})

export const entityUpdate = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("webhook")
    ),
    id: v.string(),
    data: v.any(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entity = await ctx.db.get(args.id as Id<"entities">)

    if (!entity || entity.organizationId !== args.organizationId) {
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

    await ctx.db.patch(entity._id, updates)

    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      entityId: entity._id,
      entityTypeSlug: entityType?.slug,
      eventType: `${entityType?.slug ?? "entity"}.updated`,
      schemaVersion: 1,
      actorId: args.actorId,
      actorType: args.actorType,
      payload: { changes: args.data },
      timestamp: now,
    })

    return { success: true }
  },
})

export const entityDelete = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("webhook")
    ),
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const entity = await ctx.db.get(args.id as Id<"entities">)

    if (!entity || entity.organizationId !== args.organizationId) {
      throw new Error("Entity not found")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    const now = Date.now()

    await ctx.db.patch(entity._id, { deletedAt: now })

    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      entityId: entity._id,
      entityTypeSlug: entityType?.slug,
      eventType: `${entityType?.slug ?? "entity"}.deleted`,
      schemaVersion: 1,
      actorId: args.actorId,
      actorType: args.actorType,
      payload: {},
      timestamp: now,
    })

    return { success: true }
  },
})

export const entityLink = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    fromId: v.string(),
    toId: v.string(),
    relationType: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const fromEntity = await ctx.db.get(args.fromId as Id<"entities">)
    const toEntity = await ctx.db.get(args.toId as Id<"entities">)

    if (
      !fromEntity ||
      fromEntity.organizationId !== args.organizationId ||
      !toEntity ||
      toEntity.organizationId !== args.organizationId
    ) {
      throw new Error("Entity not found")
    }

    const existing = await ctx.db
      .query("entityRelations")
      .withIndex("by_from", (q) =>
        q
          .eq("fromEntityId", args.fromId as Id<"entities">)
          .eq("relationType", args.relationType)
      )
      .filter((q) => q.eq(q.field("toEntityId"), args.toId))
      .first()

    if (existing) {
      return { id: existing._id, existing: true }
    }

    const relationId = await ctx.db.insert("entityRelations", {
      organizationId: args.organizationId,
      fromEntityId: args.fromId as Id<"entities">,
      toEntityId: args.toId as Id<"entities">,
      relationType: args.relationType,
      metadata: args.metadata,
      createdAt: Date.now(),
    })

    return { id: relationId, existing: false }
  },
})

export const entityUnlink = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    fromId: v.string(),
    toId: v.string(),
    relationType: v.string(),
  },
  handler: async (ctx, args) => {
    const relation = await ctx.db
      .query("entityRelations")
      .withIndex("by_from", (q) =>
        q
          .eq("fromEntityId", args.fromId as Id<"entities">)
          .eq("relationType", args.relationType)
      )
      .filter((q) => q.eq(q.field("toEntityId"), args.toId))
      .first()

    if (!relation || relation.organizationId !== args.organizationId) {
      throw new Error("Relation not found")
    }

    await ctx.db.delete(relation._id)
    return { success: true }
  },
})
