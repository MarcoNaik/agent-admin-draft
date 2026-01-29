export type { Database, AuthContext } from '@struere/platform-shared'

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
  NEXT_PUBLIC_APP_URL?: string
}

export interface ApiKeyContext {
  apiKeyId: string
  organizationId: string
  permissions: string[]
}
