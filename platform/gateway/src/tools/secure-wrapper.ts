import { AuthorizationError } from '@struere/platform-shared'
import type { Action } from '@struere/platform-shared/permissions'
import type { ToolContext } from './context'
import type { BuiltinTool } from './builtin'

interface WrappedTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

const TOOL_TO_RESOURCE_ACTION: Record<string, { resource: string; action: Action }> = {
  'entity.create': { resource: 'entity', action: 'create' },
  'entity.get': { resource: 'entity', action: 'read' },
  'entity.query': { resource: 'entity', action: 'list' },
  'entity.update': { resource: 'entity', action: 'update' },
  'entity.delete': { resource: 'entity', action: 'delete' },
  'entity.link': { resource: 'relation', action: 'create' },
  'entity.unlink': { resource: 'relation', action: 'delete' },
  'event.emit': { resource: 'event', action: 'create' },
  'event.query': { resource: 'event', action: 'list' },
  'job.enqueue': { resource: 'job', action: 'create' },
  'job.cancel': { resource: 'job', action: 'update' }
}

function getResourceAndAction(toolName: string): { resource: string; action: Action } {
  const mapping = TOOL_TO_RESOURCE_ACTION[toolName]
  if (mapping) {
    return mapping
  }

  const parts = toolName.split('.')
  if (parts.length >= 2) {
    const resource = parts[0]
    const actionPart = parts[1]
    const actionMap: Record<string, Action> = {
      create: 'create',
      get: 'read',
      read: 'read',
      query: 'list',
      list: 'list',
      update: 'update',
      delete: 'delete',
      link: 'create',
      unlink: 'delete',
      emit: 'create',
      enqueue: 'create',
      cancel: 'update'
    }
    return {
      resource,
      action: actionMap[actionPart] || 'read'
    }
  }

  return { resource: 'unknown', action: 'read' }
}

function extractEntityTypeFromArgs(args: Record<string, unknown>): string | undefined {
  if (typeof args.type === 'string') {
    return args.type
  }
  if (typeof args.entityType === 'string') {
    return args.entityType
  }
  return undefined
}

function applyFieldMasksToResult(
  result: unknown,
  ctx: ToolContext,
  fieldMasks: Array<{ fieldPath: string; maskType: 'hide' | 'redact' }>
): unknown {
  if (!fieldMasks || fieldMasks.length === 0) {
    return result
  }

  if (result === null || result === undefined) {
    return result
  }

  if (typeof result !== 'object') {
    return result
  }

  if (Array.isArray(result)) {
    return result.map(item => applyFieldMasksToResult(item, ctx, fieldMasks))
  }

  const masked = { ...result } as Record<string, unknown>

  for (const mask of fieldMasks) {
    applyMaskToObject(masked, mask.fieldPath, mask.maskType)
  }

  if (masked.entity && typeof masked.entity === 'object') {
    const entityMasked = { ...masked.entity } as Record<string, unknown>
    for (const mask of fieldMasks) {
      applyMaskToObject(entityMasked, mask.fieldPath, mask.maskType)
      if (entityMasked.data && typeof entityMasked.data === 'object') {
        const dataMasked = { ...entityMasked.data } as Record<string, unknown>
        applyMaskToObject(dataMasked, mask.fieldPath, mask.maskType)
        entityMasked.data = dataMasked
      }
    }
    masked.entity = entityMasked
  }

  if (masked.entities && Array.isArray(masked.entities)) {
    masked.entities = masked.entities.map(entity => {
      const entityMasked = { ...entity } as Record<string, unknown>
      for (const mask of fieldMasks) {
        applyMaskToObject(entityMasked, mask.fieldPath, mask.maskType)
        if (entityMasked.data && typeof entityMasked.data === 'object') {
          const dataMasked = { ...entityMasked.data } as Record<string, unknown>
          applyMaskToObject(dataMasked, mask.fieldPath, mask.maskType)
          entityMasked.data = dataMasked
        }
      }
      return entityMasked
    })
  }

  return masked
}

function applyMaskToObject(
  obj: Record<string, unknown>,
  fieldPath: string,
  maskType: 'hide' | 'redact'
): void {
  const parts = fieldPath.split('.')

  if (parts.length === 1) {
    const field = parts[0]
    if (field in obj) {
      if (maskType === 'hide') {
        delete obj[field]
      } else if (maskType === 'redact') {
        const value = obj[field]
        if (typeof value === 'string') {
          if (value.length <= 4) {
            obj[field] = '***'
          } else {
            obj[field] = value[0] + '*'.repeat(Math.min(value.length - 2, 8)) + value[value.length - 1]
          }
        } else {
          obj[field] = '***'
        }
      }
    }
    return
  }

  const [first, ...rest] = parts
  const child = obj[first]

  if (child === null || child === undefined) {
    return
  }

  if (Array.isArray(child)) {
    for (const item of child) {
      if (typeof item === 'object' && item !== null) {
        applyMaskToObject(item as Record<string, unknown>, rest.join('.'), maskType)
      }
    }
  } else if (typeof child === 'object') {
    const childCopy = { ...child } as Record<string, unknown>
    applyMaskToObject(childCopy, rest.join('.'), maskType)
    obj[first] = childCopy
  }
}

export function wrapToolWithPermissions(
  tool: BuiltinTool,
  ctx: ToolContext
): WrappedTool {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    handler: async (args: Record<string, unknown>) => {
      const { resource, action } = getResourceAndAction(tool.name)

      let specificResource = resource
      const entityType = extractEntityTypeFromArgs(args)
      if (entityType && resource === 'entity') {
        specificResource = entityType
      }

      const permissionResult = await ctx.permissions.evaluator.evaluate(
        ctx.effectiveActor,
        specificResource,
        action
      )

      if (!permissionResult.allowed) {
        throw new AuthorizationError(
          `Permission denied for ${tool.name}: ${permissionResult.reason}`
        )
      }

      const result = await tool.handler(args, ctx)

      const fieldMasks = permissionResult.fieldMasks.map(m => ({
        fieldPath: m.fieldPath,
        maskType: m.maskType
      }))

      return applyFieldMasksToResult(result, ctx, fieldMasks)
    }
  }
}

export function wrapAllToolsWithPermissions(
  tools: Record<string, BuiltinTool>,
  ctx: ToolContext
): Record<string, WrappedTool> {
  const wrapped: Record<string, WrappedTool> = {}

  for (const [name, tool] of Object.entries(tools)) {
    wrapped[name] = wrapToolWithPermissions(tool, ctx)
  }

  return wrapped
}

export interface AgentBundleTool {
  name: string
  description?: string
  parameters?: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

export function wrapBundleToolWithContext(
  tool: AgentBundleTool,
  ctx: ToolContext
): WrappedTool {
  return {
    name: tool.name,
    description: tool.description || '',
    parameters: tool.parameters || {},
    handler: async (args: Record<string, unknown>) => {
      return await tool.handler(args)
    }
  }
}

export function mergeTools(
  builtinTools: Record<string, WrappedTool>,
  bundleTools: AgentBundleTool[],
  ctx: ToolContext
): WrappedTool[] {
  const merged: WrappedTool[] = []

  for (const tool of Object.values(builtinTools)) {
    merged.push(tool)
  }

  for (const bundleTool of bundleTools) {
    if (!builtinTools[bundleTool.name]) {
      merged.push(wrapBundleToolWithContext(bundleTool, ctx))
    }
  }

  return merged
}
