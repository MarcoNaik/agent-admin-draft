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
  developmentVersionId: string | null
  productionVersionId: string | null
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

export type Environment = 'development' | 'production'

export interface Deployment {
  id: string
  agentId: string
  versionId: string
  environment: Environment
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

export interface EntityTypeSchemaProperty {
  type: string
  format?: string
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  pattern?: string
  enum?: string[]
  items?: { type: string }
  default?: unknown
  description?: string
  properties?: Record<string, EntityTypeSchemaProperty>
}

export interface EntityTypeSchema {
  type: 'object'
  properties: Record<string, EntityTypeSchemaProperty>
  required?: string[]
}

export interface IndexMapping {
  idx_0?: string
  idx_1?: string
  idx_2?: string
  idx_3?: string
  idx_num_0?: string
  idx_num_1?: string
  idx_date_0?: string
  idx_date_1?: string
}

export interface DisplayConfigSection {
  title: string
  fields: string[]
}

export interface DisplayConfig {
  titleField: string | string[]
  subtitleField?: string
  listFields?: string[]
  detailSections?: DisplayConfigSection[]
}

export interface EntityType {
  id: string
  organizationId: string
  name: string
  slug: string
  schema: EntityTypeSchema
  indexMapping: IndexMapping | null
  searchFields: string[] | null
  displayConfig: DisplayConfig | null
  createdAt: Date
  updatedAt: Date
}

export interface Entity {
  id: string
  organizationId: string
  entityTypeId: string
  status: string
  data: Record<string, unknown>
  searchText: string | null
  idx0: string | null
  idx1: string | null
  idx2: string | null
  idx3: string | null
  idxNum0: number | null
  idxNum1: number | null
  idxDate0: Date | null
  idxDate1: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface EntityRelation {
  id: string
  organizationId: string
  fromEntityId: string
  toEntityId: string
  relationType: string
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export type ActorType = 'user' | 'agent' | 'system' | 'webhook'

export interface Event {
  id: string
  organizationId: string
  entityId: string | null
  entityTypeSlug: string | null
  eventType: string
  schemaVersion: number
  actorId: string | null
  actorType: ActorType
  payload: Record<string, unknown>
  timestamp: Date
}

export interface IndexedFields {
  idx0?: string | null
  idx1?: string | null
  idx2?: string | null
  idx3?: string | null
  idxNum0?: number | null
  idxNum1?: number | null
  idxDate0?: Date | null
  idxDate1?: Date | null
}

export interface Role {
  id: string
  organizationId: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Policy {
  id: string
  organizationId: string
  roleId: string
  resource: string
  action: string
  effect: 'allow' | 'deny'
  priority: number
  createdAt: Date
}

export interface ScopeRuleRecord {
  id: string
  policyId: string
  type: 'field' | 'relation'
  field: string | null
  operator: string | null
  value: string | null
  relationPath: string | null
  createdAt: Date
}

export interface FieldMaskRecord {
  id: string
  policyId: string
  fieldPath: string
  maskType: 'hide' | 'redact'
  maskConfig: { pattern?: string; replacement?: string } | null
  createdAt: Date
}

export interface UserRoleRecord {
  id: string
  userId: string
  roleId: string
  resourceType: string | null
  resourceId: string | null
  grantedBy: string | null
  expiresAt: Date | null
  createdAt: Date
}

export type JobStatus = 'pending' | 'claimed' | 'running' | 'completed' | 'failed' | 'dead'

export interface Job {
  id: string
  organizationId: string
  entityId: string | null
  jobType: string
  idempotencyKey: string | null
  status: JobStatus
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

export interface JobStats {
  pending: number
  claimed: number
  running: number
  completed: number
  failed: number
  dead: number
  total: number
}

export type ToolIdentityMode = 'inherit' | 'system' | 'configured'

export interface ToolPermission {
  id: string
  agentId: string
  toolName: string
  identityMode: ToolIdentityMode
  configuredRoleId: string | null
  allowedActions: string[] | null
  deniedFields: string[] | null
  createdAt: Date
}
