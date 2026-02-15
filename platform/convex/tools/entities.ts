import { v } from "convex/values"
import { internalMutation, internalQuery } from "../_generated/server"
import { buildSearchText } from "../lib/utils"
import { Id } from "../_generated/dataModel"
import {
  buildActorContext,
  assertCanPerform,
  getScopeFilters,
  applyScopeFiltersToQuery,
  getFieldMask,
  applyFieldMask,
  PermissionError,
  ActorType,
  FieldMaskResult,
  Environment,
} from "../lib/permissions"
import { checkAndScheduleTriggers } from "../lib/triggers"

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
    environment: environmentValidator,
    type: v.string(),
    data: v.any(),
    status: v.optional(v.string()),
  },
  returns: v.object({ id: v.id("entities") }),
  handler: async (ctx, args) => {
    const actor = await buildActorContext(ctx, {
      organizationId: args.organizationId,
      actorType: args.actorType as ActorType,
      actorId: args.actorId,
      environment: args.environment,
    })

    await assertCanPerform(ctx, actor, "create", args.type)

    const entityType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment).eq("slug", args.type)
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
      environment: args.environment,
      status: args.status ?? "active",
      data: args.data,
      searchText,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId,
      entityTypeSlug: args.type,
      eventType: `${args.type}.created`,
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: { data: args.data },
      timestamp: now,
    })

    await checkAndScheduleTriggers(ctx, {
      organizationId: args.organizationId,
      environment: args.environment,
      entityTypeSlug: args.type,
      action: "created",
      entityId,
      data: args.data,
    })

    return { id: entityId }
  },
})

export const entityGet = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("webhook")
    ),
    environment: environmentValidator,
    id: v.string(),
  },
  returns: v.object({
    id: v.id("entities"),
    type: v.string(),
    status: v.any(),
    data: v.any(),
    createdAt: v.any(),
    updatedAt: v.any(),
  }),
  handler: async (ctx, args) => {
    const entity = await ctx.db.get(args.id as Id<"entities">)

    if (!entity || entity.organizationId !== args.organizationId) {
      throw new Error("Entity not found")
    }

    if (entity.environment !== args.environment) {
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
      organizationId: args.organizationId,
      actorType: args.actorType as ActorType,
      actorId: args.actorId,
      environment: args.environment,
    })

    await assertCanPerform(ctx, actor, "read", entityType.slug, entity as unknown as Record<string, unknown>)

    const scopeFilters = await getScopeFilters(ctx, actor, entityType.slug)
    const scoped = applyScopeFiltersToQuery(
      [entity as unknown as Record<string, unknown>],
      scopeFilters
    )
    if (scoped.length === 0) {
      throw new PermissionError(
        "Entity not accessible within scope",
        actor,
        "read",
        entityType.slug
      )
    }

    const fieldMask = await getFieldMask(ctx, actor, entityType.slug)
    const maskedEntity = applyFieldMask(entity as unknown as Record<string, unknown>, fieldMask)

    return {
      id: entity._id,
      type: entityType.slug,
      status: maskedEntity.status,
      data: JSON.parse(JSON.stringify(maskedEntity.data)),
      createdAt: maskedEntity.createdAt,
      updatedAt: maskedEntity.updatedAt,
    }
  },
})

