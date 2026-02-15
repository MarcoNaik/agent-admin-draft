import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"
import { buildSearchText } from "./lib/utils"
import {
  buildActorContext,
  queryEntitiesAsActor,
  getEntityAsActor,
  canPerform,
  assertCanPerform,
  getScopeFilters,
  applyScopeFiltersToQuery,
  getFieldMask,
  applyFieldMask,
  PermissionError,
  FieldMaskResult,
} from "./lib/permissions"
import { Environment } from "./lib/permissions/types"
import { checkAndScheduleTriggers } from "./lib/triggers"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

function filterDataByMask(
  data: Record<string, unknown>,
  mask: FieldMaskResult & { hiddenFields?: string[] }
): Record<string, unknown> {
  if (mask.isWildcard) {
    return data
  }
  if (mask.hiddenFields && mask.hiddenFields.length > 0) {
    const filtered: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      const dataPath = `data.${key}`
      if (!mask.hiddenFields.includes(dataPath) && !mask.hiddenFields.includes(key)) {
        filtered[key] = value
      }
    }
    return filtered
  }
  if (mask.allowedFields.length > 0) {
    const filtered: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (mask.allowedFields.includes(key) || mask.allowedFields.includes(`data.${key}`)) {
        filtered[key] = value
      }
    }
    return filtered
  }
  return data
}

export const list = query({
  args: {
    entityTypeSlug: v.string(),
    environment: v.optional(environmentValidator),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment: Environment = args.environment ?? "development"
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment,
    })

    const entities = await queryEntitiesAsActor(ctx, actor, args.entityTypeSlug)

    if (args.status) {
      return entities
        .filter((e) => e.status === args.status)
        .slice(0, args.limit ?? 100)
    }

    return entities.slice(0, args.limit ?? 100)
  },
})

export const get = query({
  args: {
    id: v.id("entities"),
    environment: v.optional(environmentValidator),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment: Environment = args.environment ?? "development"
    const entity = await ctx.db.get(args.id)

    if (!entity || entity.organizationId !== auth.organizationId) {
      return null
    }

    if (entity.deletedAt) {
      return null
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType) {
      return null
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment,
    })

    return await getEntityAsActor(ctx, actor, entityType.slug, args.id)
  },
})

export const getWithType = query({
  args: {
    id: v.id("entities"),
    environment: v.optional(environmentValidator),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment: Environment = args.environment ?? "development"
    const entity = await ctx.db.get(args.id)

    if (!entity || entity.organizationId !== auth.organizationId) {
      return null
    }

    if (entity.deletedAt) {
      return null
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType) {
      return null
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment,
    })

    const securedEntity = await getEntityAsActor(ctx, actor, entityType.slug, args.id)
    if (!securedEntity) {
      return null
    }

    return {
      entity: securedEntity,
      entityType,
    }
  },
})

export const search = query({
  args: {
    entityTypeSlug: v.string(),
    environment: v.optional(environmentValidator),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment: Environment = args.environment ?? "development"
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment,
    })

    const canList = await canPerform(ctx, actor, "list", args.entityTypeSlug)
    if (!canList.allowed) {
      return []
    }

    const entityType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("slug", args.entityTypeSlug)
      )
      .first()

    if (!entityType) {
      return []
    }

    const results = await ctx.db
      .query("entities")
      .withSearchIndex("search_text", (q) => q.search("searchText", args.query))
      .take(args.limit ?? 25)

    const filtered = results.filter(
      (e) =>
        e.organizationId === auth.organizationId &&
        e.entityTypeId === entityType._id &&
        e.environment === environment &&
        !e.deletedAt
    )

    const scopeFilters = await getScopeFilters(ctx, actor, args.entityTypeSlug)
    const scopedResults = applyScopeFiltersToQuery(
      filtered as unknown as Record<string, unknown>[],
      scopeFilters
    )

    const fieldMask = await getFieldMask(ctx, actor, args.entityTypeSlug)
    return scopedResults.map((e) => applyFieldMask(e, fieldMask))
  },
})

