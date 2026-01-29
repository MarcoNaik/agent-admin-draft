export type { Database, AuthContext } from '@struere/platform-shared'

export interface Env {
  DB: D1Database
  BUNDLES: R2Bucket
  STATE: KVNamespace
  CONVERSATIONS: KVNamespace
  SESSIONS: KVNamespace
  DEV_SESSIONS: DurableObjectNamespace
  JOB_SCHEDULER: DurableObjectNamespace
  JOBS_QUEUE?: Queue
  ENVIRONMENT: string
  JWT_SECRET: string
  CLERK_SECRET_KEY: string
  CLERK_PUBLISHABLE_KEY: string
  CLERK_WEBHOOK_SECRET: string
  ANTHROPIC_API_KEY: string
}

export interface AgentContext {
  agentId: string
  organizationId: string
  slug: string
  versionId: string
  bundleKey: string
}

export interface ApiKeyContext {
  apiKeyId: string
  organizationId: string
  permissions: string[]
}

export interface ExecutionContext {
  conversationId: string
  userId?: string
  startTime: number
}
