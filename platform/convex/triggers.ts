import { v } from "convex/values"
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { Id } from "./_generated/dataModel"
import { resolveTemplateVars } from "./lib/triggers"
import { getAuthContext, requireAuth } from "./lib/auth"
import { coerceTemplateComponents } from "./lib/toolExecution"

const getTriggerRef = makeFunctionReference<"query">("triggers:get")
const emitTriggerEventRef = makeFunctionReference<"mutation">("triggers:emitTriggerEvent")
const claimRunRef = makeFunctionReference<"mutation">("triggers:claimRun")
const getRunRef = makeFunctionReference<"query">("triggers:getRun")
const completeRunRef = makeFunctionReference<"mutation">("triggers:completeRun")
const failRunRef = makeFunctionReference<"mutation">("triggers:failRun")
const executeScheduledRef = makeFunctionReference<"action">("triggers:executeScheduled")
const entityCreateRef = makeFunctionReference<"mutation">("tools/entities:entityCreate")
const entityGetRef = makeFunctionReference<"query">("tools/entities:entityGet")
const entityQueryRef = makeFunctionReference<"query">("tools/entities:entityQuery")
const entityUpdateRef = makeFunctionReference<"mutation">("tools/entities:entityUpdate")
const entityDeleteRef = makeFunctionReference<"mutation">("tools/entities:entityDelete")
const entityLinkRef = makeFunctionReference<"mutation">("tools/entities:entityLink")
const entityUnlinkRef = makeFunctionReference<"mutation">("tools/entities:entityUnlink")
const eventEmitRef = makeFunctionReference<"mutation">("tools/events:eventEmit")
const eventQueryRef = makeFunctionReference<"query">("tools/events:eventQuery")
const calendarListRef = makeFunctionReference<"action">("tools/calendar:calendarList")
const calendarCreateRef = makeFunctionReference<"action">("tools/calendar:calendarCreate")
const calendarUpdateRef = makeFunctionReference<"action">("tools/calendar:calendarUpdate")
const calendarDeleteRef = makeFunctionReference<"action">("tools/calendar:calendarDelete")
const calendarFreeBusyRef = makeFunctionReference<"action">("tools/calendar:calendarFreeBusy")
const whatsappSendRef = makeFunctionReference<"action">("tools/whatsapp:whatsappSend")
const whatsappSendTemplateRef = makeFunctionReference<"action">("tools/whatsapp:whatsappSendTemplate")
const whatsappSendInteractiveRef = makeFunctionReference<"action">("tools/whatsapp:whatsappSendInteractive")
const whatsappSendMediaRef = makeFunctionReference<"action">("tools/whatsapp:whatsappSendMedia")
const whatsappListTemplatesRef = makeFunctionReference<"action">("tools/whatsapp:whatsappListTemplates")
const whatsappGetConversationRef = makeFunctionReference<"action">("tools/whatsapp:whatsappGetConversation")
const whatsappGetStatusRef = makeFunctionReference<"action">("tools/whatsapp:whatsappGetStatus")
const agentChatRef = makeFunctionReference<"action">("tools/agents:agentChat")
const executeCustomToolRef = makeFunctionReference<"action">("agent:executeCustomTool")

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

