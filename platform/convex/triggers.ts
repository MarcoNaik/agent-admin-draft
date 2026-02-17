import { v } from "convex/values"
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { resolveTemplateVars } from "./lib/triggers"
import { getAuthContext } from "./lib/auth"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

const BUILTIN_TOOLS: Record<string, { type: "mutation" | "query" | "action"; ref: string }> = {
  "entity.create": { type: "mutation", ref: "entityCreate" },
  "entity.get": { type: "query", ref: "entityGet" },
  "entity.query": { type: "query", ref: "entityQuery" },
  "entity.update": { type: "mutation", ref: "entityUpdate" },
  "entity.delete": { type: "mutation", ref: "entityDelete" },
  "entity.link": { type: "mutation", ref: "entityLink" },
  "entity.unlink": { type: "mutation", ref: "entityUnlink" },
  "event.emit": { type: "mutation", ref: "eventEmit" },
  "event.query": { type: "query", ref: "eventQuery" },
  "job.enqueue": { type: "mutation", ref: "jobEnqueue" },
  "job.status": { type: "query", ref: "jobStatus" },
  "calendar.list": { type: "action", ref: "calendarList" },
  "calendar.create": { type: "action", ref: "calendarCreate" },
  "calendar.update": { type: "action", ref: "calendarUpdate" },
  "calendar.delete": { type: "action", ref: "calendarDelete" },
  "calendar.freeBusy": { type: "action", ref: "calendarFreeBusy" },
}

export const execute = internalAction({
  args: {
    triggerId: v.id("triggers"),
    entityId: v.id("entities"),
    entityTypeSlug: v.string(),
    action: v.string(),
    data: v.any(),
    previousData: v.optional(v.any()),
    organizationId: v.id("organizations"),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    const trigger = await ctx.runQuery(internal.triggers.get, {
      triggerId: args.triggerId,
    })

    if (!trigger || !trigger.enabled) {
      return
    }

    const templateContext: Record<string, unknown> = {
      trigger: {
        entityId: args.entityId,
        entityType: args.entityTypeSlug,
        action: args.action,
        data: args.data,
        previousData: args.previousData,
      },
      steps: {} as Record<string, unknown>,
    }

    const steps = templateContext.steps as Record<string, unknown>
    const executionLog: Array<{
      tool: string
      as?: string
      args: Record<string, unknown>
      status: "success" | "failed"
      result?: unknown
      error?: string
      stack?: string
      durationMs: number
    }> = []

    for (let i = 0; i < trigger.actions.length; i++) {
      const triggerAction = trigger.actions[i]
      const resolvedArgs = resolveTemplateVars(
        triggerAction.args,
        templateContext
      ) as Record<string, unknown>

      const startTime = Date.now()

      try {
        const result = await executeToolAction(ctx, {
          organizationId: args.organizationId,
          environment: args.environment,
          tool: triggerAction.tool,
          args: resolvedArgs,
        })

        executionLog.push({
          tool: triggerAction.tool,
          as: triggerAction.as,
          args: resolvedArgs,
          status: "success",
          result,
          durationMs: Date.now() - startTime,
        })

        if (triggerAction.as) {
          steps[triggerAction.as] = result
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined

        executionLog.push({
          tool: triggerAction.tool,
          as: triggerAction.as,
          args: resolvedArgs,
          status: "failed",
          error: errorMessage,
          stack: errorStack,
          durationMs: Date.now() - startTime,
        })

        await ctx.runMutation(internal.triggers.emitTriggerEvent, {
          organizationId: args.organizationId,
          environment: args.environment,
          entityId: args.entityId,
          eventType: "trigger.failed",
          payload: {
            triggerSlug: trigger.slug,
            triggerName: trigger.name,
            failedAction: triggerAction.tool,
            failedActionIndex: i,
            totalActions: trigger.actions.length,
            error: errorMessage,
            stack: errorStack,
            executionLog,
            triggerData: args.data,
          },
        })
        return
      }
    }

    await ctx.runMutation(internal.triggers.emitTriggerEvent, {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId: args.entityId,
      eventType: "trigger.executed",
      payload: {
        triggerSlug: trigger.slug,
        triggerName: trigger.name,
        actionsCount: trigger.actions.length,
        executionLog,
      },
    })
  },
})

async function executeToolAction(
  ctx: any,
  params: {
    organizationId: Id<"organizations">
    environment: "development" | "production"
    tool: string
    args: Record<string, unknown>
  }
): Promise<unknown> {
  const { organizationId, environment, tool, args } = params
  const actorId = "system"
  const actorType = "system" as const

  switch (tool) {
    case "entity.create":
      return await ctx.runMutation(internal.tools.entities.entityCreate, {
        organizationId, actorId, actorType, environment,
        type: args.type as string,
        data: args.data,
        status: args.status as string | undefined,
      })

    case "entity.get":
      return await ctx.runQuery(internal.tools.entities.entityGet, {
        organizationId, actorId, actorType, environment,
        id: args.id as string,
      })

    case "entity.query":
      return await ctx.runQuery(internal.tools.entities.entityQuery, {
        organizationId, actorId, actorType, environment,
        type: args.type as string,
        filters: args.filters,
        status: args.status as string | undefined,
        limit: args.limit as number | undefined,
      })

    case "entity.update":
      return await ctx.runMutation(internal.tools.entities.entityUpdate, {
        organizationId, actorId, actorType, environment,
        id: args.id as string,
        data: args.data,
        status: args.status as string | undefined,
      })

    case "entity.delete":
      return await ctx.runMutation(internal.tools.entities.entityDelete, {
        organizationId, actorId, actorType, environment,
        id: args.id as string,
      })

    case "entity.link":
      return await ctx.runMutation(internal.tools.entities.entityLink, {
        organizationId, actorId, actorType, environment,
        fromId: args.fromId as string,
        toId: args.toId as string,
        relationType: args.relationType as string,
        metadata: args.metadata,
      })

    case "entity.unlink":
      return await ctx.runMutation(internal.tools.entities.entityUnlink, {
        organizationId, actorId, actorType, environment,
        fromId: args.fromId as string,
        toId: args.toId as string,
        relationType: args.relationType as string,
      })

    case "event.emit":
      return await ctx.runMutation(internal.tools.events.eventEmit, {
        organizationId, actorId, actorType, environment,
        entityId: args.entityId as string | undefined,
        entityTypeSlug: args.entityTypeSlug as string | undefined,
        eventType: args.eventType as string,
        payload: args.payload,
      })

    case "event.query":
      return await ctx.runQuery(internal.tools.events.eventQuery, {
        organizationId, environment,
        entityId: args.entityId as string | undefined,
        eventType: args.eventType as string | undefined,
        since: args.since as number | undefined,
        limit: args.limit as number | undefined,
      })

    case "job.enqueue":
      return await ctx.runMutation(internal.tools.jobs.jobEnqueue, {
        organizationId, actorId, actorType, environment,
        jobType: args.jobType as string,
        payload: args.payload,
        scheduledFor: args.scheduledFor as number | undefined,
        priority: args.priority as number | undefined,
        maxAttempts: args.maxAttempts as number | undefined,
        idempotencyKey: args.idempotencyKey as string | undefined,
        entityId: args.entityId as string | undefined,
      })

    case "job.status":
      return await ctx.runQuery(internal.tools.jobs.jobStatus, {
        organizationId,
        id: args.id as string,
      })

    case "calendar.list":
      return await ctx.runAction(internal.tools.calendar.calendarList, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        timeMin: args.timeMin as string,
        timeMax: args.timeMax as string,
        maxResults: args.maxResults as number | undefined,
      })

    case "calendar.create":
      return await ctx.runAction(internal.tools.calendar.calendarCreate, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        summary: args.summary as string,
        startTime: args.startTime as string,
        endTime: args.endTime as string,
        description: args.description as string | undefined,
        attendees: args.attendees as string[] | undefined,
        timeZone: args.timeZone as string | undefined,
      })

    case "calendar.update":
      return await ctx.runAction(internal.tools.calendar.calendarUpdate, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        eventId: args.eventId as string,
        summary: args.summary as string | undefined,
        startTime: args.startTime as string | undefined,
        endTime: args.endTime as string | undefined,
        description: args.description as string | undefined,
        attendees: args.attendees as string[] | undefined,
        status: args.status as string | undefined,
      })

    case "calendar.delete":
      return await ctx.runAction(internal.tools.calendar.calendarDelete, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        eventId: args.eventId as string,
      })

    case "calendar.freeBusy":
      return await ctx.runAction(internal.tools.calendar.calendarFreeBusy, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        timeMin: args.timeMin as string,
        timeMax: args.timeMax as string,
      })

    default:
      throw new Error(`Unknown tool: ${tool}`)
  }
}

