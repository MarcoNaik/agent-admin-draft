import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type * as schema from './db/schema'

export interface Env {
  DB: D1Database
  BUNDLES: R2Bucket
  SESSIONS: KVNamespace
  ENVIRONMENT: string
  JWT_SECRET: string
  CLERK_SECRET_KEY: string
  CLERK_PUBLISHABLE_KEY: string
  CLERK_WEBHOOK_SECRET: string
  CLERK_AUTHORIZED_PARTY?: string
}

export type Database = DrizzleD1Database<typeof schema>

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
