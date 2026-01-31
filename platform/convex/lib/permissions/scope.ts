import { QueryCtx } from "../../_generated/server"
import { ActorContext, ScopeFilter } from "./types"

export async function getScopeFilters(
  ctx: QueryCtx,
  actor: ActorContext,
  entityTypeSlug: string
): Promise<ScopeFilter[]> {
  if (actor.actorType === "system" || actor.isOrgAdmin) {
    return []
  }

  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", actor.organizationId).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) {
    return []
  }

  const policies = await ctx.db
    .query("policies")
    .withIndex("by_org_resource", (q) => q.eq("organizationId", actor.organizationId))
    .filter((q) =>
      q.or(
        q.eq(q.field("resource"), entityTypeSlug),
        q.eq(q.field("resource"), "*")
      )
    )
    .collect()

  const applicablePolicies = policies.filter(
    (p) => actor.roleIds.includes(p.roleId) && p.effect === "allow"
  )

  const filters: ScopeFilter[] = []

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
    return filters.every((filter) => {
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
