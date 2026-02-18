import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

let registered = false

const VIRTUAL_MODULE_SOURCE = `
function defineAgent(config) {
  if (!config.name) throw new Error('Agent name is required')
  if (!config.version) throw new Error('Agent version is required')
  if (!config.systemPrompt) throw new Error('System prompt is required')
  return {
    model: {
      provider: 'anthropic',
      name: 'claude-sonnet-4-20250514',
      temperature: 0.7,
      maxTokens: 4096,
    },
    ...config,
  }
}

function defineRole(config) {
  if (!config.name) throw new Error('Role name is required')
  if (!config.policies || config.policies.length === 0) throw new Error('Role must have at least one policy')
  for (const policy of config.policies) {
    if (!policy.resource) throw new Error('Policy resource is required')
    if (!policy.actions || policy.actions.length === 0) throw new Error('Policy must have at least one action')
    if (!policy.effect) throw new Error('Policy effect is required')
  }
  return {
    ...config,
    scopeRules: config.scopeRules || [],
    fieldMasks: config.fieldMasks || [],
  }
}

function validateObjectProperties(schema, path) {
  if (schema.type === 'object' && !schema.properties) {
    throw new Error('Schema field "' + path + '" has type "object" but is missing "properties". All object fields must declare their properties.')
  }
  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      validateObjectProperties(value, path ? path + '.' + key : key)
    }
  }
  if (schema.items) {
    validateObjectProperties(schema.items, path + '[]')
  }
}

function defineEntityType(config) {
  if (!config.name) throw new Error('Entity type name is required')
  if (!config.slug) throw new Error('Entity type slug is required')
  if (!config.schema) throw new Error('Entity type schema is required')
  if (config.schema.type !== 'object') throw new Error('Entity type schema must be an object type')
  if (config.schema.properties) {
    for (const [key, value] of Object.entries(config.schema.properties)) {
      validateObjectProperties(value, key)
    }
  }
  if (config.boundToRole !== undefined && config.boundToRole === '') throw new Error('boundToRole cannot be an empty string')
  if (config.userIdField !== undefined && !config.boundToRole) throw new Error('userIdField requires boundToRole to be set')
  const userIdField = config.boundToRole && !config.userIdField ? 'userId' : config.userIdField
  return {
    ...config,
    searchFields: config.searchFields || [],
    userIdField,
  }
}

function defineTrigger(config) {
  const VALID_ACTIONS = ['created', 'updated', 'deleted']
  if (!config.name) throw new Error('Trigger name is required')
  if (!config.slug) throw new Error('Trigger slug is required')
  if (!config.on) throw new Error('Trigger "on" configuration is required')
  if (!config.on.entityType) throw new Error('Trigger entityType is required')
  if (!config.on.action || !VALID_ACTIONS.includes(config.on.action)) throw new Error('Trigger action must be one of: ' + VALID_ACTIONS.join(', '))
  if (!config.actions || config.actions.length === 0) throw new Error('Trigger must have at least one action')
  for (const action of config.actions) {
    if (!action.tool) throw new Error('Trigger action tool is required')
    if (!action.args || typeof action.args !== 'object') throw new Error('Trigger action args must be an object')
  }
  return config
}

function wrapHandler(name, handler) {
  return async (params, context) => {
    try {
      return await handler(params, context)
    } catch (error) {
      console.error('Tool "' + name + '" execution error:', error)
      throw error
    }
  }
}

function defineTools(tools) {
  return tools.map((tool) => {
    if (!tool.name) throw new Error('Tool name is required')
    if (!tool.description) throw new Error('Tool "' + tool.name + '" requires a description')
    if (!tool.parameters) throw new Error('Tool "' + tool.name + '" requires parameters definition')
    if (typeof tool.handler !== 'function') throw new Error('Tool "' + tool.name + '" requires a handler function')
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      handler: wrapHandler(tool.name, tool.handler),
      _originalHandler: tool.handler,
    }
  })
}

function defineConfig(config) {
  const defaultConfig = {
    port: 3000,
    host: 'localhost',
    cors: { origins: ['http://localhost:3000'], credentials: true },
    logging: { level: 'info', format: 'pretty' },
    auth: { type: 'none' },
  }
  return {
    ...defaultConfig,
    ...config,
    cors: config.cors ? { ...defaultConfig.cors, ...config.cors } : defaultConfig.cors,
    logging: config.logging ? { ...defaultConfig.logging, ...config.logging } : defaultConfig.logging,
    auth: config.auth ? { ...defaultConfig.auth, ...config.auth } : defaultConfig.auth,
  }
}

export { defineAgent, defineRole, defineEntityType, defineTrigger, defineTools, defineConfig }
`

export function registerStruerePlugin(): void {
  if (registered) return
  registered = true

  Bun.plugin({
    name: 'struere-virtual',
    setup(build) {
      build.onResolve({ filter: /^struere$/ }, () => ({
        path: 'struere',
        namespace: 'struere-virtual',
      }))

      build.onLoad({ filter: /.*/, namespace: 'struere-virtual' }, () => ({
        contents: VIRTUAL_MODULE_SOURCE,
        loader: 'js',
      }))
    },
  })
}

const TYPE_DECLARATIONS = `declare module 'struere' {
  export interface ModelConfig {
    provider: 'anthropic' | 'openai' | 'google' | 'custom'
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
    version: string
    description?: string
    model?: ModelConfig
    systemPrompt: string | (() => string | Promise<string>)
    tools?: ToolReference[]
    workflows?: { name: string; path: string }[]
    state?: {
      storage: 'memory' | 'redis' | 'postgres' | 'custom'
      ttl?: number
      prefix?: string
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
  export function defineAgent(config: AgentConfigV2): AgentConfigV2
  export function defineRole(config: RoleConfig): RoleConfig
  export function defineEntityType(config: EntityTypeConfig): EntityTypeConfig
  export function defineTrigger(config: TriggerConfig): TriggerConfig
  export function defineTools(tools: ToolDefinition[]): ToolReference[]
  export function defineConfig(config?: Partial<FrameworkConfig>): FrameworkConfig
}
`

export function generateTypeDeclarations(cwd: string): void {
  const struereDir = join(cwd, '.struere')
  if (!existsSync(struereDir)) {
    mkdirSync(struereDir, { recursive: true })
  }
  writeFileSync(join(struereDir, 'types.d.ts'), TYPE_DECLARATIONS)
}
