interface Job {
  id: string
  organizationId: string
  entityId: string | null
  jobType: string
  idempotencyKey: string | null
  status: string
  priority: number
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  errorMessage: string | null
  attempts: number
  maxAttempts: number
  claimedBy: string | null
  claimedAt: Date | null
  scheduledFor: Date
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

interface Env {
  DB: D1Database
  BUNDLES: R2Bucket
  STATE: KVNamespace
  ANTHROPIC_API_KEY: string
}

export interface JobHandler {
  handle(job: Job, env: Env): Promise<Record<string, unknown> | void>
}

const handlers: Map<string, JobHandler> = new Map()

export function registerJobHandler(jobType: string, handler: JobHandler): void {
  handlers.set(jobType, handler)
}

export function getJobHandler(jobType: string): JobHandler | undefined {
  return handlers.get(jobType)
}

export function listJobHandlers(): string[] {
  return Array.from(handlers.keys())
}

registerJobHandler('send_session_reminder', {
  async handle(job, env) {
    const { sessionId, reminderType } = job.payload as {
      sessionId: string
      reminderType: string
    }

    console.log(`Sending ${reminderType} reminder for session ${sessionId}`)

    return {
      sent: true,
      sessionId,
      reminderType,
      sentAt: new Date().toISOString()
    }
  }
})

registerJobHandler('send_late_notice', {
  async handle(job, env) {
    const { sessionId } = job.payload as { sessionId: string }

    console.log(`Sending late notice for session ${sessionId}`)

    return {
      sent: true,
      sessionId,
      sentAt: new Date().toISOString()
    }
  }
})

registerJobHandler('decrement_entitlement', {
  async handle(job, env) {
    const { entitlementId, sessionId } = job.payload as {
      entitlementId: string
      sessionId: string
    }

    console.log(`Decrementing entitlement ${entitlementId} for session ${sessionId}`)

    return {
      decremented: true,
      entitlementId,
      sessionId,
      processedAt: new Date().toISOString()
    }
  }
})

registerJobHandler('send_followup', {
  async handle(job, env) {
    const { sessionId, guardianId } = job.payload as {
      sessionId: string
      guardianId: string
    }

    console.log(`Sending followup to guardian ${guardianId} for session ${sessionId}`)

    return {
      sent: true,
      sessionId,
      guardianId,
      sentAt: new Date().toISOString()
    }
  }
})

registerJobHandler('check_entitlement_expiry', {
  async handle(job, env) {
    const { entitlementId } = job.payload as { entitlementId: string }

    console.log(`Checking expiry for entitlement ${entitlementId}`)

    return {
      checked: true,
      entitlementId,
      checkedAt: new Date().toISOString()
    }
  }
})

registerJobHandler('test_job', {
  async handle(job, env) {
    const { message, delay } = job.payload as { message?: string; delay?: number }

    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    return {
      success: true,
      message: message || 'Test job completed',
      processedAt: new Date().toISOString()
    }
  }
})

registerJobHandler('fail_job', {
  async handle(job, env) {
    throw new Error('This job is designed to fail')
  }
})

registerJobHandler('send_expiry_warning', {
  async handle(job, env) {
    const { entitlementId, daysUntilExpiry } = job.payload as {
      entitlementId: string
      daysUntilExpiry: number
    }

    console.log(`Sending expiry warning for entitlement ${entitlementId}, ${daysUntilExpiry} days remaining`)

    return {
      sent: true,
      entitlementId,
      daysUntilExpiry,
      sentAt: new Date().toISOString()
    }
  }
})

registerJobHandler('send_low_sessions_warning', {
  async handle(job, env) {
    const { entitlementId, remaining } = job.payload as {
      entitlementId: string
      remaining: number
    }

    console.log(`Sending low sessions warning for entitlement ${entitlementId}, ${remaining} sessions remaining`)

    return {
      sent: true,
      entitlementId,
      remaining,
      sentAt: new Date().toISOString()
    }
  }
})
