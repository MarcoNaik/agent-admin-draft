import { createDb, jobs } from '@struere/platform-shared/db'
import { generateId } from '@struere/platform-shared'
import { eq, and } from 'drizzle-orm'

interface EnqueueJobOptions {
  organizationId: string
  jobType: string
  payload: Record<string, unknown>
  entityId?: string
  idempotencyKey?: string
  priority?: number
  maxAttempts?: number
  scheduledFor?: Date
}

interface Env {
  DB: D1Database
  JOB_SCHEDULER: DurableObjectNamespace
  JOBS_QUEUE?: Queue
}

export async function enqueueJob(
  options: EnqueueJobOptions,
  env: Env
): Promise<{ jobId: string; existing: boolean }> {
  const db = createDb(env.DB)

  const {
    organizationId,
    jobType,
    payload,
    entityId,
    idempotencyKey,
    priority = 0,
    maxAttempts = 3,
    scheduledFor = new Date()
  } = options

  if (idempotencyKey) {
    const existing = await db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.organizationId, organizationId),
        eq(jobs.idempotencyKey, idempotencyKey)
      ))
      .limit(1)

    if (existing.length > 0) {
      return { jobId: existing[0].id, existing: true }
    }
  }

  const jobId = generateId('job')
  const now = new Date()

  await db.insert(jobs).values({
    id: jobId,
    organizationId,
    entityId: entityId || null,
    jobType,
    idempotencyKey: idempotencyKey || null,
    status: 'pending',
    priority,
    payload,
    maxAttempts,
    scheduledFor,
    createdAt: now
  })

  const scheduledTime = scheduledFor.getTime()
  const nowTime = now.getTime()

  const schedulerId = env.JOB_SCHEDULER.idFromName('global')
  const scheduler = env.JOB_SCHEDULER.get(schedulerId)

  await scheduler.fetch('http://scheduler/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId,
      scheduledFor: scheduledTime
    })
  })

  return { jobId, existing: false }
}

export async function cancelScheduledJob(
  jobId: string,
  env: Env
): Promise<boolean> {
  const schedulerId = env.JOB_SCHEDULER.idFromName('global')
  const scheduler = env.JOB_SCHEDULER.get(schedulerId)

  const response = await scheduler.fetch('http://scheduler/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId })
  })

  const result = await response.json() as { cancelled: boolean }
  return result.cancelled
}
