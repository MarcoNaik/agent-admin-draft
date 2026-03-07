import type { ToolReference, ToolParameters, ToolHandler } from '../types'

interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameters
  handler: ToolHandler
}

export function defineTools(tools: ToolDefinition[]): ToolReference[] {
  return tools.map(validateTool)
}

function validateTool(tool: ToolDefinition): ToolReference {
  if (!tool.name) {
    throw new Error('Tool name is required')
  }
  if (!tool.description) {
    throw new Error(`Tool "${tool.name}" requires a description`)
  }
  if (!tool.parameters) {
    throw new Error(`Tool "${tool.name}" requires parameters definition`)
  }
  if (typeof tool.handler !== 'function') {
    throw new Error(`Tool "${tool.name}" requires a handler function`)
  }

  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    handler: wrapHandler(tool.name, tool.handler),
    _originalHandler: tool.handler,
  }
}

function wrapHandler(name: string, handler: ToolHandler): ToolHandler {
  return async (params, context, struere, fetch) => {
    try {
      return await handler(params, context, struere, fetch)
    } catch (error) {
      console.error(`Tool "${name}" execution error:`, error)
      throw error
    }
  }
}