const BUILTIN_TOOLS: Record<string, { type: "mutation" | "query" | "action"; ref: string }> = {
  "entity.create": { type: "mutation", ref: "entityCreate" },
  "entity.get": { type: "query", ref: "entityGet" },
  "entity.query": { type: "query", ref: "entityQuery" },
  "entity.update": { type: "mutation", ref: "entityUpdate" },
  "entity.delete": { type: "mutation", ref: "entityDelete" },
  "entity.link": { type: "mutation", ref: "entityLink" },
  "entity.unlink": { type: "mutation", ref: "entityUnlink" },
  "calendar.list": { type: "action", ref: "calendarList" },
  "calendar.create": { type: "action", ref: "calendarCreate" },
  "calendar.update": { type: "action", ref: "calendarUpdate" },
  "calendar.delete": { type: "action", ref: "calendarDelete" },
  "calendar.freeBusy": { type: "action", ref: "calendarFreeBusy" },
  "whatsapp.send": { type: "action", ref: "whatsappSend" },
  "whatsapp.sendTemplate": { type: "action", ref: "whatsappSendTemplate" },
  "whatsapp.sendInteractive": { type: "action", ref: "whatsappSendInteractive" },
  "whatsapp.sendMedia": { type: "action", ref: "whatsappSendMedia" },
  "whatsapp.listTemplates": { type: "action", ref: "whatsappListTemplates" },
  "whatsapp.getConversation": { type: "action", ref: "whatsappGetConversation" },
  "whatsapp.getStatus": { type: "action", ref: "whatsappGetStatus" },
  "agent.chat": { type: "action", ref: "agentChat" },
}

async function executeActionPipeline(
  ctx: any,
  params: {
    organizationId: Id<"organizations">
    environment: "development" | "production" | "eval"
    entityId: Id<"entities">
    entityTypeSlug: string
    action: string
    data: Record<string, unknown>
    previousData?: Record<string, unknown>
    trigger: { slug: string; name: string; actions: Array<{ tool: string; args: any; as?: string }> }
  }
): Promise<{ success: boolean; executionLog: Array<Record<string, unknown>> }> {
  const templateContext: Record<string, unknown> = {
    trigger: {
      entityId: params.entityId,
      entityType: params.entityTypeSlug,
      action: params.action,
      data: params.data,
      previousData: params.previousData,
    },
    steps: {} as Record<string, unknown>,
  }

  const steps = templateContext.steps as Record<string, unknown>
  const executionLog: Array<Record<string, unknown>> = []

  for (let i = 0; i < params.trigger.actions.length; i++) {
    const triggerAction = params.trigger.actions[i]
    const resolvedArgs = resolveTemplateVars(
      triggerAction.args,
      templateContext
    ) as Record<string, unknown>

    const startTime = Date.now()

    try {
      const result = await executeToolAction(ctx, {
        organizationId: params.organizationId,
        environment: params.environment,
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

      return { success: false, executionLog }
    }
  }

  return { success: true, executionLog }
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
    const trigger = await ctx.runQuery(getTriggerRef, {
      triggerId: args.triggerId,
    })

    if (!trigger || !trigger.enabled) {
      return
    }

    const result = await executeActionPipeline(ctx, {
      organizationId: args.organizationId,
      environment: args.environment,
      entityId: args.entityId,
      entityTypeSlug: args.entityTypeSlug,
      action: args.action,
      data: args.data,
      previousData: args.previousData,
      trigger: { slug: trigger.slug, name: trigger.name, actions: trigger.actions },
    })

    if (result.success) {
      await ctx.runMutation(emitTriggerEventRef, {
        organizationId: args.organizationId,
        environment: args.environment,
        entityId: args.entityId,
        eventType: "trigger.executed",
        payload: {
          triggerSlug: trigger.slug,
          triggerName: trigger.name,
          actionsCount: trigger.actions.length,
          executionLog: result.executionLog,
        },
      })
    } else {
      const lastLog = result.executionLog[result.executionLog.length - 1]
      await ctx.runMutation(emitTriggerEventRef, {
        organizationId: args.organizationId,
        environment: args.environment,
        entityId: args.entityId,
        eventType: "trigger.failed",
        payload: {
          triggerSlug: trigger.slug,
          triggerName: trigger.name,
          failedAction: lastLog?.tool,
          failedActionIndex: result.executionLog.length - 1,
          totalActions: trigger.actions.length,
          error: lastLog?.error,
          stack: lastLog?.stack,
          executionLog: result.executionLog,
          triggerData: args.data,
        },
      })
    }
  },
})

