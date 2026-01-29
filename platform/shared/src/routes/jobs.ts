import { Hono } from 'hono'
import { eq, and, desc, sql } from 'drizzle-orm'
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  generateId,
  createJobSchema,
  queryJobsSchema
} from '../index'
import { createDb, jobs } from '../db'
import type { MiddlewareHandler } from 'hono'
import type { AuthContext, RouteEnv } from './agents'

export function createJobRoutes<E extends RouteEnv>(authMiddleware: MiddlewareHandler) {
  const jobRoutes = new Hono<{
    Bindings: E
    Variables: { auth: AuthContext }
  }>()

  jobRoutes.use('*', authMiddleware)

  jobRoutes.get('/', async (c) => {
    const auth = c.get('auth')
    const db = createDb(c.env.DB)
    const query = c.req.query()
    const parsed = queryJobsSchema.safeParse(query)

    if (!parsed.success) {
      throw new ValidationError('Invalid query parameters', { errors: parsed.error.flatten() })
    }

    const { status, jobType, entityId, limit, offset } = parsed.data

    let conditions = [eq(jobs.organizationId, auth.organizationId)]

    if (status) {
      conditions.push(eq(jobs.status, status))
    }

    if (jobType) {
      conditions.push(eq(jobs.jobType, jobType))
    }

    if (entityId) {
      conditions.push(eq(jobs.entityId, entityId))
    }

    const jobList = await db
      .select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset)

    return c.json({ jobs: jobList })
  })

  jobRoutes.post('/', async (c) => {
    const auth = c.get('auth')
    const body = await c.req.json()
    const parsed = createJobSchema.safeParse(body)

    if (!parsed.success) {
      throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
    }

    const { jobType, entityId, idempotencyKey, priority, payload, maxAttempts, scheduledFor } = parsed.data
    const db = createDb(c.env.DB)

    if (idempotencyKey) {
      const existing = await db
        .select()
        .from(jobs)
        .where(and(
          eq(jobs.organizationId, auth.organizationId),
          eq(jobs.idempotencyKey, idempotencyKey)
        ))
        .limit(1)

      if (existing.length > 0) {
        return c.json({ job: existing[0], existing: true })
      }
    }

    const now = new Date()
    const jobId = generateId('job')
    const scheduledForDate = scheduledFor ? new Date(scheduledFor) : now

    await db.insert(jobs).values({
      id: jobId,
      organizationId: auth.organizationId,
      entityId: entityId || null,
      jobType,
      idempotencyKey: idempotencyKey || null,
      status: 'pending',
      priority,
      payload,
      maxAttempts,
      scheduledFor: scheduledForDate,
      createdAt: now
    })

    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))

    return c.json({ job, existing: false }, 201)
  })

  jobRoutes.get('/stats', async (c) => {
    const auth = c.get('auth')
    const db = createDb(c.env.DB)

    const stats = await db
      .select({
        status: jobs.status,
        count: sql<number>`count(*)`
      })
      .from(jobs)
      .where(eq(jobs.organizationId, auth.organizationId))
      .groupBy(jobs.status)

    const result = {
      pending: 0,
      claimed: 0,
      running: 0,
      completed: 0,
      failed: 0,
      dead: 0,
      total: 0
    }

    for (const stat of stats) {
      const count = Number(stat.count)
      result[stat.status as keyof typeof result] = count
      result.total += count
    }

    return c.json({ stats: result })
  })

  jobRoutes.get('/:id', async (c) => {
    const auth = c.get('auth')
    const jobId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [job] = await db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.organizationId, auth.organizationId)
      ))
      .limit(1)

    if (!job) {
      throw new NotFoundError('Job', jobId)
    }

    return c.json({ job })
  })

  jobRoutes.post('/:id/cancel', async (c) => {
    const auth = c.get('auth')
    const jobId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [existing] = await db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.organizationId, auth.organizationId)
      ))
      .limit(1)

    if (!existing) {
      throw new NotFoundError('Job', jobId)
    }

    if (existing.status !== 'pending') {
      throw new ConflictError(`Cannot cancel job with status '${existing.status}'`)
    }

    await db
      .update(jobs)
      .set({
        status: 'dead',
        errorMessage: 'Cancelled by user',
        completedAt: new Date()
      })
      .where(eq(jobs.id, jobId))

    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))

    return c.json({ job })
  })

  jobRoutes.post('/:id/retry', async (c) => {
    const auth = c.get('auth')
    const jobId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [existing] = await db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.organizationId, auth.organizationId)
      ))
      .limit(1)

    if (!existing) {
      throw new NotFoundError('Job', jobId)
    }

    if (existing.status !== 'failed' && existing.status !== 'dead') {
      throw new ConflictError(`Cannot retry job with status '${existing.status}'`)
    }

    await db
      .update(jobs)
      .set({
        status: 'pending',
        attempts: 0,
        errorMessage: null,
        claimedBy: null,
        claimedAt: null,
        startedAt: null,
        completedAt: null,
        scheduledFor: new Date()
      })
      .where(eq(jobs.id, jobId))

    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))

    return c.json({ job })
  })

  return jobRoutes
}
