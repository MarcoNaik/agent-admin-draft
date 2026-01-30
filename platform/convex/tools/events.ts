import { v } from "convex/values"
import { internalMutation, internalQuery } from "../_generated/server"
import { Id } from "../_generated/dataModel"

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
    entityId: v.optional(v.string()),
    eventType: v.optional(v.string()),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.entityId) {
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

    if (args.eventType) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_org_type", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("eventType", args.eventType!)
        )
        .order("desc")
        .take(args.limit ?? 50)

      if (args.since) {
        return events.filter((e) => e.timestamp >= args.since!)
      }
      return events
    }

    const events = await ctx.db
      .query("events")
      .withIndex("by_org_timestamp", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .order("desc")
      .take(args.limit ?? 50)

    if (args.since) {
      return events.filter((e) => e.timestamp >= args.since!)
    }
    return events
  },
})