export const executeScheduled = internalAction({
  args: {
    runId: v.id("triggerRuns"),
  },
  handler: async (ctx, args) => {
    const claimed = await ctx.runMutation(claimRunRef, {
      runId: args.runId,
    })

    if (!claimed) {
      return
    }

    const run = await ctx.runQuery(getRunRef, { runId: args.runId })
    if (!run) return

    const trigger = await ctx.runQuery(getTriggerRef, {
      triggerId: run.triggerId,
    })

    if (!trigger || !trigger.enabled) {
      await ctx.runMutation(completeRunRef, {
        runId: args.runId,
        result: { skipped: true, reason: "Trigger disabled or deleted" },
      })
      return
    }

    const entityTypeSlug = trigger.entityType

    try {
      const result = await executeActionPipeline(ctx, {
        organizationId: run.organizationId,
        environment: run.environment,
        entityId: run.entityId,
        entityTypeSlug,
        action: trigger.action,
        data: run.data as Record<string, unknown>,
        previousData: run.previousData as Record<string, unknown> | undefined,
        trigger: { slug: trigger.slug, name: trigger.name, actions: trigger.actions },
      })

      if (result.success) {
        await ctx.runMutation(completeRunRef, {
          runId: args.runId,
          result: { executionLog: result.executionLog },
        })

        await ctx.runMutation(emitTriggerEventRef, {
          organizationId: run.organizationId,
          environment: run.environment,
          entityId: run.entityId,
          eventType: "trigger.scheduled.completed",
          payload: {
            triggerSlug: trigger.slug,
            triggerName: trigger.name,
            runId: args.runId,
            actionsCount: trigger.actions.length,
            executionLog: result.executionLog,
          },
        })
      } else {
        const lastLog = result.executionLog[result.executionLog.length - 1]
        await ctx.runMutation(failRunRef, {
          runId: args.runId,
          errorMessage: (lastLog?.error as string) ?? "Action pipeline failed",
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await ctx.runMutation(failRunRef, {
        runId: args.runId,
        errorMessage,
      })
    }
  },
})

export const claimRun = internalMutation({
  args: {
    runId: v.id("triggerRuns"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run || run.status !== "pending") {
      return false
    }

    await ctx.db.patch(args.runId, {
      status: "running",
      startedAt: Date.now(),
      attempts: run.attempts + 1,
    })

    return true
  },
})

export const completeRun = internalMutation({
  args: {
    runId: v.id("triggerRuns"),
    result: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run) return

    await ctx.db.patch(args.runId, {
      status: "completed",
      result: args.result,
      completedAt: Date.now(),
    })
  },
})

export const failRun = internalMutation({
  args: {
    runId: v.id("triggerRuns"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run) return

    const shouldRetry = run.attempts < run.maxAttempts

    if (shouldRetry) {
      const backoffMs = Math.min(run.backoffMs * Math.pow(2, run.attempts - 1), 3600000)

      await ctx.db.patch(args.runId, {
        status: "pending",
        errorMessage: args.errorMessage,
      })

      await ctx.scheduler.runAfter(backoffMs, executeScheduledRef, {
        runId: args.runId,
      } as any)
    } else {
      await ctx.db.patch(args.runId, {
        status: "dead",
        errorMessage: args.errorMessage,
        completedAt: Date.now(),
      })

      await ctx.db.insert("events", {
        organizationId: run.organizationId,
        environment: run.environment,
        entityId: run.entityId,
        eventType: "trigger.scheduled.dead",
        schemaVersion: 1,
        actorId: "system",
        actorType: "system",
        payload: {
          triggerSlug: run.triggerSlug,
          runId: args.runId,
          attempts: run.attempts,
          errorMessage: args.errorMessage,
        },
        timestamp: Date.now(),
      })
    }
  },
})

export const getRun = internalQuery({
  args: { runId: v.id("triggerRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId)
  },
})

export const cancelRun = mutation({
  args: { runId: v.id("triggerRuns") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const run = await ctx.db.get(args.runId)

    if (!run || run.organizationId !== auth.organizationId) {
      throw new Error("Run not found")
    }

    if (run.status !== "pending") {
      throw new Error("Can only cancel pending runs")
    }

    await ctx.db.patch(args.runId, {
      status: "dead",
      errorMessage: "Cancelled by user",
      completedAt: Date.now(),
    })

    return { success: true }
  },
})

export const retryRun = mutation({
  args: { runId: v.id("triggerRuns") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const run = await ctx.db.get(args.runId)

    if (!run || run.organizationId !== auth.organizationId) {
      throw new Error("Run not found")
    }

    if (run.status !== "failed" && run.status !== "dead") {
      throw new Error("Can only retry failed or dead runs")
    }

    await ctx.db.patch(args.runId, {
      status: "pending",
      attempts: 0,
      errorMessage: undefined,
      scheduledFor: Date.now(),
    })

    await ctx.scheduler.runAfter(0, executeScheduledRef, {
      runId: args.runId,
    } as any)

    return { success: true }
  },
})

export const listRuns = query({
  args: {
    environment: v.optional(environmentValidator),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("dead")
    )),
    triggerSlug: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"
    const limit = args.limit ?? 50

    let runs
    if (args.status) {
      runs = await ctx.db
        .query("triggerRuns")
        .withIndex("by_org_env_status", (q) =>
          q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("status", args.status!)
        )
        .order("desc")
        .take(limit)
    } else {
      runs = await ctx.db
        .query("triggerRuns")
        .withIndex("by_org_env_status", (q) =>
          q.eq("organizationId", auth.organizationId).eq("environment", environment)
        )
        .order("desc")
        .take(limit)
    }

    if (args.triggerSlug) {
      return runs.filter((r) => r.triggerSlug === args.triggerSlug)
    }

    return runs
  },
})

export const getRunStats = query({
  args: {
    environment: v.optional(environmentValidator),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    const statuses = ["pending", "running", "completed", "failed", "dead"] as const
    const stats: Record<string, number> = {}

    for (const status of statuses) {
      const count = await ctx.db
        .query("triggerRuns")
        .withIndex("by_org_env_status", (q) =>
          q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("status", status)
        )
        .collect()

      stats[status] = count.length
    }

    return stats
  },
})

async function executeToolAction(
  ctx: any,
  params: {
    organizationId: Id<"organizations">
    environment: "development" | "production" | "eval"
    tool: string
    args: Record<string, unknown>
  }
): Promise<unknown> {
  const { organizationId, environment, tool, args } = params
  const actorId = "system"
  const actorType = "system" as const

  switch (tool) {
    case "entity.create":
      return await ctx.runMutation(entityCreateRef, {
        organizationId, actorId, actorType, environment,
        type: args.type as string,
        data: args.data,
        status: args.status as string | undefined,
      })

    case "entity.get":
      return await ctx.runQuery(entityGetRef, {
        organizationId, actorId, actorType, environment,
        id: args.id as string,
      })

    case "entity.query":
      return await ctx.runQuery(entityQueryRef, {
        organizationId, actorId, actorType, environment,
        type: args.type as string,
        filters: args.filters,
        status: args.status as string | undefined,
        limit: args.limit as number | undefined,
      })

    case "entity.update":
      return await ctx.runMutation(entityUpdateRef, {
        organizationId, actorId, actorType, environment,
        id: args.id as string,
        data: args.data,
        status: args.status as string | undefined,
      })

    case "entity.delete":
      return await ctx.runMutation(entityDeleteRef, {
        organizationId, actorId, actorType, environment,
        id: args.id as string,
      })

    case "entity.link":
      return await ctx.runMutation(entityLinkRef, {
        organizationId, actorId, actorType, environment,
        fromId: args.fromId as string,
        toId: args.toId as string,
        relationType: args.relationType as string,
        metadata: args.metadata,
      })

    case "entity.unlink":
      return await ctx.runMutation(entityUnlinkRef, {
        organizationId, actorId, actorType, environment,
        fromId: args.fromId as string,
        toId: args.toId as string,
        relationType: args.relationType as string,
      })

    case "event.emit":
      return await ctx.runMutation(eventEmitRef, {
        organizationId, actorId, actorType, environment,
        entityId: args.entityId as string | undefined,
        entityTypeSlug: args.entityTypeSlug as string | undefined,
        eventType: args.eventType as string,
        payload: args.payload,
      })

    case "event.query":
      return await ctx.runQuery(eventQueryRef, {
        organizationId, environment,
        entityId: args.entityId as string | undefined,
        eventType: args.eventType as string | undefined,
        since: args.since as number | undefined,
        limit: args.limit as number | undefined,
      })

    case "calendar.list":
      return await ctx.runAction(calendarListRef, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        timeMin: args.timeMin as string,
        timeMax: args.timeMax as string,
        maxResults: args.maxResults as number | undefined,
      })

    case "calendar.create":
      return await ctx.runAction(calendarCreateRef, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        summary: args.summary as string,
        startTime: args.startTime as string,
        endTime: args.endTime as string | undefined,
        durationMinutes: args.durationMinutes != null ? Number(args.durationMinutes) : undefined,
        description: args.description as string | undefined,
        attendees: args.attendees as string[] | undefined,
        timeZone: args.timeZone as string | undefined,
      })

    case "calendar.update":
      return await ctx.runAction(calendarUpdateRef, {
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
      return await ctx.runAction(calendarDeleteRef, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        eventId: args.eventId as string,
      })

    case "calendar.freeBusy":
      return await ctx.runAction(calendarFreeBusyRef, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        timeMin: args.timeMin as string,
        timeMax: args.timeMax as string,
      })

    case "whatsapp.send":
      return await ctx.runAction(whatsappSendRef, {
        organizationId, actorId, actorType, environment,
        to: args.to as string,
        text: args.text as string,
      })

    case "whatsapp.sendTemplate":
      return await ctx.runAction(whatsappSendTemplateRef, {
        organizationId, actorId, actorType, environment,
        to: String(args.to),
        templateName: String(args.templateName),
        language: String(args.language),
        components: coerceTemplateComponents(args.components),
      })

    case "whatsapp.sendInteractive":
      return await ctx.runAction(whatsappSendInteractiveRef, {
        organizationId, actorId, actorType, environment,
        to: args.to as string,
        bodyText: args.bodyText as string,
        buttons: args.buttons as any,
        footerText: args.footerText as string | undefined,
      })

    case "whatsapp.sendMedia":
      return await ctx.runAction(whatsappSendMediaRef, {
        organizationId, actorId, actorType, environment,
        to: args.to as string,
        mediaUrl: args.mediaUrl as string,
        mediaType: args.mediaType as "image" | "audio",
        caption: args.caption as string | undefined,
      })

    case "whatsapp.listTemplates":
      return await ctx.runAction(whatsappListTemplatesRef, {
        organizationId, actorId, actorType, environment,
      })

    case "whatsapp.getConversation":
      return await ctx.runAction(whatsappGetConversationRef, {
        organizationId, actorId, actorType, environment,
        phoneNumber: args.phoneNumber as string,
        limit: args.limit as number | undefined,
      })

    case "whatsapp.getStatus":
      return await ctx.runAction(whatsappGetStatusRef, {
        organizationId, actorId, actorType, environment,
      })

    case "agent.chat":
      return await ctx.runAction(agentChatRef, {
        organizationId, actorId, actorType, environment,
        agentSlug: args.agent as string,
        message: args.message as string,
        context: args.context as Record<string, unknown> | undefined,
        conversationId: undefined,
        depth: 0,
        callerAgentSlug: undefined,
      })

    default:
      return await ctx.runAction(executeCustomToolRef, {
        toolName: tool,
        args,
        context: { organizationId, actorId: "system", actorType: "system" },
      })
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
