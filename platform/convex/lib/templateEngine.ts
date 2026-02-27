import { Id } from "../_generated/dataModel"
import { ActorContext, PermissionError } from "./permissions/types"
import { isBuiltinTool } from "../tools/helpers"

const MAX_RESULT_SIZE = 10 * 1024

export interface EntityTypeContext {
  name: string
  slug: string
  description?: string
  schema: Record<string, unknown>
  searchFields?: string[]
}

export interface TemplateContext {
  organizationId: Id<"organizations">
  organizationName: string
  userId?: Id<"users">
  threadId: Id<"threads">
  agentId: Id<"agents">
  actor: ActorContext
  agent: { name: string; slug: string }
  agentName: string
  threadContext: { channel?: string; params: Record<string, unknown> }
  message: string
  timestamp: number
  datetime: string
  currentTime: string
  entityTypes: EntityTypeContext[]
  roles: Array<{ name: string; description?: string }>
}

interface ToolConfig {
  name: string
  handlerCode?: string
}

export interface ToolExecutor {
  executeBuiltin: (name: string, args: Record<string, unknown>) => Promise<unknown>
  executeCustom: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
}

interface ParsedTemplate {
  fullMatch: string
  startIndex: number
  endIndex: number
  isFunction: boolean
  name: string
  argsRaw?: string
}

function parseTemplates(text: string): ParsedTemplate[] {
  const templates: ParsedTemplate[] = []
  let i = 0

  while (i < text.length) {
    if (text[i] === "{" && text[i + 1] === "{") {
      const startIndex = i
      i += 2

      let depth = 1
      let contentStart = i
      let contentEnd = -1

      while (i < text.length && depth > 0) {
        if (text[i] === "{" && text[i + 1] === "{") {
          depth++
          i += 2
        } else if (text[i] === "}" && text[i + 1] === "}") {
          depth--
          if (depth === 0) {
            contentEnd = i
          }
          i += 2
        } else {
          i++
        }
      }

      if (contentEnd !== -1) {
        const content = text.slice(contentStart, contentEnd).trim()
        const endIndex = i
        const fullMatch = text.slice(startIndex, endIndex)

        const funcMatch = content.match(/^([a-zA-Z_][\w.]*)\(([\s\S]*)\)$/)
        if (funcMatch) {
          templates.push({
            fullMatch,
            startIndex,
            endIndex,
            isFunction: true,
            name: funcMatch[1],
            argsRaw: funcMatch[2],
          })
        } else {
          templates.push({
            fullMatch,
            startIndex,
            endIndex,
            isFunction: false,
            name: content,
          })
        }
      }
    } else {
      i++
    }
  }

  return templates
}

function resolveVariable(name: string, context: TemplateContext): string | undefined {
  const parts = name.split(".")
  let current: unknown = context

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current !== "object") {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  if (current === undefined || current === null) {
    return undefined
  }

  if (typeof current === "string") {
    return current
  }

  return JSON.stringify(current)
}

function resolveNestedTemplates(text: string, context: TemplateContext): string {
  const nested = parseTemplates(text)
  if (nested.length === 0) {
    return text
  }

  let result = text
  for (let i = nested.length - 1; i >= 0; i--) {
    const template = nested[i]
    if (!template.isFunction) {
      const value = resolveVariable(template.name, context)
      if (value !== undefined) {
        result =
          result.slice(0, template.startIndex) +
          value +
          result.slice(template.endIndex)
      }
    }
  }

  return result
}

async function executeTemplateFunction(
  name: string,
  argsRaw: string,
  context: TemplateContext,
  tools: ToolConfig[],
  executor: ToolExecutor
): Promise<string> {
  const resolvedArgsRaw = resolveNestedTemplates(argsRaw, context)

  let args: Record<string, unknown>
  try {
    args = resolvedArgsRaw.trim() ? JSON.parse(resolvedArgsRaw) : {}
  } catch {
    return `[TEMPLATE_ERROR: ${name} - invalid JSON arguments]`
  }

  const tool = tools.find((t) => t.name === name)

  if (!tool) {
    return `[TEMPLATE_ERROR: ${name} - tool not found]`
  }

  try {
    let result: unknown

    if (isBuiltinTool(name)) {
      result = await executor.executeBuiltin(name, args)
    } else if (tool.handlerCode) {
      result = await executor.executeCustom(name, args)
    } else {
      return `[TEMPLATE_ERROR: ${name} - no handler]`
    }

    const stringified = JSON.stringify(result)
    if (stringified.length > MAX_RESULT_SIZE) {
      return stringified.slice(0, MAX_RESULT_SIZE) + "...[truncated]"
    }

    return stringified
  } catch (error) {
    if (error instanceof PermissionError) {
      return "[]"
    }
    const message = error instanceof Error ? error.message : "execution failed"
    return `[TEMPLATE_ERROR: ${name} - ${message}]`
  }
}

export async function processTemplates(
  systemPrompt: string,
  context: TemplateContext,
  tools: ToolConfig[],
  executor: ToolExecutor
): Promise<string> {
  const templates = parseTemplates(systemPrompt)

  if (templates.length === 0) {
    return systemPrompt
  }

  const variables: ParsedTemplate[] = []
  const functions: ParsedTemplate[] = []

  for (const t of templates) {
    if (t.isFunction) {
      functions.push(t)
    } else {
      variables.push(t)
    }
  }

  let result = systemPrompt
  for (let i = variables.length - 1; i >= 0; i--) {
    const template = variables[i]
    const value = resolveVariable(template.name, context)
    const replacement =
      value !== undefined
        ? value
        : `[TEMPLATE_ERROR: ${template.name} not found]`
    result =
      result.slice(0, template.startIndex) +
      replacement +
      result.slice(template.endIndex)
  }

  if (functions.length === 0) {
    return result
  }

  const updatedTemplates = parseTemplates(result)
  const functionTemplates = updatedTemplates.filter((t) => t.isFunction)

  const functionResults = await Promise.all(
    functionTemplates.map((t) =>
      executeTemplateFunction(t.name, t.argsRaw ?? "", context, tools, executor)
    )
  )

  for (let i = functionTemplates.length - 1; i >= 0; i--) {
    const template = functionTemplates[i]
    const replacement = functionResults[i]
    result =
      result.slice(0, template.startIndex) +
      replacement +
      result.slice(template.endIndex)
  }

  return result
}