export const create = mutation({
  args: {
    entityTypeSlug: v.string(),
    environment: v.optional(environmentValidator),
    data: v.any(),
    status: v.optional(v.string()),
  },
  returns: v.id("entities"),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const environment: Environment = args.environment ?? "development"
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment,
    })

    await assertCanPerform(ctx, actor, "create", args.entityTypeSlug)

    const entityType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("slug", args.entityTypeSlug)
      )
      .first()

    if (!entityType) {
      throw new Error(`Entity type not found: ${args.entityTypeSlug}`)
    }

    const now = Date.now()
    const searchText = buildSearchText(args.data, entityType.searchFields ?? undefined)

    const entityId = await ctx.db.insert("entities", {
      organizationId: auth.organizationId,
      environment,
      entityTypeId: entityType._id,
      status: args.status ?? "active",
      data: args.data,
      searchText,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment,
      entityId,
      entityTypeSlug: args.entityTypeSlug,
      eventType: `${args.entityTypeSlug}.created`,
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: { data: args.data },
      timestamp: now,
    })

    await checkAndScheduleTriggers(ctx, {
      organizationId: auth.organizationId,
      environment,
      entityTypeSlug: args.entityTypeSlug,
      action: "created",
      entityId,
      data: args.data,
    })

    return entityId
  },
})

export const update = mutation({
  args: {
    id: v.id("entities"),
    environment: v.optional(environmentValidator),
    data: v.any(),
    status: v.optional(v.string()),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const environment: Environment = args.environment ?? "development"
    const entity = await ctx.db.get(args.id)

    if (!entity || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
    }

    if (entity.deletedAt) {
      throw new Error("Entity has been deleted")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment,
    })

    await assertCanPerform(ctx, actor, "update", entityType.slug, entity as unknown as Record<string, unknown>)

    const scopeFilters = await getScopeFilters(ctx, actor, entityType.slug)
    const canAccessRecord = applyScopeFiltersToQuery(
      [entity as unknown as Record<string, unknown>],
      scopeFilters
    ).length > 0
    if (!canAccessRecord) {
      throw new PermissionError(
        "Cannot update entity outside of scope",
        actor,
        "update",
        entityType.slug
      )
    }

    const fieldMask = await getFieldMask(ctx, actor, entityType.slug)
    const allowedData = filterDataByMask(args.data, fieldMask)

    const now = Date.now()
    const mergedData = { ...entity.data, ...allowedData }

    const updates: Record<string, unknown> = {
      data: mergedData,
      searchText: buildSearchText(mergedData, entityType.searchFields ?? undefined),
      updatedAt: now,
    }

    if (args.status !== undefined) {
      updates.status = args.status
    }

    await ctx.db.patch(args.id, updates)

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment,
      entityId: args.id,
      entityTypeSlug: entityType.slug,
      eventType: `${entityType.slug}.updated`,
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: { changes: allowedData, previousData: entity.data },
      timestamp: now,
    })

    await checkAndScheduleTriggers(ctx, {
      organizationId: auth.organizationId,
      environment,
      entityTypeSlug: entityType.slug,
      action: "updated",
      entityId: args.id,
      data: mergedData,
      previousData: entity.data,
    })

    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: {
    id: v.id("entities"),
    environment: v.optional(environmentValidator),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const environment: Environment = args.environment ?? "development"
    const entity = await ctx.db.get(args.id)

    if (!entity || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment,
    })

    await assertCanPerform(ctx, actor, "delete", entityType.slug, entity as unknown as Record<string, unknown>)

    const scopeFilters = await getScopeFilters(ctx, actor, entityType.slug)
    const canAccessRecord = applyScopeFiltersToQuery(
      [entity as unknown as Record<string, unknown>],
      scopeFilters
    ).length > 0
    if (!canAccessRecord) {
      throw new PermissionError(
        "Cannot delete entity outside of scope",
        actor,
        "delete",
        entityType.slug
      )
    }

    const now = Date.now()
    await ctx.db.patch(args.id, {
      status: "deleted",
      deletedAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment,
      entityId: args.id,
      entityTypeSlug: entityType.slug,
      eventType: `${entityType.slug}.deleted`,
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: { previousData: entity.data },
      timestamp: now,
    })

    await checkAndScheduleTriggers(ctx, {
      organizationId: auth.organizationId,
      environment,
      entityTypeSlug: entityType.slug,
      action: "deleted",
      entityId: args.id,
      data: entity.data,
      previousData: entity.data,
    })

    return { success: true }
  },
})

