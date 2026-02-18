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
  _originalHandler?: ToolHandler
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
  judgeContext?: string
  judgePrompt?: string
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
  boundToRole?: string
  userIdField?: string
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

export interface StruereProject {
  version: '2.0'
  organization: {
    id: string
    slug: string
    name: string
  }
}

export interface AgentConfig {
  name: string
  slug: string
  version: string
  description?: string
  systemPrompt: string | (() => string | Promise<string>)
  model?: ModelConfig
  tools?: string[]
}

export interface TriggerAction {
  tool: string
  args: Record<string, unknown>
  as?: string
}

export interface TriggerSchedule {
  delay?: number
  at?: string
  offset?: number
  cancelPrevious?: boolean
}

export interface TriggerRetry {
  maxAttempts?: number
  backoffMs?: number
}

export interface TriggerConfig {
  name: string
  slug: string
  description?: string
  on: {
    entityType: string
    action: 'created' | 'updated' | 'deleted'
    condition?: Record<string, unknown>
  }
  schedule?: TriggerSchedule
  retry?: TriggerRetry
  actions: TriggerAction[]
}

export interface SyncPayload {
  agents: AgentConfig[]
  entityTypes: EntityTypeConfig[]
  roles: RoleConfig[]
  customTools?: ToolReference[]
  triggers?: TriggerConfig[]
}

export interface SyncState {
  agents: Array<{ slug: string; name: string; version: string; hasDevConfig: boolean; hasProdConfig: boolean }>
  entityTypes: Array<{ slug: string; name: string }>
  roles: Array<{ name: string; policyCount: number }>
  triggers?: Array<{ slug: string; name: string; entityType: string; action: string }>
}
