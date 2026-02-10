import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import { buildActorContext, assertCanPerform } from "./lib/permissions"
import {
  validateBookingTime,
  validateReschedule,
  validateTeacherAvailability,
  validateNoOverlap,
} from "./lib/scheduling"
import { scheduleReminderTime } from "./jobs/sessionReminder"

interface SessionData {
  teacherId: string
  studentId: string
  guardianId?: string
  startTime: number
  duration: number
  subject?: string
  meetingLink?: string
  status: string
  entitlementId?: string
  paymentId?: string
  teacherNotes?: string
  guardianNotes?: string
  reportSubmitted?: boolean
  reportContent?: string
  cancellationReason?: string
  cancelledBy?: string
  cancelledAt?: number
}

interface TeacherData {
  name: string
  email?: string
  availability?: Record<string, number[]>
  userId?: string
}

interface StudentData {
  name: string
  guardianId?: string
}

interface EntitlementData {
  remainingCredits: number
  usedCredits?: number
  status: string
}

export const createSession = mutation({
  args: {
    teacherId: v.string(),
    studentId: v.string(),
    startTime: v.number(),
    duration: v.number(),
    subject: v.optional(v.string()),
    meetingLink: v.optional(v.string()),
    entitlementId: v.optional(v.string()),
    guardianNotes: v.optional(v.string()),
    environment: v.union(v.literal("development"), v.literal("production")),
  },
  returns: v.object({
    sessionId: v.id("entities"),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId as unknown as string,
      environment: args.environment,
    })

    await assertCanPerform(ctx, actor, "create", "session")

    validateBookingTime(args.startTime)

    const sessionType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", "session")
      )
      .first()

    if (!sessionType) {
      throw new Error("Session entity type not found. Please install the tutoring pack first.")
    }

    const teacher = await ctx.db.get(args.teacherId as Id<"entities">)
    if (!teacher || teacher.organizationId !== auth.organizationId || teacher.deletedAt) {
      throw new Error("Teacher not found")
    }

    const teacherData = teacher.data as TeacherData
    validateTeacherAvailability({ data: teacherData }, args.startTime, args.duration)
    await validateNoOverlap(ctx, auth.organizationId, args.teacherId, args.startTime, args.duration)

    const student = await ctx.db.get(args.studentId as Id<"entities">)
    if (!student || student.organizationId !== auth.organizationId || student.deletedAt) {
      throw new Error("Student not found")
    }

    const studentData = student.data as StudentData
    const guardianId = studentData.guardianId

    let initialStatus = "pending_payment"

    if (args.entitlementId) {
      const entitlement = await ctx.db.get(args.entitlementId as Id<"entities">)
      if (!entitlement || entitlement.organizationId !== auth.organizationId || entitlement.deletedAt) {
        throw new Error("Entitlement not found")
      }

      const entitlementData = entitlement.data as EntitlementData
      if (entitlementData.remainingCredits <= 0) {
        throw new Error("No remaining credits in entitlement")
      }
      if (entitlementData.status !== "active") {
        throw new Error("Entitlement is not active")
      }

      initialStatus = "scheduled"
    }

    const now = Date.now()
    const sessionData: SessionData = {
      teacherId: args.teacherId,
      studentId: args.studentId,
      guardianId,
      startTime: args.startTime,
      duration: args.duration,
      subject: args.subject,
      meetingLink: args.meetingLink,
      status: initialStatus,
      entitlementId: args.entitlementId,
      guardianNotes: args.guardianNotes,
    }

    const sessionId = await ctx.db.insert("entities", {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityTypeId: sessionType._id,
      status: initialStatus,
      data: sessionData,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityId: sessionId,
      entityTypeSlug: "session",
      eventType: "session.created",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: sessionData,
      timestamp: now,
    })

    if (initialStatus === "scheduled") {
      const reminderTime = scheduleReminderTime(args.startTime)

      if (reminderTime > now) {
        const delay = reminderTime - now

        if (guardianId) {
          const guardianJobId = await ctx.db.insert("jobs", {
            organizationId: auth.organizationId,
            environment: args.environment,
            entityId: sessionId,
            jobType: "session.reminder",
            idempotencyKey: `reminder-guardian-${sessionId}`,
            status: "pending",
            priority: 0,
            payload: { sessionId: sessionId.toString(), reminderType: "guardian" },
            attempts: 0,
            maxAttempts: 3,
            scheduledFor: reminderTime,
            createdAt: now,
          })
          await ctx.scheduler.runAfter(delay, internal.jobs.execute, { jobId: guardianJobId })
        }

        const teacherJobId = await ctx.db.insert("jobs", {
          organizationId: auth.organizationId,
          environment: args.environment,
          entityId: sessionId,
          jobType: "session.reminder",
          idempotencyKey: `reminder-teacher-${sessionId}`,
          status: "pending",
          priority: 0,
          payload: { sessionId: sessionId.toString(), reminderType: "teacher" },
          attempts: 0,
          maxAttempts: 3,
          scheduledFor: reminderTime,
          createdAt: now,
        })
        await ctx.scheduler.runAfter(delay, internal.jobs.execute, { jobId: teacherJobId })
      }
    }

    return { sessionId, status: initialStatus }
  },
})

