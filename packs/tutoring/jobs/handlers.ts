import { eq, and, desc, gt, isNull } from 'drizzle-orm'
import { createDb, entities, entityTypes, entityRelations, events, jobs } from '@struere/platform-shared/db'
import { generateUlid, generateId } from '@struere/platform-shared'

interface Job {
  id: string
  organizationId: string
  entityId: string | null
  jobType: string
  payload: Record<string, unknown>
}

interface Env {
  DB: D1Database
  BUNDLES?: R2Bucket
  STATE?: KVNamespace
  ANTHROPIC_API_KEY?: string
}

interface JobHandler {
  handle(job: Job, env: Env): Promise<Record<string, unknown> | void>
}

const handlers: Map<string, JobHandler> = new Map()

export function registerTutoringJobHandler(jobType: string, handler: JobHandler): void {
  handlers.set(jobType, handler)
}

export function getTutoringJobHandler(jobType: string): JobHandler | undefined {
  return handlers.get(jobType)
}

async function emitEvent(
  db: ReturnType<typeof createDb>,
  organizationId: string,
  entityId: string | null,
  eventType: string,
  payload: Record<string, unknown>
) {
  const eventId = generateUlid('evt')
  await db.insert(events).values({
    id: eventId,
    organizationId,
    entityId,
    entityTypeSlug: null,
    eventType,
    schemaVersion: 1,
    actorId: 'system',
    actorType: 'system',
    payload,
    timestamp: new Date()
  })
  return eventId
}

async function getEntityWithType(
  db: ReturnType<typeof createDb>,
  organizationId: string,
  entityId: string
) {
  const [result] = await db
    .select({
      entity: entities,
      entityTypeSlug: entityTypes.slug,
      entityTypeName: entityTypes.name
    })
    .from(entities)
    .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
    .where(and(
      eq(entities.id, entityId),
      eq(entities.organizationId, organizationId),
      isNull(entities.deletedAt)
    ))
    .limit(1)

  return result
}

async function getRelatedEntities(
  db: ReturnType<typeof createDb>,
  entityId: string,
  relationType: string
) {
  const relations = await db
    .select()
    .from(entityRelations)
    .where(and(
      eq(entityRelations.fromEntityId, entityId),
      eq(entityRelations.relationType, relationType)
    ))

  const relatedEntities = []
  for (const rel of relations) {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, rel.toEntityId))
      .limit(1)
    if (entity) {
      relatedEntities.push({ relation: rel, entity })
    }
  }
  return relatedEntities
}

async function getReverseRelatedEntities(
  db: ReturnType<typeof createDb>,
  entityId: string,
  relationType: string
) {
  const relations = await db
    .select()
    .from(entityRelations)
    .where(and(
      eq(entityRelations.toEntityId, entityId),
      eq(entityRelations.relationType, relationType)
    ))

  const relatedEntities = []
  for (const rel of relations) {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, rel.fromEntityId))
      .limit(1)
    if (entity) {
      relatedEntities.push({ relation: rel, entity })
    }
  }
  return relatedEntities
}

registerTutoringJobHandler('send_session_reminder', {
  async handle(job, env) {
    const { sessionId, reminderType } = job.payload as {
      sessionId: string
      reminderType: string
    }

    const db = createDb(env.DB)

    const session = await getEntityWithType(db, job.organizationId, sessionId)
    if (!session) {
      return { error: 'Session not found', sessionId }
    }

    if (!['scheduled', 'confirmed'].includes(session.entity.status)) {
      return { skipped: true, reason: `Session status is ${session.entity.status}` }
    }

    const studentRelations = await getRelatedEntities(db, sessionId, 'scheduled_for')
    const teacherRelations = await getRelatedEntities(db, sessionId, 'taught_by')

    const student = studentRelations[0]?.entity
    const teacher = teacherRelations[0]?.entity

    if (!student || !teacher) {
      return { error: 'Missing student or teacher relation' }
    }

    const guardianRelations = await getReverseRelatedEntities(db, student.id, 'guardian_of')
    const guardians = guardianRelations.map(r => r.entity)

    const sessionData = session.entity.data as {
      subject: string
      scheduledAt: string
      location?: string
    }
    const studentData = student.data as { firstName: string; lastName: string }
    const teacherData = teacher.data as { firstName: string; lastName: string }

    const notificationData = {
      type: 'session_reminder',
      reminderType,
      sessionId,
      sessionSubject: sessionData.subject,
      scheduledAt: sessionData.scheduledAt,
      location: sessionData.location,
      studentName: `${studentData.firstName} ${studentData.lastName}`,
      teacherName: `${teacherData.firstName} ${teacherData.lastName}`,
      recipients: guardians.map(g => {
        const gData = g.data as { email?: string; phone?: string }
        return { email: gData.email, phone: gData.phone }
      })
    }

    console.log(`[NOTIFICATION] Sending ${reminderType} reminder:`, JSON.stringify(notificationData))

    await emitEvent(db, job.organizationId, sessionId, 'session.reminder_sent', {
      reminderType,
      channel: 'email',
      recipientCount: guardians.length
    })

    return {
      sent: true,
      sessionId,
      reminderType,
      recipientCount: guardians.length,
      sentAt: new Date().toISOString()
    }
  }
})