export const get = internalQuery({
  args: {
    triggerId: v.id("triggers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.triggerId)
  },
})

export const emitTriggerEvent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    entityId: v.id("entities"),
    eventType: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId: args.entityId,
      eventType: args.eventType,
      schemaVersion: 1,
      actorId: "system",
      actorType: "system",
      payload: args.payload,
      timestamp: Date.now(),
    })
  },
})

export const list = query({
  args: {
    environment: v.optional(environmentValidator),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    return await ctx.db
      .query("triggers")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", environment))
      .collect()
  },
})

export const listExecutions = query({
  args: {
    environment: v.optional(environmentValidator),
    triggerSlug: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"
    const limit = args.limit ?? 20

    const [executed, failed] = await Promise.all([
      ctx.db
        .query("events")
        .withIndex("by_org_env_type", (q) =>
          q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("eventType", "trigger.executed")
        )
        .order("desc")
        .take(100),
      ctx.db
        .query("events")
        .withIndex("by_org_env_type", (q) =>
          q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("eventType", "trigger.failed")
        )
        .order("desc")
        .take(100),
    ])

    let merged = [...executed, ...failed]

    if (args.triggerSlug) {
      merged = merged.filter((e) => e.payload?.triggerSlug === args.triggerSlug)
    }

    merged.sort((a, b) => b.timestamp - a.timestamp)

    return merged.slice(0, limit)
  },
})

export const getLastRunStatuses = query({
  args: {
    environment: v.optional(environmentValidator),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    const [executed, failed] = await Promise.all([
      ctx.db
        .query("events")
        .withIndex("by_org_env_type", (q) =>
          q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("eventType", "trigger.executed")
        )
        .order("desc")
        .take(100),
      ctx.db
        .query("events")
        .withIndex("by_org_env_type", (q) =>
          q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("eventType", "trigger.failed")
        )
        .order("desc")
        .take(100),
    ])

    const statuses: Record<string, { status: string; timestamp: number; error?: string; entityId?: string }> = {}

    for (const event of [...executed, ...failed]) {
      const slug = event.payload?.triggerSlug as string | undefined
      if (!slug) continue
      if (statuses[slug] && statuses[slug].timestamp >= event.timestamp) continue

      statuses[slug] = {
        status: event.eventType === "trigger.executed" ? "success" : "failed",
        timestamp: event.timestamp,
        error: event.payload?.error as string | undefined,
        entityId: event.entityId as string | undefined,
      }
    }

    return statuses
  },
})
