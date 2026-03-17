import { v } from "convex/values"
import { internalMutation, internalQuery } from "../_generated/server"
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
import { getNestedValue } from "../lib/permissions/scope"
import { createEntityMutation, updateEntityMutation, deleteEntityMutation } from "../lib/entityMutations"

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

async function validateReferences(
  ctx: { db: any },
  schema: Record<string, unknown>,
  data: Record<string, unknown>,
  organizationId: Id<"organizations">,
  environment: Environment
) {
  const properties = (schema as any).properties as Record<string, any> | undefined
  if (!properties) return

  for (const [fieldName, propDef] of Object.entries(properties)) {
    const referencesSlug = propDef?.references as string | undefined
    if (!referencesSlug) continue

    const value = data[fieldName]
    if (value === undefined || value === null) continue

    const referencedType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env_slug", (q: any) =>
        q.eq("organizationId", organizationId).eq("environment", environment).eq("slug", referencesSlug)
      )
      .first()

    if (!referencedType) {
      throw new Error(`Referenced entity type '${referencesSlug}' not found`)
    }

    const entity = await ctx.db.get(value as Id<"entities">)

    if (
      !entity ||
      entity.deletedAt ||
      entity.organizationId !== organizationId ||
      entity.environment !== environment ||
      entity.entityTypeId !== referencedType._id
    ) {
      throw new Error(`Referenced entity not found: field '${fieldName}' references type '${referencesSlug}', but entity '${value}' does not exist`)
    }
  }
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

    if (entityType.schema?.properties) {
      await validateReferences(ctx, entityType.schema, args.data, args.organizationId, args.environment)
    }

    const entityId = await createEntityMutation(ctx, {
      organizationId: args.organizationId,
      environment: args.environment,
      entityTypeId: entityType._id,
      entityTypeSlug: args.type,
      data: args.data,
      status: args.status,
      searchFields: entityType.searchFields ?? undefined,
      actor: { actorId: actor.actorId, actorType: actor.actorType },
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

    const INTERNAL_FETCH_LIMIT = 1000
    const entities = await query.take(INTERNAL_FETCH_LIMIT)

    let filtered = entities.filter((e) => !e.deletedAt)

    if (args.filters) {
      filtered = filtered.filter((e) => {
        for (const [key, value] of Object.entries(args.filters)) {
          const fieldVal = getNestedValue(e.data as Record<string, unknown>, key)
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

    const limited = maskedEntities.slice(0, args.limit ?? 100)

    return limited.map((e) => ({
      id: e._id,
      type: args.type,
      status: e.status,
      data: JSON.parse(JSON.stringify(e.data)),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }))
  },
})

export const entitySearch = internalQuery({
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
    query: v.string(),
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
        q
          .eq("organizationId", args.organizationId)
          .eq("environment", args.environment)
          .eq("slug", args.type)
      )
      .first()

    if (!entityType) {
      return []
    }

    const results = await ctx.db
      .query("entities")
      .withSearchIndex("search_text", (q) =>
        q.search("searchText", args.query)
      )
      .collect()

    const filtered = results.filter(
      (e) =>
        e.organizationId === args.organizationId &&
        e.environment === args.environment &&
        e.entityTypeId === entityType._id &&
        !e.deletedAt
    )

    const scopeFilters = await getScopeFilters(ctx, actor, args.type)
    const scopedEntities = applyScopeFiltersToQuery(
      filtered as unknown as Record<string, unknown>[],
      scopeFilters
    )

    const fieldMask = await getFieldMask(ctx, actor, args.type)
    const maskedEntities = scopedEntities.map((e) =>
      applyFieldMask(e, fieldMask)
    )

    const limited = maskedEntities.slice(0, args.limit ?? 20)

    return limited.map((e) => ({
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

    if (entityType.schema?.properties) {
      await validateReferences(ctx, entityType.schema, allowedData, args.organizationId, args.environment)
    }

    await updateEntityMutation(ctx, {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId: entity._id,
      entityTypeSlug: entityType.slug,
      data: allowedData,
      previousData: entity.data,
      status: args.status,
      searchFields: entityType.searchFields ?? undefined,
      actor: { actorId: actor.actorId, actorType: actor.actorType },
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

    await deleteEntityMutation(ctx, {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId: entity._id,
      entityTypeSlug: entityType.slug,
      previousData: entity.data,
      actor: { actorId: actor.actorId, actorType: actor.actorType },
    })

    return { success: true }
  },
})