registerTutoringJobHandler('send_late_notice', {
  async handle(job, env) {
    const { sessionId } = job.payload as { sessionId: string }

    const db = createDb(env.DB)

    const session = await getEntityWithType(db, job.organizationId, sessionId)
    if (!session) {
      return { error: 'Session not found', sessionId }
    }

    if (session.entity.status !== 'confirmed') {
      return { skipped: true, reason: `Session status is ${session.entity.status}` }
    }

    const sessionData = session.entity.data as { scheduledAt: string }
    const scheduledAt = new Date(sessionData.scheduledAt)
    const now = new Date()
    const lateMinutes = Math.floor((now.getTime() - scheduledAt.getTime()) / (1000 * 60))

    if (lateMinutes < 10) {
      return { skipped: true, reason: `Session is only ${lateMinutes} minutes past scheduled time` }
    }

    const studentRelations = await getRelatedEntities(db, sessionId, 'scheduled_for')
    const teacherRelations = await getRelatedEntities(db, sessionId, 'taught_by')

    const student = studentRelations[0]?.entity
    const teacher = teacherRelations[0]?.entity

    const notificationData = {
      type: 'late_notice',
      sessionId,
      lateMinutes,
      studentName: student ? `${(student.data as { firstName: string; lastName: string }).firstName} ${(student.data as { firstName: string; lastName: string }).lastName}` : 'Unknown',
      teacherName: teacher ? `${(teacher.data as { firstName: string; lastName: string }).firstName} ${(teacher.data as { firstName: string; lastName: string }).lastName}` : 'Unknown'
    }

    console.log(`[ALERT] Session late notice:`, JSON.stringify(notificationData))

    await emitEvent(db, job.organizationId, sessionId, 'session.late_notice_sent', {
      lateMinutes
    })

    return {
      sent: true,
      sessionId,
      lateMinutes,
      sentAt: new Date().toISOString()
    }
  }
})

registerTutoringJobHandler('decrement_entitlement', {
  async handle(job, env) {
    const { sessionId, studentId } = job.payload as {
      sessionId: string
      studentId: string
    }

    const db = createDb(env.DB)

    const entitlementRelations = await getReverseRelatedEntities(db, studentId, 'entitles')

    const activeEntitlements = entitlementRelations
      .filter(r => r.entity.status === 'active')
      .sort((a, b) => {
        const aExpires = new Date((a.entity.data as { expiresAt: string }).expiresAt).getTime()
        const bExpires = new Date((b.entity.data as { expiresAt: string }).expiresAt).getTime()
        return aExpires - bExpires
      })

    if (activeEntitlements.length === 0) {
      return {
        decremented: false,
        reason: 'No active entitlements found',
        sessionId,
        studentId
      }
    }

    const entitlement = activeEntitlements[0].entity
    const entitlementData = entitlement.data as { sessionsRemaining: number; type: string }
    const newRemaining = Math.max(0, entitlementData.sessionsRemaining - 1)

    await db
      .update(entities)
      .set({
        data: { ...entitlement.data, sessionsRemaining: newRemaining },
        updatedAt: new Date()
      })
      .where(eq(entities.id, entitlement.id))

    await emitEvent(db, job.organizationId, entitlement.id, 'entitlement.decremented', {
      previousRemaining: entitlementData.sessionsRemaining,
      remaining: newRemaining,
      sessionId
    })

    if (newRemaining === 0) {
      await db
        .update(entities)
        .set({
          status: 'exhausted',
          updatedAt: new Date()
        })
        .where(eq(entities.id, entitlement.id))

      await emitEvent(db, job.organizationId, entitlement.id, 'entitlement.exhausted', {
        studentId,
        type: entitlementData.type
      })
    }

    return {
      decremented: true,
      entitlementId: entitlement.id,
      type: entitlementData.type,
      previousRemaining: entitlementData.sessionsRemaining,
      remaining: newRemaining,
      exhausted: newRemaining === 0,
      sessionId,
      processedAt: new Date().toISOString()
    }
  }
})

