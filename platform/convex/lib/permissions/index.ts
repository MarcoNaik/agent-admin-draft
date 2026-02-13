export { ActorContext, ActorType, Action, Environment, PermissionResult, PermissionError, ScopeFilter, FieldMaskResult } from "./types"
export { buildActorContext, buildSystemActorContext } from "./context"
export { canPerform, assertCanPerform, loadPoliciesForResource } from "./evaluate"
export { getScopeFilters, applyScopeFiltersToQuery } from "./scope"
export { getFieldMask, applyFieldMask } from "./mask"
export { canUseTool, getToolIdentity, ToolPermissionResult } from "./tools"

import { QueryCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"
import { ActorContext, ScopeFilter } from "./types"
import { canPerform } from "./evaluate"
import { getScopeFilters, applyScopeFiltersToQuery } from "./scope"
import { getFieldMask, applyFieldMask } from "./mask"

function buildConvexScopeExpression(q: any, filters: ScopeFilter[]): any {
  const conditions = filters.map((f) => {
    const field = q.field(f.field)
    switch (f.operator) {
      case "eq":
        return q.eq(field, f.value)
      case "neq":
        return q.neq(field, f.value)
      case "in": {
        const arr = f.value as unknown[]
        if (arr.length === 0) return q.eq(q.field("_id"), "__scope_empty__")
        if (arr.length === 1) return q.eq(field, arr[0])
        return q.or(...arr.map((v: unknown) => q.eq(field, v)))
      }
      default:
        return q.eq(q.field("_id"), q.field("_id"))
    }
  })
  if (conditions.length === 0) return null
  if (conditions.length === 1) return conditions[0]
  return q.or(...conditions)
}

export async function queryEntitiesAsActor<T extends Record<string, unknown>>(
  ctx: QueryCtx,
  actor: ActorContext,
  entityTypeSlug: string
): Promise<Partial<T>[]> {
  const permission = await canPerform(ctx, actor, "list", entityTypeSlug)
  if (!permission.allowed) {
    return []
  }

  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_env_slug", (q) =>
      q.eq("organizationId", actor.organizationId).eq("environment", actor.environment).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) {
    return []
  }

  const scopeFilters = await getScopeFilters(ctx, actor, entityTypeSlug)

  const hasContains = scopeFilters.some((f) => f.operator === "contains")

  let entities: T[]
  if (scopeFilters.length === 0 || hasContains) {
    const raw = await ctx.db
      .query("entities")
      .withIndex("by_org_env_type", (q) =>
        q.eq("organizationId", actor.organizationId).eq("environment", actor.environment).eq("entityTypeId", entityType._id)
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect()
    entities = hasContains
      ? applyScopeFiltersToQuery(raw as unknown as T[], scopeFilters)
      : (raw as unknown as T[])
  } else {
    const raw = await ctx.db
      .query("entities")
      .withIndex("by_org_env_type", (q) =>
        q.eq("organizationId", actor.organizationId).eq("environment", actor.environment).eq("entityTypeId", entityType._id)
      )
      .filter((q: any) => {
        const notDeleted = q.eq(q.field("deletedAt"), undefined)
        const scopeExpr = buildConvexScopeExpression(q, scopeFilters)
        return scopeExpr ? q.and(notDeleted, scopeExpr) : notDeleted
      })
      .collect()
    entities = raw as unknown as T[]
  }

  const fieldMask = await getFieldMask(ctx, actor, entityTypeSlug)
  return entities.map((e) => applyFieldMask(e, fieldMask))
}

export async function getEntityAsActor<T extends Record<string, unknown>>(
  ctx: QueryCtx,
  actor: ActorContext,
  entityTypeSlug: string,
  entityId: Id<"entities">
): Promise<Partial<T> | null> {
  const entity = await ctx.db.get(entityId)

  if (!entity || entity.organizationId !== actor.organizationId) {
    return null
  }

  if (entity.environment !== actor.environment) {
    return null
  }

  if (entity.deletedAt) {
    return null
  }

  const entityType = await ctx.db.get(entity.entityTypeId)
  if (!entityType || entityType.slug !== entityTypeSlug) {
    return null
  }

  const permission = await canPerform(ctx, actor, "read", entityTypeSlug, entity as unknown as Record<string, unknown>)
  if (!permission.allowed) {
    return null
  }

  const scopeFilters = await getScopeFilters(ctx, actor, entityTypeSlug)
  const scoped = applyScopeFiltersToQuery([entity as unknown as T], scopeFilters)
  if (scoped.length === 0) {
    return null
  }

  const fieldMask = await getFieldMask(ctx, actor, entityTypeSlug)
  return applyFieldMask(scoped[0], fieldMask)
}
