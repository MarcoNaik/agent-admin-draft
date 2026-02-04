export { ActorContext, ActorType, Action, Environment, PermissionResult, PermissionError, ScopeFilter, FieldMaskResult } from "./types"
export { buildActorContext, buildSystemActorContext } from "./context"
export { canPerform, assertCanPerform } from "./evaluate"
export { getScopeFilters, applyScopeFiltersToQuery } from "./scope"
export { getFieldMask, applyFieldMask } from "./mask"
export { canUseTool, getToolIdentity, ToolPermissionResult } from "./tools"

import { QueryCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"
import { ActorContext } from "./types"
import { canPerform } from "./evaluate"
import { getScopeFilters, applyScopeFiltersToQuery } from "./scope"
import { getFieldMask, applyFieldMask } from "./mask"

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

  const entities = await ctx.db
    .query("entities")
    .withIndex("by_org_env_type", (q) =>
      q.eq("organizationId", actor.organizationId).eq("environment", actor.environment).eq("entityTypeId", entityType._id)
    )
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .collect()

  const scopeFilters = await getScopeFilters(ctx, actor, entityTypeSlug)
  const scopedEntities = applyScopeFiltersToQuery(entities as unknown as T[], scopeFilters)

  const fieldMask = await getFieldMask(ctx, actor, entityTypeSlug)
  const maskedEntities = scopedEntities.map((e) => applyFieldMask(e, fieldMask))

  return maskedEntities
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
