import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type * as schema from './db/schema'

export interface Env {
  DB: D1Database
  BUNDLES: R2Bucket
  STATE: KVNamespace
  CONVERSATIONS: KVNamespace
  SESSIONS: KVNamespace
  DEV_SESSIONS: DurableObjectNamespace
  ENVIRONMENT: string
  JWT_SECRET: string
  CLERK_SECRET_KEY: string
  CLERK_PUBLISHABLE_KEY: string
  CLERK_WEBHOOK_SECRET: string
}

export type Database = DrizzleD1Database<typeof schema>

export interface AgentContext {
  agentId: string
  organizationId: string
  slug: string
  versionId: string
  bundleKey: string
}

export interface AuthContext {
  clerkUserId?: string
  userId: string
  organizationId: string
  email: string
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