export const rescheduleSession = mutation({
  args: {
    sessionId: v.id("entities"),
    newStartTime: v.number(),
    newDuration: v.optional(v.number()),
    environment: v.union(v.literal("development"), v.literal("production")),
  },
  returns: v.object({
    success: v.boolean(),
    newStartTime: v.number(),
    newDuration: v.number(),
  }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId as unknown as string,
      environment: args.environment,
    })

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.organizationId !== auth.organizationId || session.deletedAt) {
      throw new Error("Session not found")
    }

    await assertCanPerform(ctx, actor, "update", "session", session as unknown as Record<string, unknown>)

    const sessionData = session.data as SessionData

    if (sessionData.status !== "scheduled") {
      throw new Error("Can only reschedule scheduled sessions")
    }

    validateReschedule({ data: sessionData })
    validateBookingTime(args.newStartTime)

    const teacher = await ctx.db.get(sessionData.teacherId as Id<"entities">)
    if (!teacher || teacher.deletedAt) {
      throw new Error("Teacher not found")
    }

    const teacherData = teacher.data as TeacherData
    const newDuration = args.newDuration ?? sessionData.duration

    validateTeacherAvailability({ data: teacherData }, args.newStartTime, newDuration)
    await validateNoOverlap(
      ctx,
      auth.organizationId,
      sessionData.teacherId,
      args.newStartTime,
      newDuration,
      args.sessionId
    )

    const now = Date.now()
    const oldStartTime = sessionData.startTime
    const updatedData: SessionData = {
      ...sessionData,
      startTime: args.newStartTime,
      duration: newDuration,
    }

    await ctx.db.patch(args.sessionId, {
      data: updatedData,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityId: args.sessionId,
      entityTypeSlug: "session",
      eventType: "session.rescheduled",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: {
        oldStartTime,
        newStartTime: args.newStartTime,
        oldDuration: sessionData.duration,
        newDuration,
      },
      timestamp: now,
    })

    const existingJobs = await ctx.db
      .query("jobs")
      .withIndex("by_entity", (q) => q.eq("entityId", args.sessionId))
      .collect()

    const pendingReminderJobs = existingJobs.filter(
      (j) => j.jobType === "session.reminder" && j.status === "pending"
    )

    for (const job of pendingReminderJobs) {
      await ctx.db.patch(job._id, {
        status: "dead",
        errorMessage: "Session rescheduled",
        completedAt: now,
      })
    }

    const reminderTime = scheduleReminderTime(args.newStartTime)

    if (reminderTime > now) {
      const delay = reminderTime - now

      if (sessionData.guardianId) {
        const guardianJobId = await ctx.db.insert("jobs", {
          organizationId: auth.organizationId,
          environment: args.environment,
          entityId: args.sessionId,
          jobType: "session.reminder",
          idempotencyKey: `reminder-guardian-${args.sessionId}-${now}`,
          status: "pending",
          priority: 0,
          payload: { sessionId: args.sessionId.toString(), reminderType: "guardian" },
          attempts: 0,
          maxAttempts: 3,
          scheduledFor: reminderTime,
          createdAt: now,
        })
        await ctx.scheduler.runAfter(delay, internal.jobs.execute, { jobId: guardianJobId })
      }

      const teacherJobId = await ctx.db.insert("jobs", {
        organizationId: auth.organizationId,
        environment: args.environment,
        entityId: args.sessionId,
        jobType: "session.reminder",
        idempotencyKey: `reminder-teacher-${args.sessionId}-${now}`,
        status: "pending",
        priority: 0,
        payload: { sessionId: args.sessionId.toString(), reminderType: "teacher" },
        attempts: 0,
        maxAttempts: 3,
        scheduledFor: reminderTime,
        createdAt: now,
      })
      await ctx.scheduler.runAfter(delay, internal.jobs.execute, { jobId: teacherJobId })
    }

    return { success: true, newStartTime: args.newStartTime, newDuration }
  },
})