registerTutoringJobHandler('send_followup', {
  async handle(job, env) {
    const { sessionId, guardianId } = job.payload as {
      sessionId: string
      guardianId: string
    }

    const db = createDb(env.DB)

    const session = await getEntityWithType(db, job.organizationId, sessionId)
    if (!session) {
      return { error: 'Session not found', sessionId }
    }

    if (session.entity.status !== 'completed') {
      return { skipped: true, reason: `Session status is ${session.entity.status}` }
    }

    const [guardian] = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.id, guardianId),
        eq(entities.organizationId, job.organizationId)
      ))
      .limit(1)

    if (!guardian) {
      return { error: 'Guardian not found', guardianId }
    }

    const studentRelations = await getRelatedEntities(db, sessionId, 'scheduled_for')
    const teacherRelations = await getRelatedEntities(db, sessionId, 'taught_by')

    const student = studentRelations[0]?.entity
    const teacher = teacherRelations[0]?.entity

    const sessionData = session.entity.data as {
      subject: string
      feedback?: {
        teacherNotes?: string
        homework?: string
        topicsCovered?: string[]
        studentProgress?: string
      }
    }
    const guardianData = guardian.data as { email?: string; firstName: string; lastName: string }
    const studentData = student?.data as { firstName: string; lastName: string }
    const teacherData = teacher?.data as { firstName: string; lastName: string }

    const notificationData = {
      type: 'session_followup',
      sessionId,
      guardianEmail: guardianData.email,
      guardianName: `${guardianData.firstName} ${guardianData.lastName}`,
      studentName: studentData ? `${studentData.firstName} ${studentData.lastName}` : 'Unknown',
      teacherName: teacherData ? `${teacherData.firstName} ${teacherData.lastName}` : 'Unknown',
      subject: sessionData.subject,
      feedback: sessionData.feedback
    }

    console.log(`[NOTIFICATION] Sending followup:`, JSON.stringify(notificationData))

    await emitEvent(db, job.organizationId, sessionId, 'session.followup_sent', {
      guardianId,
      channel: 'email'
    })

    return {
      sent: true,
      sessionId,
      guardianId,
      hasFeedback: !!sessionData.feedback,
      sentAt: new Date().toISOString()
    }
  }
})

registerTutoringJobHandler('check_entitlement_expiry', {
  async handle(job, env) {
    const { entitlementId } = job.payload as { entitlementId: string }

    const db = createDb(env.DB)

    const [entitlement] = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.id, entitlementId),
        eq(entities.organizationId, job.organizationId)
      ))
      .limit(1)

    if (!entitlement) {
      return { error: 'Entitlement not found', entitlementId }
    }

    if (entitlement.status !== 'active') {
      return { skipped: true, reason: `Entitlement status is ${entitlement.status}` }
    }

    const entitlementData = entitlement.data as { expiresAt: string; sessionsRemaining: number; type: string }
    const expiresAt = new Date(entitlementData.expiresAt)
    const now = new Date()

    if (now < expiresAt) {
      return { skipped: true, reason: `Entitlement not yet expired, expires at ${expiresAt.toISOString()}` }
    }

    await db
      .update(entities)
      .set({
        status: 'expired',
        updatedAt: now
      })
      .where(eq(entities.id, entitlementId))

    const studentRelations = await getRelatedEntities(db, entitlementId, 'entitles')
    const studentId = studentRelations[0]?.entity.id

    await emitEvent(db, job.organizationId, entitlementId, 'entitlement.expired', {
      studentId,
      sessionsRemaining: entitlementData.sessionsRemaining,
      type: entitlementData.type
    })

    return {
      expired: true,
      entitlementId,
      type: entitlementData.type,
      sessionsWasted: entitlementData.sessionsRemaining,
      studentId,
      expiredAt: now.toISOString()
    }
  }
})

