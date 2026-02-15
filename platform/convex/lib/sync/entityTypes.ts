import { MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"

export interface EntityTypeInput {
  name: string
  slug: string
  schema: Record<string, unknown>
  searchFields?: string[]
  displayConfig?: Record<string, unknown>
  boundToRole?: string
  userIdField?: string
}

export async function syncEntityTypes(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  entityTypes: EntityTypeInput[],
  environment: "development" | "production"
): Promise<{ created: string[]; updated: string[]; deleted: string[] }> {
  const result = { created: [] as string[], updated: [] as string[], deleted: [] as string[] }
  const now = Date.now()

  const existingTypes = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_env", (q) => q.eq("organizationId", organizationId).eq("environment", environment))
    .collect()

  const existingBySlug = new Map(existingTypes.map((t) => [t.slug, t]))
  const inputSlugs = new Set(entityTypes.map((t) => t.slug))

  const boundRoles = new Map<string, string>()
  for (const et of entityTypes) {
    if (et.boundToRole) {
      if (boundRoles.has(et.boundToRole)) {
        throw new Error(
          `Multiple entity types bound to role "${et.boundToRole}": "${boundRoles.get(et.boundToRole)}" and "${et.slug}"`
        )
      }
      boundRoles.set(et.boundToRole, et.slug)
    }
  }

  for (const entityType of entityTypes) {
    const existing = existingBySlug.get(entityType.slug)

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: entityType.name,
        schema: entityType.schema,
        searchFields: entityType.searchFields || [],
        displayConfig: entityType.displayConfig,
        boundToRole: entityType.boundToRole,
        userIdField: entityType.userIdField,
        updatedAt: now,
      })
      result.updated.push(entityType.slug)
    } else {
      await ctx.db.insert("entityTypes", {
        organizationId,
        environment,
        name: entityType.name,
        slug: entityType.slug,
        schema: entityType.schema,
        searchFields: entityType.searchFields || [],
        displayConfig: entityType.displayConfig,
        boundToRole: entityType.boundToRole,
        userIdField: entityType.userIdField,
        createdAt: now,
        updatedAt: now,
      })
      result.created.push(entityType.slug)
    }
  }

  for (const existing of existingTypes) {
    if (!inputSlugs.has(existing.slug)) {
      await ctx.db.delete(existing._id)
      result.deleted.push(existing.slug)
    }
  }

  return result
}

export async function getEntityTypeSlugs(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  environment: "development" | "production"
): Promise<string[]> {
  const types = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_env", (q) => q.eq("organizationId", organizationId).eq("environment", environment))
    .collect()

  return types.map((t) => t.slug)
}