export const entityQuery = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("webhook")
    ),
    environment: environmentValidator,
    type: v.string(),
    filters: v.optional(v.any()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    id: v.any(),
    type: v.string(),
    status: v.any(),
    data: v.any(),
    createdAt: v.any(),
    updatedAt: v.any(),
  })),
  handler: async (ctx, args) => {
    const actor = await buildActorContext(ctx, {
      organizationId: args.organizationId,
      actorType: args.actorType as ActorType,
      actorId: args.actorId,
      environment: args.environment,
    })

    await assertCanPerform(ctx, actor, "list", args.type)

    const entityType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment).eq("slug", args.type)
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
          .withIndex("by_org_env_type_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("environment", args.environment)
              .eq("entityTypeId", typeId)
              .eq("status", status)
          )
      : ctx.db
          .query("entities")
          .withIndex("by_org_env_type", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("environment", args.environment)
              .eq("entityTypeId", typeId)
          )

    const entities = await query.take(args.limit ?? 100)

    let filtered = entities.filter((e) => !e.deletedAt)

    if (args.filters) {
      filtered = filtered.filter((e) => {
        for (const [key, value] of Object.entries(args.filters)) {
          const fieldVal = e.data[key]
          if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            const ops = value as Record<string, unknown>
            for (const [op, opVal] of Object.entries(ops)) {
              switch (op) {
                case "_op_in":
                  if (!Array.isArray(opVal) || !opVal.includes(fieldVal)) return false
                  break
                case "_op_nin":
                  if (Array.isArray(opVal) && opVal.includes(fieldVal)) return false
                  break
                case "_op_ne":
                  if (fieldVal === opVal) return false
                  break
                case "_op_gt":
                  if (typeof fieldVal !== "number" || typeof opVal !== "number" || fieldVal <= opVal) return false
                  break
                case "_op_gte":
                  if (typeof fieldVal !== "number" || typeof opVal !== "number" || fieldVal < opVal) return false
                  break
                case "_op_lt":
                  if (typeof fieldVal !== "number" || typeof opVal !== "number" || fieldVal >= opVal) return false
                  break
                case "_op_lte":
                  if (typeof fieldVal !== "number" || typeof opVal !== "number" || fieldVal > opVal) return false
                  break
                default:
                  break
              }
            }
          } else {
            if (fieldVal !== value) return false
          }
        }
        return true
      })
    }

    const scopeFilters = await getScopeFilters(ctx, actor, args.type)
    const scopedEntities = applyScopeFiltersToQuery(
      filtered as unknown as Record<string, unknown>[],
      scopeFilters
    )

    const fieldMask = await getFieldMask(ctx, actor, args.type)
    const maskedEntities = scopedEntities.map((e) =>
      applyFieldMask(e, fieldMask)
    )

    return maskedEntities.map((e) => ({
      id: e._id,
      type: args.type,
      status: e.status,
      data: JSON.parse(JSON.stringify(e.data)),
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
    environment: environmentValidator,
    id: v.string(),
    type: v.optional(v.string()),
    data: v.any(),
    status: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const entity = await ctx.db.get(args.id as Id<"entities">)

    if (!entity || entity.organizationId !== args.organizationId) {
      throw new Error("Entity not found")
    }

    if (entity.deletedAt) {
      throw new Error("Entity has been deleted")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType) {
      throw new Error("Entity type not found")
    }

    if (args.type && entityType.slug !== args.type) {
      throw new Error(`Entity ${args.id} is type '${entityType.slug}', not '${args.type}'`)
    }

    const actor = await buildActorContext(ctx, {
      organizationId: args.organizationId,
      actorType: args.actorType as ActorType,
      actorId: args.actorId,
      environment: args.environment,
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

    const mergedData = { ...entity.data, ...allowedData }
    const now = Date.now()

    const updates: Record<string, unknown> = {
      data: mergedData,
      searchText: buildSearchText(mergedData, entityType.searchFields ?? undefined),
      updatedAt: now,
    }

    if (args.status !== undefined) {
      updates.status = args.status
    }

    await ctx.db.patch(entity._id, updates)

    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId: entity._id,
      entityTypeSlug: entityType.slug,
      eventType: `${entityType.slug}.updated`,
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: { changes: allowedData, previousData: entity.data },
      timestamp: now,
    })

    await checkAndScheduleTriggers(ctx, {
      organizationId: args.organizationId,
      environment: args.environment,
      entityTypeSlug: entityType.slug,
      action: "updated",
      entityId: entity._id,
      data: mergedData,
      previousData: entity.data,
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
    environment: environmentValidator,
    id: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const entity = await ctx.db.get(args.id as Id<"entities">)

    if (!entity || entity.organizationId !== args.organizationId) {
      throw new Error("Entity not found")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: args.organizationId,
      actorType: args.actorType as ActorType,
      actorId: args.actorId,
      environment: args.environment,
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
    await ctx.db.patch(entity._id, {
      status: "deleted",
      deletedAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId: entity._id,
      entityTypeSlug: entityType.slug,
      eventType: `${entityType.slug}.deleted`,
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: { previousData: entity.data },
      timestamp: now,
    })

    await checkAndScheduleTriggers(ctx, {
      organizationId: args.organizationId,
      environment: args.environment,
      entityTypeSlug: entityType.slug,
      action: "deleted",
      entityId: entity._id,
      data: entity.data,
      previousData: entity.data,
    })

    return { success: true }
  },
})

export const entityLink = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("webhook")
    ),
    environment: environmentValidator,
    fromId: v.string(),
    toId: v.string(),
    relationType: v.string(),
    metadata: v.optional(v.any()),
  },
  returns: v.object({ id: v.id("entityRelations"), existing: v.boolean() }),
  handler: async (ctx, args) => {
    const fromEntity = await ctx.db.get(args.fromId as Id<"entities">)
    const toEntity = await ctx.db.get(args.toId as Id<"entities">)

    if (!fromEntity || fromEntity.organizationId !== args.organizationId) {
      throw new Error("Source entity not found")
    }
    if (!toEntity || toEntity.organizationId !== args.organizationId) {
      throw new Error("Target entity not found")
    }

    const fromType = await ctx.db.get(fromEntity.entityTypeId)
    const toType = await ctx.db.get(toEntity.entityTypeId)

    if (!fromType || !toType) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: args.organizationId,
      actorType: args.actorType as ActorType,
      actorId: args.actorId,
      environment: args.environment,
    })

    await assertCanPerform(ctx, actor, "update", fromType.slug, fromEntity as unknown as Record<string, unknown>)
    await assertCanPerform(ctx, actor, "read", toType.slug, toEntity as unknown as Record<string, unknown>)

    const existing = await ctx.db
      .query("entityRelations")
      .withIndex("by_from", (q) =>
        q
          .eq("fromEntityId", args.fromId as Id<"entities">)
          .eq("relationType", args.relationType)
      )
      .filter((q) => q.and(
        q.eq(q.field("toEntityId"), args.toId),
        q.eq(q.field("environment"), args.environment)
      ))
      .first()

    if (existing) {
      return { id: existing._id, existing: true }
    }

    const now = Date.now()
    const relationId = await ctx.db.insert("entityRelations", {
      organizationId: args.organizationId,
      environment: args.environment,
      fromEntityId: args.fromId as Id<"entities">,
      toEntityId: args.toId as Id<"entities">,
      relationType: args.relationType,
      metadata: args.metadata,
      createdAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId: args.fromId as Id<"entities">,
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

    return { id: relationId, existing: false }
  },
})

