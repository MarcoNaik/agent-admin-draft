import type { LoadedResources } from './loader'
import type { AgentConfig, ToolReference, TriggerConfig } from '../../types'

function inferProvider(modelName: string): 'anthropic' | 'openai' | 'google' | 'xai' {
  if (modelName.startsWith('gpt-') || modelName.startsWith('o1') || modelName.startsWith('o3') || modelName.startsWith('o4')) return 'openai'
  if (modelName.startsWith('gemini')) return 'google'
  if (modelName.startsWith('grok')) return 'xai'
  return 'anthropic'
}

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
  'calendar.list',
  'calendar.create',
  'calendar.update',
  'calendar.delete',
  'calendar.freeBusy',
  'whatsapp.send',
  'whatsapp.sendTemplate',
  'whatsapp.sendInteractive',
  'whatsapp.sendMedia',
  'whatsapp.listTemplates',
  'whatsapp.getConversation',
  'whatsapp.getStatus',
  'agent.chat',
  'airtable.listBases',
  'airtable.listTables',
  'airtable.listRecords',
  'airtable.getRecord',
  'airtable.createRecords',
  'airtable.updateRecords',
  'airtable.deleteRecords',
  'email.send',
]

export interface SyncPayload {
  agents: Array<{
    name: string
    slug: string
    version: string
    description?: string
    firstMessageSuggestions?: string[]
    threadContextParams?: Array<{
      name: string
      type: 'string' | 'number' | 'boolean'
      required?: boolean
      description?: string
    }>
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
    }>
  }>
  entityTypes: Array<{
    name: string
    slug: string
    schema: unknown
    searchFields?: string[]
    displayConfig?: unknown
    boundToRole?: string
    userIdField?: string
  }>
  roles: Array<{
    name: string
    description?: string
    policies: Array<{
      resource: string
      actions: string[]
      effect: 'allow' | 'deny'
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
  evalSuites?: Array<{
    name: string
    slug: string
    agentSlug: string
    description?: string
    tags?: string[]
    judgeModel?: {
      provider: string
      name: string
    }
    judgeContext?: string
    judgePrompt?: string
    cases: Array<{
      name: string
      description?: string
      tags?: string[]
      turns: Array<{
        userMessage: string
        assertions?: Array<{
          type: 'llm_judge' | 'contains' | 'matches' | 'tool_called' | 'tool_not_called'
          criteria?: string
          value?: string
          weight?: number
        }>
      }>
      finalAssertions?: Array<{
        type: 'llm_judge' | 'contains' | 'matches' | 'tool_called' | 'tool_not_called'
        criteria?: string
        value?: string
        weight?: number
      }>
      channel?: 'widget' | 'whatsapp' | 'api' | 'dashboard'
      contextParams?: Record<string, unknown>
    }>
  }>
  triggers?: Array<{
    name: string
    slug: string
    description?: string
    entityType: string
    action: string
    condition?: Record<string, unknown>
    actions: Array<{
      tool: string
      args: Record<string, unknown>
      as?: string
    }>
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
  }>
  fixtures?: Array<{
    name: string
    slug: string
    entities: Array<{
      ref: string
      type: string
      data: Record<string, unknown>
      status?: string
    }>
    relations?: Array<{
      from: string
      to: string
      type: string
      metadata?: Record<string, unknown>
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
    boundToRole: et.boundToRole,
    userIdField: et.userIdField,
  }))

  const roles = resources.roles.map((role) => ({
    name: role.name,
    description: role.description,
    policies: role.policies.map((p) => ({
      resource: p.resource,
      actions: p.actions,
      effect: p.effect,
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

  const evalSuites = resources.evalSuites.length > 0
    ? resources.evalSuites.map((suite) => ({
        name: suite.suite,
        slug: suite.slug,
        agentSlug: suite.agent,
        description: suite.description,
        tags: suite.tags,
        judgeModel: suite.judgeModel
          ? { provider: inferProvider(suite.judgeModel), name: suite.judgeModel }
          : undefined,
        judgeContext: suite.judgeContext,
        judgePrompt: suite.judgePrompt,
        cases: suite.cases.map((c) => ({
          name: c.name,
          description: c.description,
          tags: c.tags,
          turns: c.turns.map((t) => ({
            userMessage: t.user,
            assertions: t.assertions,
          })),
          finalAssertions: c.finalAssertions,
          channel: c.channel,
          contextParams: c.contextParams,
        })),
      }))
    : undefined

  const triggers = resources.triggers.length > 0
    ? resources.triggers.map((t) => ({
        name: t.name,
        slug: t.slug,
        description: t.description,
        entityType: t.on.entityType,
        action: t.on.action,
        condition: t.on.condition,
        actions: t.actions.map((a) => ({
          tool: a.tool,
          args: a.args,
          as: a.as,
        })),
        schedule: t.schedule,
        retry: t.retry,
      }))
    : undefined

  const fixtures = resources.fixtures.length > 0
    ? resources.fixtures.map((f) => ({
        name: f.name,
        slug: f.slug,
        entities: f.entities.map((e) => ({
          ref: e.ref,
          type: e.type,
          data: e.data,
          status: e.status,
        })),
        relations: f.relations?.map((r) => ({
          from: r.from,
          to: r.to,
          type: r.type,
          metadata: r.metadata,
        })),
      }))
    : undefined

  return { agents, entityTypes, roles, evalSuites, triggers, fixtures }
}

function extractAgentPayload(
  agent: AgentConfig,
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
      }
    }

    const customTool = customToolsMap.get(toolName)
    if (!customTool) {
      const available = customToolsMap.size > 0
        ? `Available custom tools: ${Array.from(customToolsMap.keys()).join(', ')}`
        : 'No custom tools were loaded from tools/index.ts'
      throw new Error(`Agent "${agent.name}" references tool "${toolName}" but it was not found. ${available}`)
    }

    return {
      name: customTool.name,
      description: customTool.description,
      parameters: customTool.parameters || { type: 'object', properties: {} },
      handlerCode: extractHandlerCode(customTool._originalHandler || customTool.handler),
    }
  })

  return {
    name: agent.name,
    slug: agent.slug,
    version: agent.version,
    description: agent.description,
    firstMessageSuggestions: agent.firstMessageSuggestions,
    threadContextParams: agent.threadContextParams,
    systemPrompt,
    model: {
      provider: agent.model?.provider || 'xai',
      name: agent.model?.name || 'grok-4-1-fast',
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
    'calendar.list': 'List Google Calendar events for a user within a time range',
    'calendar.create': 'Create a Google Calendar event on a user\'s calendar',
    'calendar.update': 'Update an existing Google Calendar event',
    'calendar.delete': 'Delete a Google Calendar event',
    'calendar.freeBusy': 'Check free/busy availability on a user\'s Google Calendar',
    'whatsapp.send': 'Send a text message via WhatsApp',
    'whatsapp.sendTemplate': 'Send a pre-approved template message via WhatsApp (works outside 24h window)',
    'whatsapp.sendInteractive': 'Send an interactive button message via WhatsApp (max 3 buttons)',
    'whatsapp.sendMedia': 'Send an image or audio message via WhatsApp',
    'whatsapp.listTemplates': 'List available WhatsApp message templates',
    'whatsapp.getConversation': 'Get WhatsApp conversation history with a phone number',
    'whatsapp.getStatus': 'Get WhatsApp connection status for this organization',
    'agent.chat': 'Send a message to another agent and get its response',
    'airtable.listBases': 'List all Airtable bases accessible with the configured token',
    'airtable.listTables': 'List all tables in an Airtable base',
    'airtable.listRecords': 'List records from an Airtable table with optional filtering and sorting',
    'airtable.getRecord': 'Get a single record from an Airtable table by ID',
    'airtable.createRecords': 'Create up to 10 records in an Airtable table',
    'airtable.updateRecords': 'Update up to 10 records in an Airtable table',
    'airtable.deleteRecords': 'Delete up to 10 records from an Airtable table',
    'email.send': 'Send an email via Resend',
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
        type: { type: 'string', description: 'The entity type slug (e.g., "session", "teacher"). Must match the actual type of the entity being updated.' },
        data: { type: 'object', description: 'The fields to update (merged with existing data)' },
        status: { type: 'string', description: 'Optional new status' },
      },
      required: ['id', 'type', 'data'],
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
    'calendar.list': {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID (Convex or Clerk) whose calendar to query' },
        timeMin: { type: 'string', description: 'Start of time range (ISO 8601 datetime)' },
        timeMax: { type: 'string', description: 'End of time range (ISO 8601 datetime)' },
        maxResults: { type: 'number', description: 'Maximum number of events to return' },
      },
      required: ['userId', 'timeMin', 'timeMax'],
    },
    'calendar.create': {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID (Convex or Clerk) whose calendar to create the event on' },
        summary: { type: 'string', description: 'Event title' },
        startTime: { type: 'string', description: 'Event start time (ISO 8601 datetime)' },
        endTime: { type: 'string', description: 'Event end time (ISO 8601 datetime)' },
        description: { type: 'string', description: 'Event description' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'List of attendee email addresses' },
        timeZone: { type: 'string', description: 'Time zone (e.g., "America/Santiago")' },
      },
      required: ['userId', 'summary', 'startTime', 'endTime'],
    },
    'calendar.update': {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID (Convex or Clerk) whose calendar contains the event' },
        eventId: { type: 'string', description: 'Google Calendar event ID to update' },
        summary: { type: 'string', description: 'New event title' },
        startTime: { type: 'string', description: 'New start time (ISO 8601 datetime)' },
        endTime: { type: 'string', description: 'New end time (ISO 8601 datetime)' },
        description: { type: 'string', description: 'New event description' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Updated list of attendee emails' },
        status: { type: 'string', description: 'Event status (confirmed, tentative, cancelled)' },
      },
      required: ['userId', 'eventId'],
    },
    'calendar.delete': {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID (Convex or Clerk) whose calendar contains the event' },
        eventId: { type: 'string', description: 'Google Calendar event ID to delete' },
      },
      required: ['userId', 'eventId'],
    },
    'calendar.freeBusy': {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID (Convex or Clerk) whose availability to check' },
        timeMin: { type: 'string', description: 'Start of time range (ISO 8601 datetime)' },
        timeMax: { type: 'string', description: 'End of time range (ISO 8601 datetime)' },
      },
      required: ['userId', 'timeMin', 'timeMax'],
    },
    'whatsapp.send': {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number in E.164 format (e.g., "+15551234567")' },
        text: { type: 'string', description: 'The text message to send' },
      },
      required: ['to', 'text'],
    },
    'whatsapp.sendTemplate': {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number in E.164 format (e.g., "+15551234567")' },
        templateName: { type: 'string', description: 'Name of the approved template to send' },
        language: { type: 'string', description: 'Template language code (e.g., "en_US")' },
        components: {
          type: 'array',
          description: 'Optional template components with parameter values',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Component type (e.g., "body", "header")' },
              parameters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', description: 'Parameter type (e.g., "text")' },
                    text: { type: 'string', description: 'Parameter text value' },
                    parameterName: { type: 'string', description: 'Named parameter name (for NAMED format templates)' },
                  },
                  required: ['type'],
                },
              },
            },
            required: ['type', 'parameters'],
          },
        },
      },
      required: ['to', 'templateName', 'language'],
    },
    'whatsapp.sendInteractive': {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number in E.164 format (e.g., "+15551234567")' },
        bodyText: { type: 'string', description: 'The message body text' },
        buttons: {
          type: 'array',
          description: 'Action buttons (1-3 buttons, max 20 chars per title)',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique button identifier returned on click' },
              title: { type: 'string', description: 'Button label shown to user (max 20 characters)' },
            },
            required: ['id', 'title'],
          },
        },
        footerText: { type: 'string', description: 'Optional footer text below the buttons' },
      },
      required: ['to', 'bodyText', 'buttons'],
    },
    'whatsapp.sendMedia': {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number in E.164 format (e.g., "+15551234567")' },
        mediaUrl: { type: 'string', description: 'Public URL of the media file to send' },
        mediaType: { type: 'string', enum: ['image', 'audio'], description: 'Type of media to send' },
        caption: { type: 'string', description: 'Optional caption (only supported for images)' },
      },
      required: ['to', 'mediaUrl', 'mediaType'],
    },
    'whatsapp.listTemplates': {
      type: 'object',
      properties: {},
    },
    'whatsapp.getConversation': {
      type: 'object',
      properties: {
        phoneNumber: { type: 'string', description: 'Phone number to get conversation history for' },
        limit: { type: 'number', description: 'Maximum number of messages to return' },
      },
      required: ['phoneNumber'],
    },
    'whatsapp.getStatus': {
      type: 'object',
      properties: {},
    },
    'agent.chat': {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Target agent slug to communicate with' },
        message: { type: 'string', description: 'The message to send to the agent' },
        context: { type: 'object', description: 'Optional context data to pass to the target agent' },
      },
      required: ['agent', 'message'],
    },
    'airtable.listBases': {
      type: 'object',
      properties: {},
    },
    'airtable.listTables': {
      type: 'object',
      properties: {
        baseId: { type: 'string', description: 'Airtable base ID (e.g., "appXXXXXXXXXXXXXX")' },
      },
      required: ['baseId'],
    },
    'airtable.listRecords': {
      type: 'object',
      properties: {
        baseId: { type: 'string', description: 'Airtable base ID' },
        tableIdOrName: { type: 'string', description: 'Table ID or name' },
        pageSize: { type: 'number', description: 'Number of records per page (max 100)' },
        offset: { type: 'string', description: 'Pagination offset from a previous response' },
        filterByFormula: { type: 'string', description: 'Airtable formula to filter records (e.g., "{Status} = \'Active\'")' },
        sort: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, direction: { type: 'string', enum: ['asc', 'desc'] } }, required: ['field'] }, description: 'Sort configuration' },
        fields: { type: 'array', items: { type: 'string' }, description: 'Only return specific field names' },
        view: { type: 'string', description: 'Name or ID of an Airtable view to use' },
      },
      required: ['baseId', 'tableIdOrName'],
    },
    'airtable.getRecord': {
      type: 'object',
      properties: {
        baseId: { type: 'string', description: 'Airtable base ID' },
        tableIdOrName: { type: 'string', description: 'Table ID or name' },
        recordId: { type: 'string', description: 'Record ID (e.g., "recXXXXXXXXXXXXXX")' },
      },
      required: ['baseId', 'tableIdOrName', 'recordId'],
    },
    'airtable.createRecords': {
      type: 'object',
      properties: {
        baseId: { type: 'string', description: 'Airtable base ID' },
        tableIdOrName: { type: 'string', description: 'Table ID or name' },
        records: { type: 'array', items: { type: 'object', properties: { fields: { type: 'object', description: 'Field values for the record' } }, required: ['fields'] }, description: 'Array of records to create (max 10)' },
      },
      required: ['baseId', 'tableIdOrName', 'records'],
    },
    'airtable.updateRecords': {
      type: 'object',
      properties: {
        baseId: { type: 'string', description: 'Airtable base ID' },
        tableIdOrName: { type: 'string', description: 'Table ID or name' },
        records: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', description: 'Record ID to update' }, fields: { type: 'object', description: 'Field values to update' } }, required: ['id', 'fields'] }, description: 'Array of records to update (max 10)' },
      },
      required: ['baseId', 'tableIdOrName', 'records'],
    },
    'airtable.deleteRecords': {
      type: 'object',
      properties: {
        baseId: { type: 'string', description: 'Airtable base ID' },
        tableIdOrName: { type: 'string', description: 'Table ID or name' },
        recordIds: { type: 'array', items: { type: 'string' }, description: 'Array of record IDs to delete (max 10)' },
      },
      required: ['baseId', 'tableIdOrName', 'recordIds'],
    },
    'email.send': {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        html: { type: 'string', description: 'HTML body content' },
        text: { type: 'string', description: 'Plain text body content' },
        replyTo: { type: 'string', description: 'Reply-to email address' },
      },
      required: ['to', 'subject'],
    },
  }
  return schemas[name] || { type: 'object', properties: {} }
}

function extractHandlerCode(handler: Function): string {
  const code = handler.toString()

  const arrowBlockMatch = code.match(/(?:async\s*)?\([^)]*\)\s*=>\s*\{([\s\S]*)\}\s*$/)
  if (arrowBlockMatch) {
    return arrowBlockMatch[1].trim()
  }

  const arrowExprMatch = code.match(/(?:async\s*)?\([^)]*\)\s*=>\s*(.+)$/)
  if (arrowExprMatch) {
    return `return ${arrowExprMatch[1].trim()}`
  }

  const funcMatch = code.match(/(?:async\s*)?function[^(]*\([^)]*\)\s*\{([\s\S]*)\}\s*$/)
  if (funcMatch) {
    return funcMatch[1].trim()
  }

  return code
}
