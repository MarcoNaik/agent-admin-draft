import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"

export const list = query({
  args: {
    entityId: v.optional(v.id("entities")),
    eventType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    if (args.entityId) {
      return await ctx.db
        .query("events")
        .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
        .order("desc")
        .take(args.limit ?? 50)
    }

    if (args.eventType) {
      const eventType = args.eventType
      return await ctx.db
        .query("events")
        .withIndex("by_org_type", (q) =>
          q.eq("organizationId", auth.organizationId).eq("eventType", eventType)
        )
        .order("desc")
        .take(args.limit ?? 50)
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
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const event = await ctx.db.get(args.id)

    if (!event || event.organizationId !== auth.organizationId) {
      return null
    }

    return event
  },
})

export const getByEntity = query({
  args: {
    entityId: v.id("entities"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    const entity = await ctx.db.get(args.entityId)
    if (!entity || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
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
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    let events = await ctx.db
      .query("events")
      .withIndex("by_org_timestamp", (q) =>
        q.eq("organizationId", auth.organizationId)
      )
      .order("desc")
      .take(args.limit ?? 100)

    if (args.since) {
      events = events.filter((e) => e.timestamp >= args.since!)
    }

    return events
  },
})

export const getEventTypes = query({
  args: {},
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
