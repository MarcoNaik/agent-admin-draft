export interface Env {
  DB: D1Database
  BUNDLES: R2Bucket
  STATE: KVNamespace
  CONVERSATIONS: KVNamespace
  DEV_SESSIONS: DurableObjectNamespace
  ENVIRONMENT: string
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
