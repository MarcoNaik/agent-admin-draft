import { MutationCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import { ActorContext } from "../lib/permissions"

interface SessionData {
  status: string
  teacherId: string
  studentId: string
  guardianId?: string
  startTime: number
  duration: number
  subject?: string
}

interface GuardianData {
  name: string
  email?: string
  phone?: string
  whatsappNumber?: string
}

interface TeacherData {
  name: string
  email?: string
  phone?: string
}

interface StudentData {
  name: string
}

interface ReminderPayload {
  sessionId: string
  reminderType: "guardian" | "teacher"
}

export async function handleSessionReminder(
  ctx: MutationCtx,
  actor: ActorContext,
  payload: ReminderPayload
): Promise<Record<string, unknown>> {
  const sessionId = payload.sessionId as Id<"entities">
  const reminderType = payload.reminderType

  const session = await ctx.db.get(sessionId)

  if (!session) {
    return { skipped: true, reason: "Session not found" }
  }

  const sessionData = session.data as SessionData

  if (sessionData.status !== "scheduled") {
    return { skipped: true, reason: `Session status is ${sessionData.status}, not scheduled` }
  }

  const now = Date.now()
  if (sessionData.startTime < now) {
    return { skipped: true, reason: "Session has already started" }
  }

  const student = await findEntityByField(ctx, session.organizationId, "student", "_id", sessionData.studentId)
  const studentName = student ? (student.data as StudentData).name : "your student"

  if (reminderType === "guardian" && sessionData.guardianId) {
    const guardian = await findEntityByField(ctx, session.organizationId, "guardian", "_id", sessionData.guardianId)

    if (!guardian) {
      return { skipped: true, reason: "Guardian not found" }
    }

    const guardianData = guardian.data as GuardianData

    await ctx.db.insert("events", {
      organizationId: session.organizationId,
      entityId: sessionId,
      entityTypeSlug: "session",
      eventType: "session.reminder_queued",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: {
        reminderType: "guardian",
        guardianId: sessionData.guardianId,
        guardianName: guardianData.name,
        guardianPhone: guardianData.whatsappNumber || guardianData.phone,
        studentName,
        sessionStartTime: sessionData.startTime,
        subject: sessionData.subject,
      },
      timestamp: now,
    })

    return {
      sent: true,
      reminderType: "guardian",
      guardianId: sessionData.guardianId,
      guardianName: guardianData.name,
      sessionStartTime: sessionData.startTime,
    }
  }

  if (reminderType === "teacher") {
    const teacher = await findEntityByField(ctx, session.organizationId, "teacher", "_id", sessionData.teacherId)

    if (!teacher) {
      return { skipped: true, reason: "Teacher not found" }
    }

    const teacherData = teacher.data as TeacherData

    await ctx.db.insert("events", {
      organizationId: session.organizationId,
      entityId: sessionId,
      entityTypeSlug: "session",
      eventType: "session.reminder_queued",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: {
        reminderType: "teacher",
        teacherId: sessionData.teacherId,
        teacherName: teacherData.name,
        teacherEmail: teacherData.email,
        studentName,
        sessionStartTime: sessionData.startTime,
        subject: sessionData.subject,
      },
      timestamp: now,
    })

    return {
      sent: true,
      reminderType: "teacher",
      teacherId: sessionData.teacherId,
      teacherName: teacherData.name,
      sessionStartTime: sessionData.startTime,
    }
  }

  return { skipped: true, reason: "Invalid reminder type or missing guardian/teacher" }
}

async function findEntityByField(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  entityTypeSlug: string,
  _field: string,
  value: string
): Promise<{ data: unknown } | null> {
  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) {
    return null
  }

  const entity = await ctx.db.get(value as Id<"entities">)

  if (!entity || entity.organizationId !== organizationId || entity.deletedAt) {
    return null
  }

  return entity
}

export function scheduleReminderTime(sessionStartTime: number): number {
  const REMINDER_LEAD_TIME_MS = 20 * 60 * 60 * 1000
  return sessionStartTime - REMINDER_LEAD_TIME_MS
}
