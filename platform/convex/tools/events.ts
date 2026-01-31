import { v } from "convex/values"
import { internalMutation, internalQuery } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import {
  buildActorContext,
  canPerform,
  getScopeFilters,
  applyScopeFiltersToQuery,
  ActorType,
} from "../lib/permissions"

async function filterVisibleEntityIds(
  ctx: Parameters<typeof canPerform>[0],
  actor: Awaited<ReturnType<typeof buildActorContext>>,
  entityTypeSlug: string,
  entityIds: Id<"entities">[]
): Promise<Set<Id<"entities">>> {
  const scopeFilters = await getScopeFilters(ctx, actor, entityTypeSlug)
  if (scopeFilters.length === 0 && actor.actorType !== "system") {
    return new Set(entityIds)
  }

  const visible = new Set<Id<"entities">>()
  for (const entityId of entityIds) {
    const entity = await ctx.db.get(entityId)
    if (entity) {
      const scoped = applyScopeFiltersToQuery(
        [entity as unknown as Record<string, unknown>],
        scopeFilters
      )
      if (scoped.length > 0) {
        visible.add(entityId)
      }
    }
  }
  return visible
}

export const eventEmit = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("webhook")
    ),
    entityId: v.optional(v.string()),
    entityTypeSlug: v.optional(v.string()),
    eventType: v.string(),
    payload: v.any(),
  },
  returns: v.object({ id: v.id("events") }),
  handler: async (ctx, args) => {
    if (args.entityId) {
      const entity = await ctx.db.get(args.entityId as Id<"entities">)
      if (!entity || entity.organizationId !== args.organizationId) {
        throw new Error("Entity not found")
      }
    }

    const now = Date.now()
    const eventId = await ctx.db.insert("events", {
      organizationId: args.organizationId,
      entityId: args.entityId as Id<"entities"> | undefined,
      entityTypeSlug: args.entityTypeSlug,
      eventType: args.eventType,
      schemaVersion: 1,
      actorId: args.actorId,
      actorType: args.actorType,
      payload: args.payload,
      timestamp: now,
    })

    return { id: eventId }
  },
})

export const eventQuery = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("webhook")
    ),
    entityId: v.optional(v.string()),
    entityTypeSlug: v.optional(v.string()),
    eventType: v.optional(v.string()),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await buildActorContext(ctx, {
      organizationId: args.organizationId,
      actorType: args.actorType as ActorType,
      actorId: args.actorId,
    })

    if (args.entityId) {
      const entity = await ctx.db.get(args.entityId as Id<"entities">)
      if (!entity || entity.organizationId !== args.organizationId) {
        return []
      }

      const entityType = await ctx.db.get(entity.entityTypeId)
      if (!entityType) {
        return []
      }

      const canRead = await canPerform(
        ctx,
        actor,
        "read",
        entityType.slug,
        entity as unknown as Record<string, unknown>
      )
      if (!canRead.allowed) {
        return []
      }

      const scopeFilters = await getScopeFilters(ctx, actor, entityType.slug)
      const scoped = applyScopeFiltersToQuery(
        [entity as unknown as Record<string, unknown>],
        scopeFilters
      )
      if (scoped.length === 0) {
        return []
      }

      const events = await ctx.db
        .query("events")
        .withIndex("by_entity", (q) =>
          q.eq("entityId", args.entityId as Id<"entities">)
        )
        .order("desc")
        .take(args.limit ?? 50)

      if (args.since) {
        return events.filter((e) => e.timestamp >= args.since!)
      }
      return events
    }

    if (args.entityTypeSlug) {
      const canList = await canPerform(ctx, actor, "list", args.entityTypeSlug)
      if (!canList.allowed) {
        return []
      }

      const events = await ctx.db
        .query("events")
        .withIndex("by_org_timestamp", (q) =>
          q.eq("organizationId", args.organizationId)
        )
        .order("desc")
        .take((args.limit ?? 50) * 3)

      const filteredEvents = events.filter(
        (e) => e.entityTypeSlug === args.entityTypeSlug
      )

      const entityIds = [
        ...new Set(
          filteredEvents
            .map((e) => e.entityId)
            .filter((id): id is Id<"entities"> => id !== undefined)
        ),
      ]
      const visibleEntityIds = await filterVisibleEntityIds(
        ctx,
        actor,
        args.entityTypeSlug,
        entityIds
      )

      let result = filteredEvents
        .filter((e) => !e.entityId || visibleEntityIds.has(e.entityId))
        .slice(0, args.limit ?? 50)

      if (args.since) {
        result = result.filter((e) => e.timestamp >= args.since!)
      }
      return result
    }

    if (args.eventType) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_org_type", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("eventType", args.eventType!)
        )
        .order("desc")
        .take((args.limit ?? 50) * 3)

      const entityTypeSlugToEntityIds = new Map<string, Id<"entities">[]>()
      for (const event of events) {
        if (event.entityTypeSlug && event.entityId) {
          const ids = entityTypeSlugToEntityIds.get(event.entityTypeSlug) ?? []
          ids.push(event.entityId)
          entityTypeSlugToEntityIds.set(event.entityTypeSlug, ids)
        }
      }

      const allVisibleEntityIds = new Set<Id<"entities">>()
      for (const [slug, ids] of entityTypeSlugToEntityIds) {
        const canList = await canPerform(ctx, actor, "list", slug)
        if (canList.allowed) {
          const visible = await filterVisibleEntityIds(ctx, actor, slug, ids)
          for (const id of visible) {
            allVisibleEntityIds.add(id)
          }
        }
      }

      let result = events
        .filter((e) => !e.entityId || allVisibleEntityIds.has(e.entityId))
        .slice(0, args.limit ?? 50)

      if (args.since) {
        result = result.filter((e) => e.timestamp >= args.since!)
      }
      return result
    }

    const events = await ctx.db
      .query("events")
      .withIndex("by_org_timestamp", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .order("desc")
      .take((args.limit ?? 50) * 3)

    const entityTypeSlugToEntityIds = new Map<string, Id<"entities">[]>()
    for (const event of events) {
      if (event.entityTypeSlug && event.entityId) {
        const ids = entityTypeSlugToEntityIds.get(event.entityTypeSlug) ?? []
        ids.push(event.entityId)
        entityTypeSlugToEntityIds.set(event.entityTypeSlug, ids)
      }
    }

    const allVisibleEntityIds = new Set<Id<"entities">>()
    for (const [slug, ids] of entityTypeSlugToEntityIds) {
      const canList = await canPerform(ctx, actor, "list", slug)
      if (canList.allowed) {
        const visible = await filterVisibleEntityIds(ctx, actor, slug, ids)
        for (const id of visible) {
          allVisibleEntityIds.add(id)
        }
      }
    }

    let result = events
      .filter((e) => !e.entityId || allVisibleEntityIds.has(e.entityId))
      .slice(0, args.limit ?? 50)

    if (args.since) {
      result = result.filter((e) => e.timestamp >= args.since!)
    }
    return result
  },
})
