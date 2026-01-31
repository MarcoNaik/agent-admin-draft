import { MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"

export interface EntityTypeInput {
  name: string
  slug: string
  schema: Record<string, unknown>
  searchFields?: string[]
  displayConfig?: Record<string, unknown>
}

export async function syncEntityTypes(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  entityTypes: EntityTypeInput[],
  preserveIds?: Set<string>
): Promise<{ created: string[]; updated: string[]; deleted: string[]; preserved: string[] }> {
  const result = { created: [] as string[], updated: [] as string[], deleted: [] as string[], preserved: [] as string[] }
  const now = Date.now()

  const existingTypes = await ctx.db
    .query("entityTypes")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .collect()

  const existingBySlug = new Map(existingTypes.map((t) => [t.slug, t]))
  const inputSlugs = new Set(entityTypes.map((t) => t.slug))

  for (const entityType of entityTypes) {
    const existing = existingBySlug.get(entityType.slug)

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: entityType.name,
        schema: entityType.schema,
        searchFields: entityType.searchFields || [],
        displayConfig: entityType.displayConfig,
        updatedAt: now,
      })
      result.updated.push(entityType.slug)
    } else {
      await ctx.db.insert("entityTypes", {
        organizationId,
        name: entityType.name,
        slug: entityType.slug,
        schema: entityType.schema,
        searchFields: entityType.searchFields || [],
        displayConfig: entityType.displayConfig,
        createdAt: now,
        updatedAt: now,
      })
      result.created.push(entityType.slug)
    }
  }

  for (const existing of existingTypes) {
    if (!inputSlugs.has(existing.slug)) {
      if (preserveIds?.has(existing._id.toString())) {
        result.preserved.push(existing.slug)
      } else {
        await ctx.db.delete(existing._id)
        result.deleted.push(existing.slug)
      }
    }
  }

  return result
}

export async function getEntityTypeSlugs(
  ctx: MutationCtx,
  organizationId: Id<"organizations">
): Promise<string[]> {
  const types = await ctx.db
    .query("entityTypes")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .collect()

  return types.map((t) => t.slug)
}