export const cancelSession = mutation({
  args: {
    sessionId: v.id("entities"),
    reason: v.optional(v.string()),
    environment: v.union(v.literal("development"), v.literal("production")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId as unknown as string,
      environment: args.environment,
    })

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.organizationId !== auth.organizationId || session.deletedAt) {
      throw new Error("Session not found")
    }

    await assertCanPerform(ctx, actor, "update", "session", session as unknown as Record<string, unknown>)

    const sessionData = session.data as SessionData

    if (sessionData.status === "completed" || sessionData.status === "cancelled") {
      throw new Error("Cannot cancel a completed or already cancelled session")
    }

    if (sessionData.status === "scheduled") {
      validateReschedule({ data: sessionData })
    }

    const now = Date.now()
    const updatedData: SessionData = {
      ...sessionData,
      status: "cancelled",
      cancellationReason: args.reason,
      cancelledBy: actor.actorId,
      cancelledAt: now,
    }

    await ctx.db.patch(args.sessionId, {
      data: updatedData,
      status: "cancelled",
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityId: args.sessionId,
      entityTypeSlug: "session",
      eventType: "session.cancelled",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: {
        reason: args.reason,
        previousStatus: sessionData.status,
      },
      timestamp: now,
    })

    const existingJobs = await ctx.db
      .query("jobs")
      .withIndex("by_entity", (q) => q.eq("entityId", args.sessionId))
      .collect()

    const pendingJobs = existingJobs.filter((j) => j.status === "pending")

    for (const job of pendingJobs) {
      await ctx.db.patch(job._id, {
        status: "dead",
        errorMessage: "Session cancelled",
        completedAt: now,
      })
    }

    return { success: true }
  },
})

export const completeSession = mutation({
  args: {
    sessionId: v.id("entities"),
    reportContent: v.optional(v.string()),
    teacherNotes: v.optional(v.string()),
    environment: v.union(v.literal("development"), v.literal("production")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId as unknown as string,
      environment: args.environment,
    })

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.organizationId !== auth.organizationId || session.deletedAt) {
      throw new Error("Session not found")
    }

    await assertCanPerform(ctx, actor, "update", "session", session as unknown as Record<string, unknown>)

    const sessionData = session.data as SessionData

    if (sessionData.status !== "scheduled" && sessionData.status !== "in_progress") {
      throw new Error("Can only complete scheduled or in-progress sessions")
    }

    const now = Date.now()
    const updatedData: SessionData = {
      ...sessionData,
      status: "completed",
      reportSubmitted: !!args.reportContent,
      reportContent: args.reportContent,
      teacherNotes: args.teacherNotes || sessionData.teacherNotes,
    }

    await ctx.db.patch(args.sessionId, {
      data: updatedData,
      status: "completed",
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityId: args.sessionId,
      entityTypeSlug: "session",
      eventType: "session.completed",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: {
        reportSubmitted: !!args.reportContent,
        teacherNotes: !!args.teacherNotes,
      },
      timestamp: now,
    })

    if (sessionData.entitlementId) {
      const entitlement = await ctx.db.get(sessionData.entitlementId as Id<"entities">)
      if (entitlement && !entitlement.deletedAt) {
        const entitlementData = entitlement.data as EntitlementData
        const newRemainingCredits = Math.max(0, entitlementData.remainingCredits - 1)

        await ctx.db.patch(sessionData.entitlementId as Id<"entities">, {
          data: {
            ...entitlementData,
            remainingCredits: newRemainingCredits,
            usedCredits: (entitlementData.usedCredits ?? 0) + 1,
            status: newRemainingCredits === 0 ? "exhausted" : entitlementData.status,
          },
          status: newRemainingCredits === 0 ? "exhausted" : entitlement.status,
          updatedAt: now,
        })

        await ctx.db.insert("events", {
          organizationId: auth.organizationId,
          environment: args.environment,
          entityId: sessionData.entitlementId as Id<"entities">,
          entityTypeSlug: "entitlement",
          eventType: "entitlement.credit_consumed",
          schemaVersion: 1,
          actorId: actor.actorId,
          actorType: actor.actorType,
          payload: {
            sessionId: args.sessionId,
            remainingCredits: newRemainingCredits,
          },
          timestamp: now,
        })
      }
    }

    const sessionEndTime = sessionData.startTime + sessionData.duration * 60 * 1000
    const followupType = sessionData.entitlementId ? "pack" : "trial"
    const followupScheduledFor = sessionEndTime + 60 * 60 * 1000
    const delay = Math.max(0, followupScheduledFor - now)

    const followupJobId = await ctx.db.insert("jobs", {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityId: args.sessionId,
      jobType: "session.followup",
      idempotencyKey: `followup-${args.sessionId}`,
      status: "pending",
      priority: 0,
      payload: { sessionId: args.sessionId.toString(), followupType },
      attempts: 0,
      maxAttempts: 3,
      scheduledFor: followupScheduledFor,
      createdAt: now,
    })
    await ctx.scheduler.runAfter(delay, internal.jobs.execute, { jobId: followupJobId })

    return { success: true }
  },
})