export const entityUnlink = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("webhook")
    ),
    environment: environmentValidator,
    fromId: v.string(),
    toId: v.string(),
    relationType: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const fromEntity = await ctx.db.get(args.fromId as Id<"entities">)
    const toEntity = await ctx.db.get(args.toId as Id<"entities">)

    if (!fromEntity || fromEntity.organizationId !== args.organizationId) {
      throw new Error("Source entity not found")
    }
    if (!toEntity || toEntity.organizationId !== args.organizationId) {
      throw new Error("Target entity not found")
    }

    const fromType = await ctx.db.get(fromEntity.entityTypeId)
    const toType = await ctx.db.get(toEntity.entityTypeId)

    if (!fromType || !toType) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: args.organizationId,
      actorType: args.actorType as ActorType,
      actorId: args.actorId,
      environment: args.environment,
    })

    await assertCanPerform(ctx, actor, "update", fromType.slug, fromEntity as unknown as Record<string, unknown>)
    await assertCanPerform(ctx, actor, "read", toType.slug, toEntity as unknown as Record<string, unknown>)

    const relation = await ctx.db
      .query("entityRelations")
      .withIndex("by_from", (q) =>
        q
          .eq("fromEntityId", args.fromId as Id<"entities">)
          .eq("relationType", args.relationType)
      )
      .filter((q) => q.and(
        q.eq(q.field("toEntityId"), args.toId),
        q.eq(q.field("environment"), args.environment)
      ))
      .first()

    if (!relation || relation.organizationId !== args.organizationId) {
      throw new Error("Relation not found")
    }

    const now = Date.now()
    await ctx.db.delete(relation._id)

    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId: args.fromId as Id<"entities">,
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
