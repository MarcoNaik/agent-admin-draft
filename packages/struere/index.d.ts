declare module 'struere' {
  export interface ModelConfig {
    provider: 'anthropic' | 'openai' | 'google' | 'xai' | 'custom'
    name: string
    temperature?: number
    maxTokens?: number
    apiKey?: string
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

  export interface ToolContext {
    conversationId: string
    userId?: string
    state: {
      get<T>(key: string): Promise<T | undefined>
      set<T>(key: string, value: T): Promise<void>
      delete(key: string): Promise<void>
    }
  }

  export type ToolHandler = (params: Record<string, unknown>, context: ToolContext) => Promise<unknown>

  export interface ToolDefinition {
    name: string
    description: string
    parameters: ToolParameters
    handler: ToolHandler
  }

  export interface ToolReference {
    name: string
    description: string
    parameters: ToolParameters
    handler: ToolHandler
    _originalHandler?: ToolHandler
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

  export interface JSONSchemaProperty {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    description?: string
    format?: string
    enum?: string[]
    items?: JSONSchemaProperty
    properties?: Record<string, JSONSchemaProperty>
    required?: string[]
  }

  export interface JSONSchema {
    type: 'object'
    properties: Record<string, JSONSchemaProperty>
    required?: string[]
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

  export interface RoleConfig {
    name: string
    description?: string
    policies: PolicyConfig[]
    scopeRules?: ScopeRuleConfig[]
    fieldMasks?: FieldMaskConfig[]
  }

  export interface TriggerAction {
    tool: string
    args: Record<string, unknown>
    as?: string
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
    actions: TriggerAction[]
  }

  export interface FrameworkConfig {
    port?: number
    host?: string
    cors?: {
      origins: string[]
      credentials?: boolean
    }
    logging?: {
      level: 'debug' | 'info' | 'warn' | 'error'
      format?: 'json' | 'pretty'
    }
    auth?: {
      type: 'none' | 'api-key' | 'jwt' | 'custom'
      validate?: (token: string) => Promise<boolean>
    }
  }

  export function defineAgent(config: AgentConfig): AgentConfig
  export function defineRole(config: RoleConfig): RoleConfig
  export function defineEntityType(config: EntityTypeConfig): EntityTypeConfig
  export function defineTrigger(config: TriggerConfig): TriggerConfig
  export function defineTools(tools: ToolDefinition[]): ToolReference[]
  export function defineConfig(config?: Partial<FrameworkConfig>): FrameworkConfig
}
