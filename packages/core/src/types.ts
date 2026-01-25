export interface AgentConfig {
  name: string
  version: string
  description?: string
  model?: ModelConfig
  systemPrompt: string | (() => string | Promise<string>)
  tools?: ToolReference[]
  workflows?: WorkflowReference[]
  state?: StateConfig
  context?: ContextFunction
}

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'custom'
  name: string
  temperature?: number
  maxTokens?: number
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

export type ContextFunction = (request: ContextRequest) => Promise<ContextResult>

export interface ContextRequest {
  conversationId: string
  userId?: string
  channel: string
  message: string
  state: StateAccessor
}

export interface ContextResult {
  additionalContext?: string
  variables?: Record<string, unknown>
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
