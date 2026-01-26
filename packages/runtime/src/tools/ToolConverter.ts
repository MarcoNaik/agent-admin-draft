import { z } from 'zod'
import { tool } from 'ai'
import type { ToolReference, ToolParameters } from '@marco-kueks/agent-factory-core'
import type { ToolDefinition, ConversationMessage } from '../types.js'

type JSONSchemaProperty = {
  type: string
  description?: string
  enum?: string[]
  items?: JSONSchemaProperty
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  default?: unknown
}

type JSONSchemaParameters = {
  type: 'object'
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
}

function jsonSchemaToZod(schema: JSONSchemaProperty): z.ZodType {
  if (schema.enum) {
    return z.enum(schema.enum as [string, ...string[]])
  }

  switch (schema.type) {
    case 'string':
      return schema.description ? z.string().describe(schema.description) : z.string()
    case 'number':
    case 'integer':
      return schema.description ? z.number().describe(schema.description) : z.number()
    case 'boolean':
      return schema.description ? z.boolean().describe(schema.description) : z.boolean()
    case 'array':
      if (schema.items) {
        const itemSchema = jsonSchemaToZod(schema.items)
        return schema.description ? z.array(itemSchema).describe(schema.description) : z.array(itemSchema)
      }
      return z.array(z.unknown())
    case 'object':
      if (schema.properties) {
        const shape: Record<string, z.ZodType> = {}
        const requiredFields = new Set(schema.required || [])
        for (const [key, prop] of Object.entries(schema.properties)) {
          const zodType = jsonSchemaToZod(prop)
          shape[key] = requiredFields.has(key) ? zodType : zodType.optional()
        }
        return z.object(shape)
      }
      return z.record(z.unknown())
    default:
      return z.unknown()
  }
}

function parametersToZodSchema(params: JSONSchemaParameters): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {}
  const requiredFields = new Set(params.required || [])

  if (params.properties) {
    for (const [key, prop] of Object.entries(params.properties)) {
      const zodType = jsonSchemaToZod(prop)
      shape[key] = requiredFields.has(key) ? zodType : zodType.optional()
    }
  }

  return z.object(shape)
}

export function convertToAISDKTools(toolDefs: ToolDefinition[]): Record<string, ReturnType<typeof tool>> {
  const tools: Record<string, ReturnType<typeof tool>> = {}

  for (const toolDef of toolDefs) {
    const zodSchema = parametersToZodSchema(toolDef.parameters as JSONSchemaParameters)

    tools[toolDef.name] = tool({
      description: toolDef.description,
      parameters: zodSchema
    })
  }

  return tools
}

export function convertToolReferenceToDefinition(toolRef: ToolReference): ToolDefinition {
  const params = toolRef.parameters as ToolParameters
  return {
    name: toolRef.name,
    description: toolRef.description,
    parameters: {
      type: params.type,
      properties: params.properties,
      required: params.required
    }
  }
}

export function convertToAISDKMessages(messages: ConversationMessage[]): Array<{
  role: 'user' | 'assistant'
  content: string | Array<{ type: string; toolCallId?: string; toolName?: string; args?: unknown; result?: unknown; text?: string }>
}> {
  const result: Array<{
    role: 'user' | 'assistant'
    content: string | Array<{ type: string; toolCallId?: string; toolName?: string; args?: unknown; result?: unknown; text?: string }>
  }> = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const content: Array<{ type: string; toolCallId?: string; toolName?: string; args?: unknown; text?: string }> = []

        if (msg.content) {
          content.push({ type: 'text', text: msg.content })
        }

        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool-call',
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.arguments
          })
        }

        result.push({ role: 'assistant', content })
      } else {
        result.push({ role: 'assistant', content: msg.content })
      }
    } else if (msg.role === 'tool') {
      result.push({
        role: 'user',
        content: [{
          type: 'tool-result',
          toolCallId: msg.toolCallId,
          result: msg.content
        }]
      })
    }
  }

  return result
}
