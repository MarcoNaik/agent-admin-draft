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
        parameters: getBuiltinToolParameters(toolName),
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
    'entity.create': 'Create a new entity of a specified type',
    'entity.get': 'Get an entity by its ID',
    'entity.query': 'Query entities by type with optional filters',
    'entity.update': 'Update an existing entity by ID',
    'entity.delete': 'Delete an entity by ID',
    'entity.link': 'Create a relation between two entities',
    'entity.unlink': 'Remove a relation between two entities',
    'event.emit': 'Emit a custom event for audit logging',
    'event.query': 'Query historical events with optional filters',
    'job.enqueue': 'Schedule a background job to run later',
    'job.status': 'Get the status of a scheduled job',
  }
  return descriptions[name] || name
}

function getBuiltinToolParameters(name: string): unknown {
  const schemas: Record<string, unknown> = {
    'entity.create': {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'The entity type slug (e.g., "customer", "order")' },
        data: { type: 'object', description: 'The entity data matching the entity type schema' },
        status: { type: 'string', description: 'Optional status (defaults to "active")' },
      },
      required: ['type', 'data'],
    },
    'entity.get': {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The entity ID to retrieve' },
      },
      required: ['id'],
    },
    'entity.query': {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'The entity type slug to query (e.g., "customer", "order")' },
        filters: { type: 'object', description: 'Optional filters to apply (e.g., {"data.status": "active"})' },
        status: { type: 'string', description: 'Filter by entity status' },
        limit: { type: 'number', description: 'Maximum number of results (default 100)' },
      },
      required: ['type'],
    },
    'entity.update': {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The entity ID to update' },
        data: { type: 'object', description: 'The fields to update (merged with existing data)' },
        status: { type: 'string', description: 'Optional new status' },
      },
      required: ['id', 'data'],
    },
    'entity.delete': {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The entity ID to delete' },
      },
      required: ['id'],
    },
    'entity.link': {
      type: 'object',
      properties: {
        fromId: { type: 'string', description: 'Source entity ID' },
        toId: { type: 'string', description: 'Target entity ID' },
        relationType: { type: 'string', description: 'Type of relation (e.g., "assigned_to", "belongs_to")' },
        metadata: { type: 'object', description: 'Optional metadata for the relation' },
      },
      required: ['fromId', 'toId', 'relationType'],
    },
    'entity.unlink': {
      type: 'object',
      properties: {
        fromId: { type: 'string', description: 'Source entity ID' },
        toId: { type: 'string', description: 'Target entity ID' },
        relationType: { type: 'string', description: 'Type of relation to remove' },
      },
      required: ['fromId', 'toId', 'relationType'],
    },
    'event.emit': {
      type: 'object',
      properties: {
        eventType: { type: 'string', description: 'Event type (e.g., "order.placed", "user.signup")' },
        entityId: { type: 'string', description: 'Optional entity ID this event relates to' },
        entityTypeSlug: { type: 'string', description: 'Optional entity type slug' },
        payload: { type: 'object', description: 'Optional event payload data' },
      },
      required: ['eventType'],
    },
    'event.query': {
      type: 'object',
      properties: {
        eventType: { type: 'string', description: 'Filter by event type' },
        entityId: { type: 'string', description: 'Filter by entity ID' },
        since: { type: 'number', description: 'Unix timestamp to filter events after' },
        limit: { type: 'number', description: 'Maximum number of results' },
      },
    },
    'job.enqueue': {
      type: 'object',
      properties: {
        jobType: { type: 'string', description: 'The type of job to schedule' },
        payload: { type: 'object', description: 'Job payload data' },
        scheduledFor: { type: 'number', description: 'Unix timestamp when job should run (optional, runs immediately if omitted)' },
        priority: { type: 'number', description: 'Job priority (higher runs first)' },
        maxAttempts: { type: 'number', description: 'Maximum retry attempts' },
        idempotencyKey: { type: 'string', description: 'Unique key to prevent duplicate jobs' },
        entityId: { type: 'string', description: 'Optional entity ID this job relates to' },
      },
      required: ['jobType'],
    },
    'job.status': {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The job ID to check' },
      },
      required: ['id'],
    },
  }
  return schemas[name] || { type: 'object', properties: {} }
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