registerTutoringJobHandler('send_expiry_warning', {
  async handle(job, env) {
    const { entitlementId, daysUntilExpiry } = job.payload as {
      entitlementId: string
      daysUntilExpiry: number
    }

    const db = createDb(env.DB)

    const [entitlement] = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.id, entitlementId),
        eq(entities.organizationId, job.organizationId)
      ))
      .limit(1)

    if (!entitlement || entitlement.status !== 'active') {
      return { skipped: true, reason: 'Entitlement not active' }
    }

    const purchaserRelations = await getRelatedEntities(db, entitlementId, 'purchased_by')
    const studentRelations = await getRelatedEntities(db, entitlementId, 'entitles')

    const guardian = purchaserRelations[0]?.entity
    const student = studentRelations[0]?.entity

    if (!guardian) {
      return { error: 'No purchaser found for entitlement' }
    }

    const entitlementData = entitlement.data as { type: string; sessionsRemaining: number; expiresAt: string }
    const guardianData = guardian.data as { email?: string; firstName: string; lastName: string }
    const studentData = student?.data as { firstName: string; lastName: string }

    const notificationData = {
      type: 'entitlement_expiry_warning',
      entitlementId,
      daysUntilExpiry,
      guardianEmail: guardianData.email,
      guardianName: `${guardianData.firstName} ${guardianData.lastName}`,
      studentName: studentData ? `${studentData.firstName} ${studentData.lastName}` : 'Unknown',
      packageType: entitlementData.type,
      sessionsRemaining: entitlementData.sessionsRemaining,
      expiresAt: entitlementData.expiresAt
    }

    console.log(`[NOTIFICATION] Sending expiry warning:`, JSON.stringify(notificationData))

    await emitEvent(db, job.organizationId, entitlementId, 'entitlement.expiry_warning_sent', {
      daysUntilExpiry,
      guardianId: guardian.id
    })

    return {
      sent: true,
      entitlementId,
      daysUntilExpiry,
      guardianId: guardian.id,
      sentAt: new Date().toISOString()
    }
  }
})

registerTutoringJobHandler('send_low_sessions_warning', {
  async handle(job, env) {
    const { entitlementId, remaining } = job.payload as {
      entitlementId: string
      remaining: number
    }

    const db = createDb(env.DB)

    const [entitlement] = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.id, entitlementId),
        eq(entities.organizationId, job.organizationId)
      ))
      .limit(1)

    if (!entitlement || entitlement.status !== 'active') {
      return { skipped: true, reason: 'Entitlement not active' }
    }

    const purchaserRelations = await getRelatedEntities(db, entitlementId, 'purchased_by')
    const studentRelations = await getRelatedEntities(db, entitlementId, 'entitles')

    const guardian = purchaserRelations[0]?.entity
    const student = studentRelations[0]?.entity

    if (!guardian) {
      return { error: 'No purchaser found for entitlement' }
    }

    const entitlementData = entitlement.data as { type: string }
    const guardianData = guardian.data as { email?: string; firstName: string; lastName: string }
    const studentData = student?.data as { firstName: string; lastName: string }

    const notificationData = {
      type: 'low_sessions_warning',
      entitlementId,
      remaining,
      guardianEmail: guardianData.email,
      guardianName: `${guardianData.firstName} ${guardianData.lastName}`,
      studentName: studentData ? `${studentData.firstName} ${studentData.lastName}` : 'Unknown',
      packageType: entitlementData.type
    }

    console.log(`[NOTIFICATION] Sending low sessions warning:`, JSON.stringify(notificationData))

    await emitEvent(db, job.organizationId, entitlementId, 'entitlement.low_sessions_warning_sent', {
      remaining,
      guardianId: guardian.id
    })

    return {
      sent: true,
      entitlementId,
      remaining,
      guardianId: guardian.id,
      sentAt: new Date().toISOString()
    }
  }
})

export const tutoringJobHandlers = handlers

export function registerAllTutoringHandlers(): void {
}
