import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { Id } from "./_generated/dataModel"
import { getAuthContext, requireAuth } from "./lib/auth"
import {
  buildActorContext,
  canPerform,
  getScopeFilters,
  applyScopeFiltersToQuery,
} from "./lib/permissions"

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

export const list = query({
  args: {
    entityId: v.optional(v.id("entities")),
    entityTypeSlug: v.optional(v.string()),
    eventType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    if (args.entityId) {
      const entity = await ctx.db.get(args.entityId)
      if (!entity || entity.organizationId !== auth.organizationId) {
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

      return await ctx.db
        .query("events")
        .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
        .order("desc")
        .take(args.limit ?? 50)
    }

    if (args.entityTypeSlug) {
      const canList = await canPerform(ctx, actor, "list", args.entityTypeSlug)
      if (!canList.allowed) {
        return []
      }

      const entityType = await ctx.db
        .query("entityTypes")
        .withIndex("by_org_slug", (q) =>
          q.eq("organizationId", auth.organizationId).eq("slug", args.entityTypeSlug!)
        )
        .first()

      if (!entityType) {
        return []
      }

      const events = await ctx.db
        .query("events")
        .withIndex("by_org_timestamp", (q) =>
          q.eq("organizationId", auth.organizationId)
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
        args.entityTypeSlug!,
        entityIds
      )

      return filteredEvents
        .filter((e) => !e.entityId || visibleEntityIds.has(e.entityId))
        .slice(0, args.limit ?? 50)
    }

    if (args.eventType) {
      const eventType = args.eventType
      const events = await ctx.db
        .query("events")
        .withIndex("by_org_type", (q) =>
          q.eq("organizationId", auth.organizationId).eq("eventType", eventType)
        )
        .order("desc")
        .take((args.limit ?? 50) * 3)

      const eventsWithEntities = events.filter(
        (e) => e.entityId && e.entityTypeSlug
      )
      const entityTypeSlugToEntityIds = new Map<string, Id<"entities">[]>()
      for (const event of eventsWithEntities) {
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

      return events
        .filter((e) => !e.entityId || allVisibleEntityIds.has(e.entityId))
        .slice(0, args.limit ?? 50)
    }

    return await ctx.db
      .query("events")
      .withIndex("by_org_timestamp", (q) =>
        q.eq("organizationId", auth.organizationId)
      )
      .order("desc")
      .take(args.limit ?? 50)
  },
})

export const get = query({
  args: { id: v.id("events") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const event = await ctx.db.get(args.id)

    if (!event || event.organizationId !== auth.organizationId) {
      return null
    }

    if (event.entityId && event.entityTypeSlug) {
      const actor = await buildActorContext(ctx, {
        organizationId: auth.organizationId,
        actorType: auth.actorType,
        actorId: auth.userId,
      })

      const entity = await ctx.db.get(event.entityId)
      if (!entity) {
        return null
      }

      const canRead = await canPerform(
        ctx,
        actor,
        "read",
        event.entityTypeSlug,
        entity as unknown as Record<string, unknown>
      )
      if (!canRead.allowed) {
        return null
      }

      const scopeFilters = await getScopeFilters(ctx, actor, event.entityTypeSlug)
      const scoped = applyScopeFiltersToQuery(
        [entity as unknown as Record<string, unknown>],
        scopeFilters
      )
      if (scoped.length === 0) {
        return null
      }
    }

    return event
  },
})

export const getByEntity = query({
  args: {
    entityId: v.id("entities"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    const entity = await ctx.db.get(args.entityId)
    if (!entity || entity.organizationId !== auth.organizationId) {
      return []
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType) {
      return []
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

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

    return await ctx.db
      .query("events")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .order("desc")
      .take(args.limit ?? 50)
  },
})

export const emit = mutation({
  args: {
    entityId: v.optional(v.id("entities")),
    entityTypeSlug: v.optional(v.string()),
    eventType: v.string(),
    payload: v.any(),
    actorType: v.optional(
      v.union(
        v.literal("user"),
        v.literal("agent"),
        v.literal("system"),
        v.literal("webhook")
      )
    ),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    if (args.entityId) {
      const entity = await ctx.db.get(args.entityId)
      if (!entity || entity.organizationId !== auth.organizationId) {
        throw new Error("Entity not found")
      }
    }

    const now = Date.now()
    return await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      entityId: args.entityId,
      entityTypeSlug: args.entityTypeSlug,
      eventType: args.eventType,
      schemaVersion: 1,
      actorId: auth.userId,
      actorType: args.actorType ?? auth.actorType,
      payload: args.payload,
      timestamp: now,
    })
  },
})

export const getRecent = query({
  args: {
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    let events = await ctx.db
      .query("events")
      .withIndex("by_org_timestamp", (q) =>
        q.eq("organizationId", auth.organizationId)
      )
      .order("desc")
      .take((args.limit ?? 100) * 3)

    if (args.since) {
      events = events.filter((e) => e.timestamp >= args.since!)
    }

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

    return events
      .filter((e) => !e.entityId || allVisibleEntityIds.has(e.entityId))
      .slice(0, args.limit ?? 100)
  },
})

export const getEventTypes = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx)

    const events = await ctx.db
      .query("events")
      .withIndex("by_org_timestamp", (q) =>
        q.eq("organizationId", auth.organizationId)
      )
      .take(1000)

    const types = new Set<string>()
    events.forEach((e) => types.add(e.eventType))

    return Array.from(types).sort()
  },
})