export const startSession = mutation({
  args: {
    sessionId: v.id("entities"),
    environment: v.union(v.literal("development"), v.literal("production")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId as unknown as string,
      environment: args.environment,
    })

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.organizationId !== auth.organizationId || session.deletedAt) {
      throw new Error("Session not found")
    }

    await assertCanPerform(ctx, actor, "update", "session", session as unknown as Record<string, unknown>)

    const sessionData = session.data as SessionData

    if (sessionData.status !== "scheduled") {
      throw new Error("Can only start scheduled sessions")
    }

    const now = Date.now()
    const updatedData: SessionData = {
      ...sessionData,
      status: "in_progress",
    }

    await ctx.db.patch(args.sessionId, {
      data: updatedData,
      status: "in_progress",
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityId: args.sessionId,
      entityTypeSlug: "session",
      eventType: "session.started",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: {},
      timestamp: now,
    })

    return { success: true }
  },
})

export const markNoShow = mutation({
  args: {
    sessionId: v.id("entities"),
    environment: v.union(v.literal("development"), v.literal("production")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId as unknown as string,
      environment: args.environment,
    })

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.organizationId !== auth.organizationId || session.deletedAt) {
      throw new Error("Session not found")
    }

    await assertCanPerform(ctx, actor, "update", "session", session as unknown as Record<string, unknown>)

    const sessionData = session.data as SessionData

    if (sessionData.status !== "scheduled") {
      throw new Error("Can only mark no-show for scheduled sessions")
    }

    const now = Date.now()
    const updatedData: SessionData = {
      ...sessionData,
      status: "no_show",
    }

    await ctx.db.patch(args.sessionId, {
      data: updatedData,
      status: "no_show",
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      environment: args.environment,
      entityId: args.sessionId,
      entityTypeSlug: "session",
      eventType: "session.no_show",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: {},
      timestamp: now,
    })

    return { success: true }
  },
})

export const getUpcomingSessions = query({
  args: {
    teacherId: v.optional(v.string()),
    studentId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const sessionType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", "session")
      )
      .first()

    if (!sessionType) {
      return []
    }

    const now = Date.now()
    const allSessions = await ctx.db
      .query("entities")
      .withIndex("by_org_type", (q) =>
        q.eq("organizationId", auth.organizationId).eq("entityTypeId", sessionType._id)
      )
      .collect()

    let filtered = allSessions.filter((s) => {
      const data = s.data as SessionData
      return (
        !s.deletedAt &&
        data.startTime > now &&
        (data.status === "scheduled" || data.status === "pending_payment")
      )
    })

    if (args.teacherId) {
      filtered = filtered.filter((s) => (s.data as SessionData).teacherId === args.teacherId)
    }

    if (args.studentId) {
      filtered = filtered.filter((s) => (s.data as SessionData).studentId === args.studentId)
    }

    filtered.sort((a, b) => (a.data as SessionData).startTime - (b.data as SessionData).startTime)

    return filtered.slice(0, args.limit ?? 50)
  },
})
