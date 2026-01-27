export interface Organization {
  id: string
  name: string
  slug: string
  plan: 'free' | 'pro' | 'enterprise'
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  email: string
  name: string
  organizationId: string
  role: 'owner' | 'admin' | 'member'
  createdAt: Date
  updatedAt: Date
}

export interface ApiKey {
  id: string
  organizationId: string
  name: string
  keyHash: string
  keyPrefix: string
  permissions: ApiKeyPermission[]
  lastUsedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}

export type ApiKeyPermission = 'agent:read' | 'agent:write' | 'agent:execute' | 'agent:deploy'

export interface Agent {
  id: string
  organizationId: string
  name: string
  slug: string
  description: string | null
  currentVersionId: string | null
  status: 'active' | 'paused' | 'deleted'
  createdAt: Date
  updatedAt: Date
}

export interface AgentVersion {
  id: string
  agentId: string
  version: string
  bundleKey: string
  configHash: string
  metadata: AgentVersionMetadata
  status: 'deploying' | 'active' | 'failed' | 'rolled_back'
  deployedAt: Date
  deployedBy: string
}

export interface AgentVersionMetadata {
  modelProvider: string
  modelName: string
  toolCount: number
  bundleSize: number
}

export interface Deployment {
  id: string
  agentId: string
  versionId: string
  environment: 'preview' | 'staging' | 'production'
  url: string
  status: 'pending' | 'active' | 'failed' | 'terminated'
  createdAt: Date
}

export interface Execution {
  id: string
  organizationId: string
  agentId: string
  versionId: string
  conversationId: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  status: 'success' | 'error' | 'timeout'
  errorMessage: string | null
  timestamp: Date
}

export interface DevSession {
  id: string
  organizationId: string
  agentId: string
  userId: string
  status: 'connected' | 'disconnected'
  lastSyncAt: Date
  previewUrl: string
  createdAt: Date
}

export interface UsageSummary {
  organizationId: string
  period: 'hour' | 'day' | 'month'
  periodStart: Date
  executions: number
  inputTokens: number
  outputTokens: number
  totalDurationMs: number
  errors: number
}

export interface ChatRequest {
  message: string
  conversationId?: string
  userId?: string
  stream?: boolean
  metadata?: Record<string, unknown>
}

export interface ChatResponse {
  id: string
  conversationId: string
  content: string
  toolCalls: ToolCallResult[]
  usage: TokenUsage
  finishReason: 'stop' | 'tool_calls' | 'max_tokens' | 'error'
}

export interface ToolCallResult {
  id: string
  name: string
  arguments: Record<string, unknown>
  result: unknown
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface StreamChunk {
  type: 'text-delta' | 'tool-call-start' | 'tool-call-delta' | 'tool-result' | 'finish' | 'error'
  content?: string
  toolCall?: Partial<ToolCallResult>
  usage?: TokenUsage
  error?: string
}

export interface SyncMessage {
  type: 'auth' | 'sync' | 'ping' | 'unsync'
  apiKey?: string
  agentSlug?: string
  bundle?: string
  configHash?: string
}

export interface SyncResponse {
  type: 'authenticated' | 'synced' | 'log' | 'error' | 'pong' | 'unsynced'
  organizationId?: string
  agentId?: string
  url?: string
  level?: 'debug' | 'info' | 'warn' | 'error'
  message?: string
  timestamp?: string
  code?: string
}
