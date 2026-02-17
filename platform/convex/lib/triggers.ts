import { MutationCtx } from "../_generated/server"
import { internal } from "../_generated/api"
import { Id } from "../_generated/dataModel"
import { Environment } from "./permissions/types"

interface TriggerParams {
  organizationId: Id<"organizations">
  environment: Environment
  entityTypeSlug: string
  action: "created" | "updated" | "deleted"
  entityId: Id<"entities">
  data: Record<string, unknown>
  previousData?: Record<string, unknown>
}

export async function checkAndScheduleTriggers(
  ctx: MutationCtx,
  params: TriggerParams
): Promise<void> {
  const triggers = await ctx.db
    .query("triggers")
    .withIndex("by_org_env_entity", (q) =>
      q
        .eq("organizationId", params.organizationId)
        .eq("environment", params.environment)
        .eq("entityType", params.entityTypeSlug)
    )
    .collect()

  const matching = triggers.filter((t) => {
    if (!t.enabled) return false
    if (t.action !== params.action) return false
    if (t.condition) {
      return evaluateCondition(t.condition as Record<string, unknown>, {
        data: params.data,
        previousData: params.previousData,
      })
    }
    return true
  })

  for (const trigger of matching) {
    await ctx.scheduler.runAfter(0, internal.triggers.execute, {
      triggerId: trigger._id,
      entityId: params.entityId,
      entityTypeSlug: params.entityTypeSlug,
      action: params.action,
      data: params.data,
      previousData: params.previousData,
      organizationId: params.organizationId,
      environment: params.environment,
    })
  }
}

export function evaluateCondition(
  condition: Record<string, unknown>,
  data: Record<string, unknown>
): boolean {
  for (const [path, expected] of Object.entries(condition)) {
    const actual = getNestedValue(data, path)
    if (actual !== expected) {
      return false
    }
  }
  return true
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function resolveTemplateVars(
  obj: unknown,
  context: Record<string, unknown>
): unknown {
  if (typeof obj === "string") {
    const exactMatch = obj.match(/^\{\{([^}]+)\}\}$/)
    if (exactMatch) {
      const value = getNestedValue(context as Record<string, unknown>, exactMatch[1].trim())
      return value ?? ""
    }

    return obj.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
      const trimmed = path.trim()
      const value = getNestedValue(context as Record<string, unknown>, trimmed)
      if (value === undefined || value === null) {
        return ""
      }
      if (typeof value === "object") {
        return JSON.stringify(value)
      }
      return String(value)
    })
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveTemplateVars(item, context))
  }

  if (obj !== null && typeof obj === "object") {
    const resolved: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      resolved[key] = resolveTemplateVars(value, context)
    }
    return resolved
  }

  return obj
}