export const link = mutation({
  args: {
    fromId: v.id("entities"),
    toId: v.id("entities"),
    environment: v.optional(environmentValidator),
    relationType: v.string(),
    metadata: v.optional(v.any()),
  },
  returns: v.id("entityRelations"),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const environment: Environment = args.environment ?? "development"

    const fromEntity = await ctx.db.get(args.fromId)
    const toEntity = await ctx.db.get(args.toId)

    if (!fromEntity || fromEntity.organizationId !== auth.organizationId) {
      throw new Error("Source entity not found")
    }
    if (!toEntity || toEntity.organizationId !== auth.organizationId) {
      throw new Error("Target entity not found")
    }

    const fromType = await ctx.db.get(fromEntity.entityTypeId)
    const toType = await ctx.db.get(toEntity.entityTypeId)

    if (!fromType || !toType) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment,
    })

    await assertCanPerform(ctx, actor, "update", fromType.slug, fromEntity as unknown as Record<string, unknown>)
    await assertCanPerform(ctx, actor, "read", toType.slug, toEntity as unknown as Record<string, unknown>)

    const existing = await ctx.db
      .query("entityRelations")
      .withIndex("by_from", (q) =>
        q.eq("fromEntityId", args.fromId).eq("relationType", args.relationType)
      )
      .filter((q) => q.and(
        q.eq(q.field("toEntityId"), args.toId),
        q.eq(q.field("environment"), environment)
      ))
      .first()

    if (existing) {
      return existing._id
    }

    const now = Date.now()
    const relationId = await ctx.db.insert("entityRelations", {
      organizationId: auth.organizationId,
      environment,
      fromEntityId: args.fromId,
      toEntityId: args.toId,
      relationType: args.relationType,
      metadata: args.metadata,
      createdAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment,
      entityId: args.fromId,
      entityTypeSlug: fromType.slug,
      eventType: "entity.linked",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: {
        toEntityId: args.toId,
        relationType: args.relationType,
      },
      timestamp: now,
    })

    return relationId
  },
})

export const unlink = mutation({
  args: {
    fromId: v.id("entities"),
    toId: v.id("entities"),
    environment: v.optional(environmentValidator),
    relationType: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const environment: Environment = args.environment ?? "development"

    const fromEntity = await ctx.db.get(args.fromId)
    const toEntity = await ctx.db.get(args.toId)

    if (!fromEntity || fromEntity.organizationId !== auth.organizationId) {
      throw new Error("Source entity not found")
    }
    if (!toEntity || toEntity.organizationId !== auth.organizationId) {
      throw new Error("Target entity not found")
    }

    const fromType = await ctx.db.get(fromEntity.entityTypeId)
    const toType = await ctx.db.get(toEntity.entityTypeId)

    if (!fromType || !toType) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment,
    })

    await assertCanPerform(ctx, actor, "update", fromType.slug, fromEntity as unknown as Record<string, unknown>)
    await assertCanPerform(ctx, actor, "read", toType.slug, toEntity as unknown as Record<string, unknown>)

    const relation = await ctx.db
      .query("entityRelations")
      .withIndex("by_from", (q) =>
        q.eq("fromEntityId", args.fromId).eq("relationType", args.relationType)
      )
      .filter((q) => q.and(
        q.eq(q.field("toEntityId"), args.toId),
        q.eq(q.field("environment"), environment)
      ))
      .first()

    if (!relation || relation.organizationId !== auth.organizationId) {
      throw new Error("Relation not found")
    }

    const now = Date.now()
    await ctx.db.delete(relation._id)

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment,
      entityId: args.fromId,
      entityTypeSlug: fromType.slug,
      eventType: "entity.unlinked",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: {
        toEntityId: args.toId,
        relationType: args.relationType,
      },
      timestamp: now,
    })

    return { success: true }
  },
})

export const getRelated = query({
  args: {
    entityId: v.id("entities"),
    environment: v.optional(environmentValidator),
    relationType: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("from"), v.literal("to"))),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment: Environment = args.environment ?? "development"
    const entity = await ctx.db.get(args.entityId)

    if (!entity || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment,
    })

    const canRead = await canPerform(ctx, actor, "read", entityType.slug, entity as unknown as Record<string, unknown>)
    if (!canRead.allowed) {
      throw new Error("Permission denied")
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
        .filter((q) => q.eq(q.field("environment"), environment))
        .collect()
    } else {
      relations = await ctx.db
        .query("entityRelations")
        .withIndex(indexName, (q) => q.eq(entityField, args.entityId))
        .filter((q) => q.eq(q.field("environment"), environment))
        .collect()
    }

    const relatedIds = relations.map((r) =>
      direction === "from" ? r.toEntityId : r.fromEntityId
    )

    const relatedEntities = await Promise.all(
      relatedIds.map(async (id) => {
        const relatedEntity = await ctx.db.get(id)
        if (!relatedEntity || relatedEntity.organizationId !== auth.organizationId || relatedEntity.deletedAt) {
          return null
        }
        const relatedType = await ctx.db.get(relatedEntity.entityTypeId)
        if (!relatedType) {
          return null
        }
        return await getEntityAsActor(ctx, actor, relatedType.slug, id)
      })
    )

    return relatedEntities.filter((e) => e !== null)
  },
})
