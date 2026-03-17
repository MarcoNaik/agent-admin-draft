import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

let registered = false

export const VIRTUAL_MODULE_SOURCE = `
function defineAgent(config) {
  if (!config.name) throw new Error('Agent name is required')
  if (!config.version) throw new Error('Agent version is required')
  if (!config.systemPrompt) throw new Error('System prompt is required')
  return {
    model: {
      provider: 'xai',
      name: 'grok-4-1-fast',
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

function defineData(config) {
  if (!config.name) throw new Error('Data type name is required')
  if (!config.slug) throw new Error('Data type slug is required')
  if (!config.schema) throw new Error('Data type schema is required')
  if (config.schema.type !== 'object') throw new Error('Data type schema must be an object type')
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
  if (config.schedule) {
    if (config.schedule.delay !== undefined && config.schedule.at !== undefined) throw new Error('Trigger schedule cannot have both "delay" and "at"')
    if (config.schedule.delay !== undefined && typeof config.schedule.delay !== 'number') throw new Error('Trigger schedule.delay must be a number')
    if (config.schedule.at !== undefined && typeof config.schedule.at !== 'string') throw new Error('Trigger schedule.at must be a string')
  }
  if (config.retry) {
    if (config.retry.maxAttempts !== undefined && (typeof config.retry.maxAttempts !== 'number' || config.retry.maxAttempts < 1)) throw new Error('Trigger retry.maxAttempts must be a positive number')
    if (config.retry.backoffMs !== undefined && (typeof config.retry.backoffMs !== 'number' || config.retry.backoffMs < 0)) throw new Error('Trigger retry.backoffMs must be a non-negative number')
  }
  return config
}

function wrapHandler(name, handler) {
  return async (params, context, struere, fetch) => {
    try {
      return await handler(params, context, struere, fetch)
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
      templateOnly: tool.templateOnly,
    }
  })
}

function defineEntityType() {
  throw new Error('defineEntityType has been renamed to defineData. Please update your imports: import { defineData } from "struere"')
}

export { defineAgent, defineRole, defineData, defineEntityType, defineTrigger, defineTools }
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

const TYPE_DECLARATIONS = `export interface ModelConfig {
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
  description?: string
  enum?: (string | number)[]
  items?: ParameterDefinition
  properties?: Record<string, ParameterDefinition>
}

export interface ToolContext {
  organizationId?: string
  actorId?: string
  actorType?: string
  conversationId?: string
  userId?: string
}

export interface StruereSDK {
  entity: {
    create: (args: Record<string, unknown>) => Promise<any>
    get: (args: Record<string, unknown>) => Promise<any>
    query: (args: Record<string, unknown>) => Promise<any>
    update: (args: Record<string, unknown>) => Promise<any>
    delete: (args: Record<string, unknown>) => Promise<any>
    link: (args: Record<string, unknown>) => Promise<any>
    unlink: (args: Record<string, unknown>) => Promise<any>
  }
  whatsapp: {
    send: (args: Record<string, unknown>) => Promise<any>
    sendTemplate: (args: Record<string, unknown>) => Promise<any>
    sendInteractive: (args: Record<string, unknown>) => Promise<any>
    sendMedia: (args: Record<string, unknown>) => Promise<any>
    listTemplates: (args: Record<string, unknown>) => Promise<any>
    getConversation: (args: Record<string, unknown>) => Promise<any>
    getStatus: (args: Record<string, unknown>) => Promise<any>
  }
  calendar: {
    list: (args: Record<string, unknown>) => Promise<any>
    create: (args: Record<string, unknown>) => Promise<any>
    update: (args: Record<string, unknown>) => Promise<any>
    delete: (args: Record<string, unknown>) => Promise<any>
    freeBusy: (args: Record<string, unknown>) => Promise<any>
  }
  airtable: {
    listBases: (args: Record<string, unknown>) => Promise<any>
    listTables: (args: Record<string, unknown>) => Promise<any>
    listRecords: (args: Record<string, unknown>) => Promise<any>
    getRecord: (args: Record<string, unknown>) => Promise<any>
    createRecords: (args: Record<string, unknown>) => Promise<any>
    updateRecords: (args: Record<string, unknown>) => Promise<any>
    deleteRecords: (args: Record<string, unknown>) => Promise<any>
  }
  email: {
    send: (args: Record<string, unknown>) => Promise<any>
  }
  payment: {
    create: (args: Record<string, unknown>) => Promise<any>
    getStatus: (args: Record<string, unknown>) => Promise<any>
  }
  agent: {
    chat: (args: Record<string, unknown>) => Promise<any>
  }
}

export type ToolHandler = (params: Record<string, unknown>, context: ToolContext, struere: StruereSDK, fetch: typeof globalThis.fetch) => Promise<any>

export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameters
  handler: ToolHandler
  templateOnly?: boolean
}

export interface ToolReference {
  name: string
  description: string
  parameters: ToolParameters
  handler: ToolHandler
  _originalHandler?: ToolHandler
  templateOnly?: boolean
}

export interface AgentConfig {
  name: string
  slug: string
  version: string
  description?: string
  systemPrompt: string | (() => string | Promise<string>)
  model?: ModelConfig
  tools?: string[]
  firstMessageSuggestions?: string[]
  threadContextParams?: Array<{
    name: string
    type: 'string' | 'number' | 'boolean'
    required?: boolean
    description?: string
  }>
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
}

export interface ScopeRuleConfig {
  entityType: string
  field: string
  operator: 'eq' | 'neq' | 'in' | 'contains'
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
  schedule?: {
    delay?: number
    at?: string
    offset?: number
    cancelPrevious?: boolean
  }
  retry?: {
    maxAttempts?: number
    backoffMs?: number
  }
}

export function defineAgent(config: AgentConfig): AgentConfig
export function defineRole(config: RoleConfig): RoleConfig
export function defineData(config: EntityTypeConfig): EntityTypeConfig
export function defineEntityType(config: EntityTypeConfig): never
export function defineTrigger(config: TriggerConfig): TriggerConfig
export function defineTools(tools: ToolDefinition[]): ToolReference[]
`

export function generateTypeDeclarations(cwd: string): void {
  const struereDir = join(cwd, '.struere')
  if (!existsSync(struereDir)) {
    mkdirSync(struereDir, { recursive: true })
  }
  writeFileSync(join(struereDir, 'types.d.ts'), TYPE_DECLARATIONS)
  writeFileSync(join(struereDir, 'index.d.ts'), TYPE_DECLARATIONS)
  writeFileSync(join(struereDir, 'index.js'), VIRTUAL_MODULE_SOURCE)

  const shimDir = join(cwd, 'node_modules', 'struere')
  const realPkg = join(shimDir, 'package.json')
  const isRealPackage = existsSync(realPkg) && JSON.parse(readFileSync(realPkg, 'utf8')).version !== '0.0.0'
  if (!isRealPackage) {
    mkdirSync(shimDir, { recursive: true })
    writeFileSync(join(shimDir, 'index.js'), VIRTUAL_MODULE_SOURCE)
    writeFileSync(join(shimDir, 'index.d.ts'), TYPE_DECLARATIONS)
    writeFileSync(join(shimDir, 'package.json'), JSON.stringify({ name: 'struere', version: '0.0.0', type: 'module', main: 'index.js', types: 'index.d.ts' }))
  }
}
