import { createDb, jobs } from '@struere/platform-shared/db'
import { eq, and, sql } from 'drizzle-orm'
import { getJobHandler } from '../jobs/handlers'

interface JobMessage {
  jobId: string
}

interface Env {
  DB: D1Database
  BUNDLES: R2Bucket
  STATE: KVNamespace
  ANTHROPIC_API_KEY: string
}

export async function handleJobQueue(
  batch: MessageBatch<JobMessage>,
  env: Env
): Promise<void> {
  const db = createDb(env.DB)

  for (const message of batch.messages) {
    const { jobId } = message.body

    try {
      const claimResult = await db
        .update(jobs)
        .set({
          status: 'claimed',
          claimedBy: 'worker',
          claimedAt: new Date()
        })
        .where(and(
          eq(jobs.id, jobId),
          eq(jobs.status, 'pending')
        ))
        .returning()

      if (claimResult.length === 0) {
        message.ack()
        continue
      }

      const job = claimResult[0]

      await db
        .update(jobs)
        .set({
          status: 'running',
          startedAt: new Date(),
          attempts: sql`${jobs.attempts} + 1`
        })
        .where(eq(jobs.id, jobId))

      const handler = getJobHandler(job.jobType)

      if (!handler) {
        await db
          .update(jobs)
          .set({
            status: 'failed',
            errorMessage: `No handler registered for job type: ${job.jobType}`,
            completedAt: new Date()
          })
          .where(eq(jobs.id, jobId))

        message.ack()
        continue
      }

      try {
        const result = await handler.handle(job, env)

        await db
          .update(jobs)
          .set({
            status: 'completed',
            result: result || {},
            completedAt: new Date()
          })
          .where(eq(jobs.id, jobId))

        message.ack()
      } catch (handlerError) {
        const errorMessage = handlerError instanceof Error ? handlerError.message : 'Unknown error'
        const currentJob = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)

        if (currentJob.length > 0) {
          const attempts = currentJob[0].attempts
          const maxAttempts = currentJob[0].maxAttempts

          if (attempts >= maxAttempts) {
            await db
              .update(jobs)
              .set({
                status: 'dead',
                errorMessage,
                completedAt: new Date()
              })
              .where(eq(jobs.id, jobId))

            message.ack()
          } else {
            await db
              .update(jobs)
              .set({
                status: 'pending',
                errorMessage,
                claimedBy: null,
                claimedAt: null,
                startedAt: null
              })
              .where(eq(jobs.id, jobId))

            message.retry()
          }
        } else {
          message.ack()
        }
      }
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error)
      message.retry()
    }
  }
}
