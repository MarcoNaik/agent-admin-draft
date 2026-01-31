import type { LoadedResources } from './loader'
import type { AgentConfigV2, ToolReference } from '../../types'

const BUILTIN_TOOLS = [
  'entity.create',
  'entity.get',
  'entity.query',
  'entity.update',
  'entity.delete',
  'entity.link',
  'entity.unlink',
  'event.emit',
  'event.query',
  'job.enqueue',
  'job.status',
]

export interface SyncPayload {
  agents: Array<{
    name: string
    slug: string
    version: string
    description?: string
    systemPrompt: string
    model: {
      provider: string
      name: string
      temperature?: number
      maxTokens?: number
    }
    tools: Array<{
      name: string
      description: string
      parameters: unknown
      handlerCode?: string
      isBuiltin: boolean
    }>
  }>
  entityTypes: Array<{
    name: string
    slug: string
    schema: unknown
    searchFields?: string[]
    displayConfig?: unknown
  }>
  roles: Array<{
    name: string
    description?: string
    policies: Array<{
      resource: string
      actions: string[]
      effect: 'allow' | 'deny'
      priority?: number
    }>
    scopeRules?: Array<{
      entityType: string
      field: string
      operator: string
      value: string
    }>
    fieldMasks?: Array<{
      entityType: string
      fieldPath: string
      maskType: 'hide' | 'redact'
      maskConfig?: Record<string, unknown>
    }>
  }>
}

export function extractSyncPayload(resources: LoadedResources): SyncPayload {
  const customToolsMap = new Map<string, ToolReference>()
  for (const tool of resources.customTools) {
    customToolsMap.set(tool.name, tool)
  }

  const agents = resources.agents.map((agent) => extractAgentPayload(agent, customToolsMap))

  const entityTypes = resources.entityTypes.map((et) => ({
    name: et.name,
    slug: et.slug,
    schema: et.schema,
    searchFields: et.searchFields,
    displayConfig: et.displayConfig,
  }))

  const roles = resources.roles.map((role) => ({
    name: role.name,
    description: role.description,
    policies: role.policies.map((p) => ({
      resource: p.resource,
      actions: p.actions,
      effect: p.effect,
      priority: p.priority,
    })),
    scopeRules: role.scopeRules?.map((sr) => ({
      entityType: sr.entityType,
      field: sr.field,
      operator: sr.operator,
      value: sr.value,
    })),
    fieldMasks: role.fieldMasks?.map((fm) => ({
      entityType: fm.entityType,
      fieldPath: fm.fieldPath,
      maskType: fm.maskType,
      maskConfig: fm.maskConfig,
    })),
  }))

  return { agents, entityTypes, roles }
}

function extractAgentPayload(
  agent: AgentConfigV2,
  customToolsMap: Map<string, ToolReference>
): SyncPayload['agents'][0] {
  let systemPrompt: string
  if (typeof agent.systemPrompt === 'function') {
    const result = agent.systemPrompt()
    if (result instanceof Promise) {
      throw new Error('Async system prompts must be resolved before syncing')
    }
    systemPrompt = result
  } else {
    systemPrompt = agent.systemPrompt
  }

  const tools = (agent.tools || []).map((toolName) => {
    const isBuiltin = BUILTIN_TOOLS.includes(toolName)

    if (isBuiltin) {
      return {
        name: toolName,
        description: getBuiltinToolDescription(toolName),
        parameters: { type: 'object', properties: {} },
        isBuiltin: true,
      }
    }

    const customTool = customToolsMap.get(toolName)
    if (!customTool) {
      throw new Error(`Tool "${toolName}" not found in custom tools`)
    }

    return {
      name: customTool.name,
      description: customTool.description,
      parameters: customTool.parameters || { type: 'object', properties: {} },
      handlerCode: extractHandlerCode(customTool.handler),
      isBuiltin: false,
    }
  })

  return {
    name: agent.name,
    slug: agent.slug,
    version: agent.version,
    description: agent.description,
    systemPrompt,
    model: {
      provider: agent.model?.provider || 'anthropic',
      name: agent.model?.name || 'claude-sonnet-4-20250514',
      temperature: agent.model?.temperature,
      maxTokens: agent.model?.maxTokens,
    },
    tools,
  }
}

function getBuiltinToolDescription(name: string): string {
  const descriptions: Record<string, string> = {
    'entity.create': 'Create a new entity',
    'entity.get': 'Get an entity by ID',
    'entity.query': 'Query entities by type and filters',
    'entity.update': 'Update an entity',
    'entity.delete': 'Delete an entity',
    'entity.link': 'Link two entities',
    'entity.unlink': 'Unlink two entities',
    'event.emit': 'Emit an event',
    'event.query': 'Query events',
    'job.enqueue': 'Schedule a background job',
    'job.status': 'Get job status',
  }
  return descriptions[name] || name
}

function extractHandlerCode(handler: Function): string {
  const code = handler.toString()

  const arrowMatch = code.match(/(?:async\s*)?\([^)]*\)\s*=>\s*\{?([\s\S]*)\}?$/)
  if (arrowMatch) {
    let body = arrowMatch[1].trim()
    if (body.startsWith('{') && body.endsWith('}')) {
      body = body.slice(1, -1).trim()
    }
    return body
  }

  const funcMatch = code.match(/(?:async\s*)?function[^(]*\([^)]*\)\s*\{([\s\S]*)\}$/)
  if (funcMatch) {
    return funcMatch[1].trim()
  }

  return code
}
