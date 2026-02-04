import { MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"
import { validateSessionTransition } from "../scheduling"

interface EntitlementData {
  remainingCredits: number
  usedCredits?: number
  status: string
}

interface SessionData {
  status: string
  entitlementId?: string
  teacherId: string
  studentId: string
  guardianId?: string
  startTime: number
  duration: number
  subject?: string
  reportSubmitted?: boolean
  reportContent?: string
  teacherNotes?: string
  cancellationReason?: string
  cancelledBy?: string
  cancelledAt?: number
}

export async function consumeCredit(
  ctx: MutationCtx,
  sessionId: Id<"entities">,
  entitlementId: Id<"entities">
): Promise<void> {
  const entitlement = await ctx.db.get(entitlementId)

  if (!entitlement) {
    throw new Error("Entitlement not found")
  }

  const data = entitlement.data as EntitlementData

  if (data.remainingCredits <= 0) {
    throw new Error("No remaining credits")
  }

  const newRemainingCredits = data.remainingCredits - 1
  const newUsedCredits = (data.usedCredits || 0) + 1

  const updatedData: EntitlementData = {
    ...data,
    remainingCredits: newRemainingCredits,
    usedCredits: newUsedCredits,
    status: newRemainingCredits === 0 ? "exhausted" : data.status,
  }

  await ctx.db.patch(entitlementId, {
    data: updatedData,
    status: newRemainingCredits === 0 ? "exhausted" : entitlement.status,
    updatedAt: Date.now(),
  })

  await ctx.db.insert("events", {
    organizationId: entitlement.organizationId,
    environment: entitlement.environment,
    entityId: entitlementId,
    entityTypeSlug: "entitlement",
    eventType: "entitlement.credit_consumed",
    schemaVersion: 1,
    actorId: "system",
    actorType: "system",
    payload: {
      sessionId,
      remainingCredits: newRemainingCredits,
      usedCredits: newUsedCredits,
    },
    timestamp: Date.now(),
  })
}

export async function transitionSessionStatus(
  ctx: MutationCtx,
  sessionId: Id<"entities">,
  newStatus: string,
  actorId: string,
  additionalData?: Partial<SessionData>
): Promise<void> {
  const session = await ctx.db.get(sessionId)

  if (!session) {
    throw new Error("Session not found")
  }

  const data = session.data as SessionData
  validateSessionTransition(data.status, newStatus)

  const now = Date.now()
  const updatedData: SessionData = {
    ...data,
    status: newStatus,
    ...additionalData,
  }

  if (newStatus === "cancelled") {
    updatedData.cancelledAt = now
    updatedData.cancelledBy = actorId
  }

  await ctx.db.patch(sessionId, {
    data: updatedData,
    status: newStatus,
    updatedAt: now,
  })

  await ctx.db.insert("events", {
    organizationId: session.organizationId,
    environment: session.environment,
    entityId: sessionId,
    entityTypeSlug: "session",
    eventType: `session.${newStatus}`,
    schemaVersion: 1,
    actorId,
    actorType: "user",
    payload: {
      previousStatus: data.status,
      newStatus,
      additionalData,
    },
    timestamp: now,
  })

  if (newStatus === "completed" && data.entitlementId) {
    await consumeCredit(ctx, sessionId, data.entitlementId as Id<"entities">)
  }
}

export async function submitSessionReport(
  ctx: MutationCtx,
  sessionId: Id<"entities">,
  reportContent: string,
  teacherNotes?: string
): Promise<void> {
  const session = await ctx.db.get(sessionId)

  if (!session) {
    throw new Error("Session not found")
  }

  const data = session.data as SessionData

  if (data.status !== "in_progress" && data.status !== "completed") {
    throw new Error("Can only submit report for in-progress or completed sessions")
  }

  const now = Date.now()
  const updatedData: SessionData = {
    ...data,
    reportSubmitted: true,
    reportContent,
    teacherNotes: teacherNotes || data.teacherNotes,
  }

  await ctx.db.patch(sessionId, {
    data: updatedData,
    updatedAt: now,
  })

  await ctx.db.insert("events", {
    organizationId: session.organizationId,
    environment: session.environment,
    entityId: sessionId,
    entityTypeSlug: "session",
    eventType: "session.report_submitted",
    schemaVersion: 1,
    actorId: data.teacherId,
    actorType: "user",
    payload: {
      reportContent,
      teacherNotes,
    },
    timestamp: now,
  })
}

export async function cancelSession(
  ctx: MutationCtx,
  sessionId: Id<"entities">,
  actorId: string,
  reason?: string
): Promise<void> {
  await transitionSessionStatus(ctx, sessionId, "cancelled", actorId, {
    cancellationReason: reason,
  })
}

export async function completeSession(
  ctx: MutationCtx,
  sessionId: Id<"entities">,
  actorId: string
): Promise<void> {
  await transitionSessionStatus(ctx, sessionId, "completed", actorId)
}

export async function startSession(
  ctx: MutationCtx,
  sessionId: Id<"entities">,
  actorId: string
): Promise<void> {
  await transitionSessionStatus(ctx, sessionId, "in_progress", actorId)
}

export async function markNoShow(
  ctx: MutationCtx,
  sessionId: Id<"entities">,
  actorId: string
): Promise<void> {
  await transitionSessionStatus(ctx, sessionId, "no_show", actorId)
}

export async function confirmPayment(
  ctx: MutationCtx,
  sessionId: Id<"entities">,
  paymentId: string
): Promise<void> {
  const session = await ctx.db.get(sessionId)

  if (!session) {
    throw new Error("Session not found")
  }

  const data = session.data as SessionData

  if (data.status !== "pending_payment") {
    throw new Error("Session is not pending payment")
  }

  const updatedData: SessionData = {
    ...data,
    status: "scheduled",
  }

  await ctx.db.patch(sessionId, {
    data: updatedData,
    status: "scheduled",
    updatedAt: Date.now(),
  })

  await ctx.db.insert("events", {
    organizationId: session.organizationId,
    environment: session.environment,
    entityId: sessionId,
    entityTypeSlug: "session",
    eventType: "session.payment_confirmed",
    schemaVersion: 1,
    actorId: "system",
    actorType: "system",
    payload: { paymentId },
    timestamp: Date.now(),
  })
}
