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
  entitlementId?: string
  reportSubmitted?: boolean
  reportContent?: string
}

interface GuardianData {
  name: string
  email?: string
  phone?: string
  whatsappNumber?: string
}

interface StudentData {
  name: string
}

interface EntitlementData {
  totalCredits: number
  remainingCredits: number
  usedCredits?: number
  status: string
  subject?: string
}

interface FollowupPayload {
  sessionId: string
  followupType: "trial" | "pack"
}

const LOW_CREDITS_THRESHOLD = 2

export async function handleSessionFollowup(
  ctx: MutationCtx,
  actor: ActorContext,
  payload: FollowupPayload
): Promise<Record<string, unknown>> {
  const sessionId = payload.sessionId as Id<"entities">
  const followupType = payload.followupType

  const session = await ctx.db.get(sessionId)

  if (!session) {
    return { skipped: true, reason: "Session not found" }
  }

  const sessionData = session.data as SessionData

  if (sessionData.status !== "completed") {
    return { skipped: true, reason: `Session status is ${sessionData.status}, not completed` }
  }

  const student = await ctx.db.get(sessionData.studentId as Id<"entities">)
  const studentName = student ? (student.data as StudentData).name : "your student"

  const guardian = sessionData.guardianId
    ? await ctx.db.get(sessionData.guardianId as Id<"entities">)
    : null

  if (!guardian) {
    return { skipped: true, reason: "Guardian not found" }
  }

  const guardianData = guardian.data as GuardianData
  const now = Date.now()

  if (followupType === "trial") {
    await ctx.db.insert("events", {
      organizationId: session.organizationId,
      environment: session.environment,
      entityId: sessionId,
      entityTypeSlug: "session",
      eventType: "session.trial_followup_queued",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: {
        guardianId: sessionData.guardianId,
        guardianName: guardianData.name,
        guardianPhone: guardianData.whatsappNumber || guardianData.phone,
        studentName,
        subject: sessionData.subject,
        message: "Thank you for trying our tutoring service! We hope the session was helpful. Would you like to purchase a pack of sessions?",
      },
      timestamp: now,
    })

    return {
      sent: true,
      followupType: "trial",
      guardianId: sessionData.guardianId,
      guardianName: guardianData.name,
      action: "prompt_purchase_pack",
    }
  }

  if (followupType === "pack" && sessionData.entitlementId) {
    const entitlement = await ctx.db.get(sessionData.entitlementId as Id<"entities">)

    if (!entitlement) {
      return { skipped: true, reason: "Entitlement not found" }
    }

    const entitlementData = entitlement.data as EntitlementData

    const eventPayload: Record<string, unknown> = {
      guardianId: sessionData.guardianId,
      guardianName: guardianData.name,
      guardianPhone: guardianData.whatsappNumber || guardianData.phone,
      studentName,
      subject: sessionData.subject,
      remainingCredits: entitlementData.remainingCredits,
      totalCredits: entitlementData.totalCredits,
    }

    if (entitlementData.remainingCredits <= LOW_CREDITS_THRESHOLD) {
      eventPayload.lowCreditsWarning = true
      eventPayload.message = `Your session pack is running low! You have ${entitlementData.remainingCredits} session${entitlementData.remainingCredits === 1 ? "" : "s"} remaining. Would you like to purchase a new pack?`

      await ctx.db.insert("events", {
        organizationId: session.organizationId,
        environment: session.environment,
        entityId: sessionId,
        entityTypeSlug: "session",
        eventType: "session.pack_followup_queued",
        schemaVersion: 1,
        actorId: actor.actorId,
        actorType: actor.actorType,
        payload: eventPayload,
        timestamp: now,
      })

      return {
        sent: true,
        followupType: "pack",
        guardianId: sessionData.guardianId,
        guardianName: guardianData.name,
        action: "low_credits_warning",
        remainingCredits: entitlementData.remainingCredits,
      }
    }

    if (entitlementData.status === "exhausted") {
      eventPayload.exhaustedWarning = true
      eventPayload.message = "Your session pack has been fully used! Would you like to purchase a new pack to continue?"

      await ctx.db.insert("events", {
        organizationId: session.organizationId,
        environment: session.environment,
        entityId: sessionId,
        entityTypeSlug: "session",
        eventType: "session.pack_followup_queued",
        schemaVersion: 1,
        actorId: actor.actorId,
        actorType: actor.actorType,
        payload: eventPayload,
        timestamp: now,
      })

      return {
        sent: true,
        followupType: "pack",
        guardianId: sessionData.guardianId,
        guardianName: guardianData.name,
        action: "pack_exhausted",
      }
    }

    eventPayload.message = `Thank you for the session! ${studentName} has ${entitlementData.remainingCredits} session${entitlementData.remainingCredits === 1 ? "" : "s"} remaining in their pack.`

    await ctx.db.insert("events", {
      organizationId: session.organizationId,
      environment: session.environment,
      entityId: sessionId,
      entityTypeSlug: "session",
      eventType: "session.pack_followup_queued",
      schemaVersion: 1,
      actorId: actor.actorId,
      actorType: actor.actorType,
      payload: eventPayload,
      timestamp: now,
    })

    return {
      sent: true,
      followupType: "pack",
      guardianId: sessionData.guardianId,
      guardianName: guardianData.name,
      action: "session_complete_notification",
      remainingCredits: entitlementData.remainingCredits,
    }
  }

  return { skipped: true, reason: "Invalid followup type or missing entitlement" }
}

export function scheduleFollowupTime(sessionEndTime: number): number {
  const FOLLOWUP_DELAY_MS = 1 * 60 * 60 * 1000
  return sessionEndTime + FOLLOWUP_DELAY_MS
}
