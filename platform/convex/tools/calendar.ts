import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { Id } from "../_generated/dataModel"
import {
  getGoogleAccessToken,
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getFreeBusy,
} from "../lib/integrations/googleCalendar"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

export const calendarList = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    userId: v.string(),
    timeMin: v.string(),
    timeMax: v.string(),
    maxResults: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const target = await ctx.runQuery(internal.calendar.resolveTargetUser, {
      userId: args.userId,
      organizationId: args.organizationId,
      environment: args.environment,
    })

    const token = await getGoogleAccessToken(target.clerkUserId)
    const result = await listCalendarEvents(
      token,
      target.calendarId,
      args.timeMin,
      args.timeMax,
      args.maxResults
    )

    await ctx.runMutation(internal.calendar.updateLastUsed, {
      connectionId: target.connectionId,
    })

    return {
      events: (result.items ?? []).map((e) => ({
        id: e.id,
        summary: e.summary,
        start: e.start,
        end: e.end,
        status: e.status,
        htmlLink: e.htmlLink,
      })),
    }
  },
})

export const calendarCreate = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    userId: v.string(),
    summary: v.string(),
    startTime: v.string(),
    endTime: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    description: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())),
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let endTime = args.endTime
    if (!endTime && args.durationMinutes) {
      const normalized = args.startTime.includes("Z") || args.startTime.includes("+") ? args.startTime : args.startTime + "Z"
      const start = new Date(normalized)
      start.setMinutes(start.getMinutes() + args.durationMinutes)
      endTime = start.toISOString().replace(/\.\d{3}Z$/, "")
    }
    if (!endTime) {
      throw new Error("Either endTime or durationMinutes is required")
    }

    const target = await ctx.runQuery(internal.calendar.resolveTargetUser, {
      userId: args.userId,
      organizationId: args.organizationId,
      environment: args.environment,
    })

    const token = await getGoogleAccessToken(target.clerkUserId)

    const event = {
      summary: args.summary,
      description: args.description,
      start: { dateTime: args.startTime, timeZone: args.timeZone },
      end: { dateTime: endTime, timeZone: args.timeZone },
      attendees: args.attendees?.filter((email) => email).map((email) => ({ email })),
    }

    const result = await createCalendarEvent(token, target.calendarId, event)

    await ctx.runMutation(internal.calendar.updateLastUsed, {
      connectionId: target.connectionId,
    })

    return {
      eventId: result.id,
      htmlLink: result.htmlLink,
      summary: result.summary,
      start: result.start,
      end: result.end,
    }
  },
})

export const calendarUpdate = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    userId: v.string(),
    eventId: v.string(),
    summary: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    description: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const target = await ctx.runQuery(internal.calendar.resolveTargetUser, {
      userId: args.userId,
      organizationId: args.organizationId,
      environment: args.environment,
    })

    const token = await getGoogleAccessToken(target.clerkUserId)

    const updates: Record<string, unknown> = {}
    if (args.summary) updates.summary = args.summary
    if (args.description !== undefined) updates.description = args.description
    if (args.startTime) updates.start = { dateTime: args.startTime }
    if (args.endTime) updates.end = { dateTime: args.endTime }
    if (args.attendees) updates.attendees = args.attendees.map((email) => ({ email }))
    if (args.status) updates.status = args.status

    const result = await updateCalendarEvent(token, target.calendarId, args.eventId, updates as any)

    await ctx.runMutation(internal.calendar.updateLastUsed, {
      connectionId: target.connectionId,
    })

    return {
      eventId: result.id,
      htmlLink: result.htmlLink,
      summary: result.summary,
      start: result.start,
      end: result.end,
      status: result.status,
    }
  },
})

export const calendarDelete = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    userId: v.string(),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const target = await ctx.runQuery(internal.calendar.resolveTargetUser, {
      userId: args.userId,
      organizationId: args.organizationId,
      environment: args.environment,
    })

    const token = await getGoogleAccessToken(target.clerkUserId)
    await deleteCalendarEvent(token, target.calendarId, args.eventId)

    await ctx.runMutation(internal.calendar.updateLastUsed, {
      connectionId: target.connectionId,
    })

    return { success: true }
  },
})

export const calendarFreeBusy = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    userId: v.string(),
    timeMin: v.string(),
    timeMax: v.string(),
  },
  handler: async (ctx, args) => {
    const target = await ctx.runQuery(internal.calendar.resolveTargetUser, {
      userId: args.userId,
      organizationId: args.organizationId,
      environment: args.environment,
    })

    const token = await getGoogleAccessToken(target.clerkUserId)
    const result = await getFreeBusy(token, target.calendarId, args.timeMin, args.timeMax)

    await ctx.runMutation(internal.calendar.updateLastUsed, {
      connectionId: target.connectionId,
    })

    return result
  },
})
