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
import { Environment } from "./lib/permissions/types"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

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
    environment: v.optional(environmentValidator),
    entityId: v.optional(v.id("entities")),
    entityTypeSlug: v.optional(v.string()),
    eventType: v.optional(v.string()),
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
        .withIndex("by_org_env_slug", (q) =>
          q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("slug", args.entityTypeSlug!)
        )
        .first()

      if (!entityType) {
        return []
      }

      const events = await ctx.db
        .query("events")
        .withIndex("by_org_env_timestamp", (q) =>
          q.eq("organizationId", auth.organizationId).eq("environment", environment)
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
        .withIndex("by_org_env_type", (q) =>
          q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("eventType", eventType)
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
      .withIndex("by_org_env_timestamp", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment)
      )
      .order("desc")
      .take(args.limit ?? 50)
  },
})

export const get = query({
  args: { id: v.id("events"), environment: v.optional(environmentValidator) },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment: Environment = args.environment ?? "development"
    const event = await ctx.db.get(args.id)

    if (!event || event.organizationId !== auth.organizationId) {
      return null
    }

    if (event.entityId && event.entityTypeSlug) {
      const actor = await buildActorContext(ctx, {
        organizationId: auth.organizationId,
        actorType: auth.actorType,
        actorId: auth.userId,
        environment,
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
    environment: v.optional(environmentValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment: Environment = args.environment ?? "development"

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
      environment,
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
    environment: v.optional(environmentValidator),
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
    const environment: Environment = args.environment ?? "development"

    if (args.entityId) {
      const entity = await ctx.db.get(args.entityId)
      if (!entity || entity.organizationId !== auth.organizationId) {
        throw new Error("Entity not found")
      }
    }

    const now = Date.now()
    return await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment,
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
    environment: v.optional(environmentValidator),
    since: v.optional(v.number()),
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

    let events = await ctx.db
      .query("events")
      .withIndex("by_org_env_timestamp", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment)
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

const SYNC_EVENT_TYPES = new Set([
  "sync.completed",
  "sync.failed",
  "deploy.completed",
  "deploy.failed",
])

export const listSyncEvents = query({
  args: {
    environment: v.optional(environmentValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment: Environment = args.environment ?? "development"
    const limit = args.limit ?? 20

    const events = await ctx.db
      .query("events")
      .withIndex("by_org_env_timestamp", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment)
      )
      .order("desc")
      .take(limit * 5)

    return events
      .filter((e) => SYNC_EVENT_TYPES.has(e.eventType))
      .slice(0, limit)
  },
})

export const getEventTypes = query({
  args: {
    environment: v.optional(environmentValidator),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment: Environment = args.environment ?? "development"

    const events = await ctx.db
      .query("events")
      .withIndex("by_org_env_timestamp", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment)
      )
      .take(1000)

    const types = new Set<string>()
    events.forEach((e) => types.add(e.eventType))

    return Array.from(types).sort()
  },
})
