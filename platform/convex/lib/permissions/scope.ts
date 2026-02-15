import { QueryCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"
import { ActorContext, ScopeFilter } from "./types"
import { loadPoliciesForResource } from "./evaluate"

async function resolveActorEntityId(
  ctx: QueryCtx,
  actor: ActorContext
): Promise<Id<"entities"> | null> {
  if (actor.roleIds.length === 0) return null

  const roles = await Promise.all(actor.roleIds.map((id) => ctx.db.get(id)))
  const roleNames = roles.filter(Boolean).map((r) => r!.name)

  const entityTypes = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_env", (q) =>
      q
        .eq("organizationId", actor.organizationId)
        .eq("environment", actor.environment)
    )
    .collect()

  const boundEntityType = entityTypes.find(
    (et) => et.boundToRole && roleNames.includes(et.boundToRole)
  )

  if (!boundEntityType) return null

  const userIdField = boundEntityType.userIdField || "userId"

  const actorEntity = await ctx.db
    .query("entities")
    .withIndex("by_org_env_type", (q) =>
      q
        .eq("organizationId", actor.organizationId)
        .eq("environment", actor.environment)
        .eq("entityTypeId", boundEntityType._id)
    )
    .filter((q) => q.eq(q.field(`data.${userIdField}`), actor.actorId))
    .first()

  return actorEntity?._id ?? null
}

async function resolveRelatedEntityIds(
  ctx: QueryCtx,
  actor: ActorContext,
  actorEntityId: Id<"entities">,
  relationType: string
): Promise<Id<"entities">[]> {
  const relations = await ctx.db
    .query("entityRelations")
    .withIndex("by_from", (q) =>
      q.eq("fromEntityId", actorEntityId).eq("relationType", relationType)
    )
    .filter((q) => q.eq(q.field("environment"), actor.environment))
    .collect()

  return relations.map((r) => r.toEntityId)
}

export async function getScopeFilters(
  ctx: QueryCtx,
  actor: ActorContext,
  entityTypeSlug: string
): Promise<ScopeFilter[]> {
  if (actor.actorType === "system" || actor.isOrgAdmin) {
    return []
  }

  if (actor.roleIds.length === 0 && actor.actorType === "user") {
    return []
  }

  const policies = await loadPoliciesForResource(ctx, actor.organizationId, entityTypeSlug)

  const applicablePolicies = policies.filter(
    (p) => actor.roleIds.includes(p.roleId) && p.effect === "allow"
  )

  const filters: ScopeFilter[] = []
  let actorEntityId: Id<"entities"> | null | undefined = undefined

  for (const policy of applicablePolicies) {
    const scopeRules = await ctx.db
      .query("scopeRules")
      .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
      .collect()

    for (const rule of scopeRules) {
      if (rule.type === "field" && rule.field && rule.operator) {
        let value: unknown

        if (rule.value === "actor.userId") {
          value = actor.actorId
        } else if (rule.value === "actor.organizationId") {
          value = actor.organizationId
        } else if (rule.value === "actor.entityId") {
          if (actorEntityId === undefined) {
            actorEntityId = await resolveActorEntityId(ctx, actor)
          }
          value = actorEntityId
        } else if (rule.value?.startsWith("actor.relatedIds:")) {
          const relationType = rule.value.slice("actor.relatedIds:".length)
          if (actorEntityId === undefined) {
            actorEntityId = await resolveActorEntityId(ctx, actor)
          }
          if (actorEntityId) {
            value = await resolveRelatedEntityIds(ctx, actor, actorEntityId, relationType)
          } else {
            value = []
          }
        } else if (rule.value?.startsWith("literal:")) {
          value = rule.value.slice(8)
        } else {
          value = rule.value
        }

        filters.push({
          field: rule.field,
          operator: rule.operator as ScopeFilter["operator"],
          value,
        })
      }
    }
  }

  return filters
}

export function applyScopeFiltersToQuery<T extends Record<string, unknown>>(
  records: T[],
  filters: ScopeFilter[]
): T[] {
  if (filters.length === 0) {
    return records
  }

  return records.filter((record) => {
    return filters.some((filter) => {
      const fieldValue = getNestedValue(record, filter.field)

      switch (filter.operator) {
        case "eq":
          return fieldValue === filter.value
        case "neq":
          return fieldValue !== filter.value
        case "in":
          return Array.isArray(filter.value) && filter.value.includes(fieldValue)
        case "contains":
          return (
            typeof fieldValue === "string" &&
            typeof filter.value === "string" &&
            fieldValue.includes(filter.value)
          )
        default:
          return false
      }
    })
  })
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}
