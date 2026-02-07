export interface AgentConfig {
  name: string
  version: string
  description?: string
  model?: ModelConfig
  systemPrompt: string | (() => string | Promise<string>)
  tools?: ToolReference[]
  workflows?: WorkflowReference[]
  state?: StateConfig
}

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'custom'
  name: string
  temperature?: number
  maxTokens?: number
  apiKey?: string
}

export interface ToolReference {
  name: string
  description: string
  parameters: ToolParameters
  handler: ToolHandler
}

export interface ToolParameters {
  type: 'object'
  properties: Record<string, ParameterDefinition>
  required?: string[]
}

export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  enum?: string[]
  items?: ParameterDefinition
  properties?: Record<string, ParameterDefinition>
}

export type ToolHandler = (params: Record<string, unknown>, context: ToolContext) => Promise<unknown>

export interface ToolContext {
  conversationId: string
  userId?: string
  state: StateAccessor
}

export interface StateAccessor {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
}

export interface WorkflowReference {
  name: string
  path: string
}

export interface StateConfig {
  storage: 'memory' | 'redis' | 'postgres' | 'custom'
  ttl?: number
  prefix?: string
}

export interface FrameworkConfig {
  port?: number
  host?: string
  cors?: CorsConfig
  logging?: LoggingConfig
  auth?: AuthConfig
}

export interface CorsConfig {
  origins: string[]
  credentials?: boolean
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  format?: 'json' | 'pretty'
}

export interface AuthConfig {
  type: 'none' | 'api-key' | 'jwt' | 'custom'
  validate?: (token: string) => Promise<boolean>
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface Conversation {
  id: string
  messages: Message[]
  state: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface TestCase {
  name: string
  description?: string
  conversation: TestMessage[]
  assertions: TestAssertion[]
}

export interface TestMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: TestToolCall[]
}

export interface TestToolCall {
  name: string
  parameters?: Record<string, unknown>
}

export interface TestAssertion {
  type: 'contains' | 'matches' | 'toolCalled' | 'stateEquals'
  value: string | Record<string, unknown>
}

export interface EvalAssertion {
  type: 'llm_judge' | 'contains' | 'matches' | 'tool_called' | 'tool_not_called'
  criteria?: string
  value?: string
  weight?: number
}

export interface EvalTurn {
  user: string
  assertions?: EvalAssertion[]
}

export interface EvalCaseDefinition {
  name: string
  description?: string
  tags?: string[]
  turns: EvalTurn[]
  finalAssertions?: EvalAssertion[]
}

export interface EvalSuiteDefinition {
  suite: string
  slug: string
  agent: string
  description?: string
  tags?: string[]
  judgeModel?: string
  cases: EvalCaseDefinition[]
}

export interface EvalRunStatus {
  _id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  totalCases: number
  completedCases: number
  passedCases: number
  failedCases: number
  overallScore?: number
  totalTokens?: { agent: number; judge: number }
  totalDurationMs?: number
}

export interface EvalResultSummary {
  _id: string
  caseId: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error'
  overallPassed: boolean
  overallScore?: number
  totalDurationMs?: number
  errorMessage?: string
  turnResults?: Array<{
    turnIndex: number
    userMessage: string
    assistantResponse: string
    assertionResults?: Array<{
      type: string
      passed: boolean
      score?: number
      reason?: string
      criteria?: string
    }>
    durationMs: number
  }>
}

export interface DeployConfig {
  environment: 'staging' | 'production'
  region?: string
  scaling?: ScalingConfig
}

export interface ScalingConfig {
  minInstances: number
  maxInstances: number
  targetConcurrency?: number
}

export interface EntityTypeConfig {
  name: string
  slug: string
  schema: JSONSchema
  searchFields?: string[]
  displayConfig?: {
    titleField?: string
    subtitleField?: string
    descriptionField?: string
  }
}

export interface JSONSchema {
  type: 'object'
  properties: Record<string, JSONSchemaProperty>
  required?: string[]
}

export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  format?: string
  enum?: string[]
  items?: JSONSchemaProperty
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
}

export interface RoleConfig {
  name: string
  description?: string
  policies: PolicyConfig[]
  scopeRules?: ScopeRuleConfig[]
  fieldMasks?: FieldMaskConfig[]
}

export interface PolicyConfig {
  resource: string
  actions: string[]
  effect: 'allow' | 'deny'
  priority?: number
}

export interface ScopeRuleConfig {
  entityType: string
  field: string
  operator: 'eq' | 'ne' | 'in' | 'contains'
  value: string
}

export interface FieldMaskConfig {
  entityType: string
  fieldPath: string
  maskType: 'hide' | 'redact'
  maskConfig?: Record<string, unknown>
}

export interface StruereProjectV2 {
  version: '2.0'
  organization: {
    id: string
    slug: string
    name: string
  }
}

export interface AgentConfigV2 {
  name: string
  slug: string
  version: string
  description?: string
  systemPrompt: string | (() => string | Promise<string>)
  model?: ModelConfig
  tools?: string[]
}

export interface SyncPayload {
  agents: AgentConfigV2[]
  entityTypes: EntityTypeConfig[]
  roles: RoleConfig[]
  customTools?: ToolReference[]
}

export interface SyncState {
  agents: Array<{ slug: string; name: string; version: string; hasDevConfig: boolean; hasProdConfig: boolean }>
  entityTypes: Array<{ slug: string; name: string }>
  roles: Array<{ name: string; policyCount: number }>
}
