import { QueryCtx } from "../../_generated/server"
import { ActorContext, FieldMaskResult } from "./types"

export async function getFieldMask(
  ctx: QueryCtx,
  actor: ActorContext,
  entityTypeSlug: string
): Promise<FieldMaskResult & { hiddenFields?: string[] }> {
  if (actor.actorType === "system" || actor.isOrgAdmin) {
    return { allowedFields: [], isWildcard: true }
  }

  if (actor.roleIds.length === 0 && actor.actorType === "user") {
    return { allowedFields: [], isWildcard: true }
  }

  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_env_slug", (q) =>
      q.eq("organizationId", actor.organizationId).eq("environment", actor.environment).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) {
    return { allowedFields: [], isWildcard: false }
  }

  const policies = await ctx.db
    .query("policies")
    .withIndex("by_org_resource", (q) => q.eq("organizationId", actor.organizationId))
    .filter((q) =>
      q.or(
        q.eq(q.field("resource"), entityTypeSlug),
        q.eq(q.field("resource"), "*")
      )
    )
    .collect()

  const applicablePolicies = policies.filter(
    (p) => actor.roleIds.includes(p.roleId) && p.effect === "allow"
  )

  if (applicablePolicies.length === 0) {
    return { allowedFields: [], isWildcard: false }
  }

  const hiddenFields = new Set<string>()

  for (const policy of applicablePolicies) {
    const masks = await ctx.db
      .query("fieldMasks")
      .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
      .collect()

    for (const mask of masks) {
      if (mask.maskType === "hide") {
        hiddenFields.add(mask.fieldPath)
      }
    }
  }

  if (hiddenFields.size === 0) {
    return { allowedFields: [], isWildcard: true }
  }

  return {
    allowedFields: [],
    isWildcard: false,
    hiddenFields: Array.from(hiddenFields),
  }
}

export function applyFieldMask<T extends Record<string, unknown>>(
  record: T,
  mask: FieldMaskResult & { hiddenFields?: string[] }
): Partial<T> {
  if (mask.isWildcard) {
    return record
  }

  if (mask.allowedFields.length === 0 && !mask.hiddenFields) {
    const minimalResult: Record<string, unknown> = {}
    if ("_id" in record) minimalResult._id = record._id
    if ("_creationTime" in record) minimalResult._creationTime = record._creationTime
    return minimalResult as Partial<T>
  }

  const result: Record<string, unknown> = {}

  if (mask.hiddenFields && mask.hiddenFields.length > 0) {
    for (const key of Object.keys(record)) {
      if (!mask.hiddenFields.includes(key)) {
        result[key] = record[key]
      }
    }

    const data = record.data as Record<string, unknown> | undefined
    if (data && typeof data === "object") {
      const filteredData: Record<string, unknown> = {}
      for (const key of Object.keys(data)) {
        const dataPath = `data.${key}`
        if (!mask.hiddenFields.includes(dataPath)) {
          filteredData[key] = data[key]
        }
      }
      result.data = filteredData
    }

    return result as Partial<T>
  }

  for (const field of mask.allowedFields) {
    if (field.includes(".")) {
      setNestedValue(result, field, getNestedValue(record, field))
    } else if (field in record) {
      result[field] = record[field]
    }
  }

  if ("_id" in record) result._id = record._id
  if ("_creationTime" in record) result._creationTime = record._creationTime

  return result as Partial<T>
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".")
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) {
      current[parts[i]] = {}
    }
    current = current[parts[i]] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}
