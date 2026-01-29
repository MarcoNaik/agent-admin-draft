import { createDb, jobs } from '@struere/platform-shared/db'
import { eq, and } from 'drizzle-orm'

interface ScheduledJob {
  jobId: string
  scheduledFor: number
}

interface Env {
  DB: D1Database
  JOBS_QUEUE?: Queue
}

export class JobSchedulerDO implements DurableObject {
  private state: DurableObjectState
  private env: Env
  private pendingJobs: Map<string, number> = new Map()

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<string, number>>('pendingJobs')
      if (stored) {
        this.pendingJobs = new Map(stored)
      }
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'POST' && path === '/schedule') {
      return this.handleSchedule(request)
    }

    if (request.method === 'POST' && path === '/cancel') {
      return this.handleCancel(request)
    }

    if (request.method === 'GET' && path === '/status') {
      return this.handleStatus()
    }

    return new Response('Not Found', { status: 404 })
  }

  private async handleSchedule(request: Request): Promise<Response> {
    const body = await request.json() as ScheduledJob

    if (!body.jobId || !body.scheduledFor) {
      return new Response(JSON.stringify({ error: 'Missing jobId or scheduledFor' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const now = Date.now()

    if (body.scheduledFor <= now) {
      await this.executeJob(body.jobId)
      return new Response(JSON.stringify({ queued: true, immediate: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    this.pendingJobs.set(body.jobId, body.scheduledFor)
    await this.state.storage.put('pendingJobs', this.pendingJobs)

    await this.scheduleNextAlarm()

    return new Response(JSON.stringify({ scheduled: true, scheduledFor: body.scheduledFor }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  private async handleCancel(request: Request): Promise<Response> {
    const body = await request.json() as { jobId: string }

    if (!body.jobId) {
      return new Response(JSON.stringify({ error: 'Missing jobId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const existed = this.pendingJobs.delete(body.jobId)
    await this.state.storage.put('pendingJobs', this.pendingJobs)

    return new Response(JSON.stringify({ cancelled: existed }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  private async handleStatus(): Promise<Response> {
    const pendingCount = this.pendingJobs.size
    const currentAlarm = await this.state.storage.getAlarm()

    return new Response(JSON.stringify({
      pendingCount,
      nextAlarm: currentAlarm,
      jobs: Array.from(this.pendingJobs.entries()).map(([jobId, scheduledFor]) => ({
        jobId,
        scheduledFor
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  async alarm(): Promise<void> {
    const now = Date.now()
    const jobsToExecute: string[] = []

    for (const [jobId, scheduledFor] of this.pendingJobs) {
      if (scheduledFor <= now) {
        jobsToExecute.push(jobId)
      }
    }

    for (const jobId of jobsToExecute) {
      try {
        await this.executeJob(jobId)
        this.pendingJobs.delete(jobId)
      } catch (error) {
        console.error(`Failed to execute job ${jobId}:`, error)
      }
    }

    await this.state.storage.put('pendingJobs', this.pendingJobs)
    await this.scheduleNextAlarm()
  }

  private async executeJob(jobId: string): Promise<void> {
    if (this.env.JOBS_QUEUE) {
      await this.env.JOBS_QUEUE.send({ jobId })
      return
    }

    const db = createDb(this.env.DB)
    const now = new Date()

    const [job] = await db
      .update(jobs)
      .set({
        status: 'claimed',
        claimedAt: now,
        claimedBy: 'scheduler-do'
      })
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.status, 'pending')
      ))
      .returning()

    if (!job) {
      console.log(`Job ${jobId} not found or already claimed`)
      return
    }

    try {
      await db
        .update(jobs)
        .set({
          status: 'running',
          startedAt: now
        })
        .where(eq(jobs.id, jobId))

      console.log(`Executing job ${jobId} of type ${job.jobType}`)

      await db
        .update(jobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          result: JSON.stringify({ executed: true, note: 'Handler not implemented yet' })
        })
        .where(eq(jobs.id, jobId))

    } catch (error) {
      const attempts = job.attempts + 1
      const maxAttempts = job.maxAttempts

      await db
        .update(jobs)
        .set({
          status: attempts >= maxAttempts ? 'dead' : 'pending',
          attempts,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          claimedBy: null,
          claimedAt: null
        })
        .where(eq(jobs.id, jobId))
    }
  }

  private async scheduleNextAlarm(): Promise<void> {
    if (this.pendingJobs.size === 0) {
      await this.state.storage.deleteAlarm()
      return
    }

    let earliestTime = Infinity
    for (const scheduledFor of this.pendingJobs.values()) {
      if (scheduledFor < earliestTime) {
        earliestTime = scheduledFor
      }
    }

    if (earliestTime !== Infinity) {
      await this.state.storage.setAlarm(earliestTime)
    }
  }
}
