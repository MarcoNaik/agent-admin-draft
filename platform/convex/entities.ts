import { v } from "convex/values"
import { paginationOptsValidator } from "convex/server"
import { query, mutation } from "./_generated/server"
import { getAuthContextForOrg, requireAuth } from "./lib/auth"
import { buildSearchText } from "./lib/utils"
import {
  buildActorContext,
  queryEntitiesAsActor,
  paginatedQueryEntitiesAsActor,
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

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

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

export const resolvePartialId = query({
  args: {
    partialId: v.string(),
    environment: v.optional(environmentValidator),
    organizationId: v.optional(v.string()),
  },
  returns: v.union(v.id("entities"), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
    const environment: Environment = args.environment ?? "development"

    const normalized = ctx.db.normalizeId("entities", args.partialId)
    if (normalized) {
      const entity = await ctx.db.get(normalized)
      if (entity && entity.organizationId === auth.organizationId && !entity.deletedAt) {
        return normalized
      }
    }

    const entities = await ctx.db
      .query("entities")
      .withIndex("by_org_env_type", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment)
      )
      .collect()

    const match = entities.find((e) => String(e._id).endsWith(args.partialId) && !e.deletedAt)
    return match?._id ?? null
  },
})

export const list = query({
  args: {
    entityTypeSlug: v.string(),
    environment: v.optional(environmentValidator),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
    organizationId: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
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

export const listPaginated = query({
  args: {
    entityTypeSlug: v.string(),
    environment: v.optional(environmentValidator),
    status: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    organizationId: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
    const environment: Environment = args.environment ?? "development"
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment,
    })

    return await paginatedQueryEntitiesAsActor(
      ctx,
      actor,
      args.entityTypeSlug,
      args.paginationOpts,
      args.status ?? undefined
    )
  },
})

export const get = query({
  args: {
    id: v.id("entities"),
    environment: v.optional(environmentValidator),
    organizationId: v.optional(v.string()),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
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
    organizationId: v.optional(v.string()),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
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
    organizationId: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
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
    organizationId: v.optional(v.string()),
  },
  returns: v.id("entities"),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
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
    organizationId: v.optional(v.string()),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
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
    organizationId: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
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

export const getRelated = query({
  args: {
    entityId: v.id("entities"),
    environment: v.optional(environmentValidator),
    relationType: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("from"), v.literal("to"))),
    organizationId: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
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
          q.eq(entityField, args.entityId).eq("relationType", relType).eq("environment", environment)
        )
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

export const searchByEmail = query({
  args: {
    entityTypeId: v.id("entityTypes"),
    email: v.optional(v.string()),
    environment: environmentValidator,
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const entities = await ctx.db
      .query("entities")
      .withIndex("by_org_env_type", (q) =>
        q
          .eq("organizationId", auth.organizationId)
          .eq("environment", args.environment)
          .eq("entityTypeId", args.entityTypeId)
      )
      .collect()

    const active = entities.filter((e) => !e.deletedAt)

    if (!args.email) {
      return active.sort((a, b) => {
        const nameA = (a.data?.name || a.data?.email || "").toLowerCase()
        const nameB = (b.data?.name || b.data?.email || "").toLowerCase()
        return nameA.localeCompare(nameB)
      })
    }

    const search = args.email.toLowerCase()

    return active.sort((a, b) => {
      const emailA = typeof a.data?.email === "string" ? a.data.email.toLowerCase() : ""
      const emailB = typeof b.data?.email === "string" ? b.data.email.toLowerCase() : ""

      const exactA = emailA === search
      const exactB = emailB === search
      if (exactA !== exactB) return exactA ? -1 : 1

      const containsA = emailA.includes(search) || search.includes(emailA)
      const containsB = emailB.includes(search) || search.includes(emailB)
      if (containsA !== containsB) return containsA ? -1 : 1

      const nameA = (a.data?.name || emailA || "").toLowerCase()
      const nameB = (b.data?.name || emailB || "").toLowerCase()
      return nameA.localeCompare(nameB)
    })
  },
})

export const getByUserIdField = query({
  args: {
    entityTypeId: v.id("entityTypes"),
    userClerkId: v.string(),
    environment: environmentValidator,
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const entityType = await ctx.db.get(args.entityTypeId)
    if (!entityType || !entityType.userIdField) {
      return null
    }

    const userIdField = entityType.userIdField

    const entities = await ctx.db
      .query("entities")
      .withIndex("by_org_env_type", (q) =>
        q
          .eq("organizationId", auth.organizationId)
          .eq("environment", args.environment)
          .eq("entityTypeId", args.entityTypeId)
      )
      .collect()

    return (
      entities.find(
        (e) => !e.deletedAt && e.data?.[userIdField] === args.userClerkId
      ) ?? null
    )
  },
})

export const linkUserToEntity = mutation({
  args: {
    entityId: v.id("entities"),
    userId: v.id("users"),
    environment: environmentValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const entity = await ctx.db.get(args.entityId)
    if (!entity || entity.deletedAt || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType || !entityType.userIdField) {
      throw new Error("Entity type has no userIdField")
    }

    const userIdField = entityType.userIdField

    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error("User not found")
    }

    const currentValue = entity.data?.[userIdField]
    if (currentValue && currentValue !== user.clerkUserId) {
      throw new Error("Entity is already linked to another user")
    }

    const existingEntities = await ctx.db
      .query("entities")
      .withIndex("by_org_env_type", (q) =>
        q
          .eq("organizationId", auth.organizationId)
          .eq("environment", args.environment)
          .eq("entityTypeId", entity.entityTypeId)
      )
      .collect()

    const alreadyLinked = existingEntities.find(
      (e) =>
        !e.deletedAt &&
        e._id !== args.entityId &&
        e.data?.[userIdField] === user.clerkUserId
    )

    if (alreadyLinked) {
      throw new Error("User already has a linked entity of this type")
    }

    await ctx.db.patch(args.entityId, {
      data: { ...entity.data, [userIdField]: user.clerkUserId },
    })

    return null
  },
})

export const unlinkUserFromEntity = mutation({
  args: {
    entityId: v.id("entities"),
    deleteEntity: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const entity = await ctx.db.get(args.entityId)
    if (!entity || entity.deletedAt || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType || !entityType.userIdField) {
      throw new Error("Entity type has no userIdField")
    }

    const userIdField = entityType.userIdField

    if (args.deleteEntity) {
      await ctx.db.patch(args.entityId, {
        deletedAt: Date.now(),
      })
    } else {
      await ctx.db.patch(args.entityId, {
        data: { ...entity.data, [userIdField]: undefined },
      })
    }

    return null
  },
})
