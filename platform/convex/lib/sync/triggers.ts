import { MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"

export interface TriggerInput {
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
}

export async function syncTriggers(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  triggers: TriggerInput[],
  environment: "development" | "production"
): Promise<{ created: string[]; updated: string[]; deleted: string[] }> {
  const result = { created: [] as string[], updated: [] as string[], deleted: [] as string[] }
  const now = Date.now()

  const existingTriggers = await ctx.db
    .query("triggers")
    .withIndex("by_org_env", (q) => q.eq("organizationId", organizationId).eq("environment", environment))
    .collect()

  const existingBySlug = new Map(existingTriggers.map((t) => [t.slug, t]))
  const inputSlugs = new Set(triggers.map((t) => t.slug))

  for (const trigger of triggers) {
    const existing = existingBySlug.get(trigger.slug)

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: trigger.name,
        description: trigger.description,
        entityType: trigger.entityType,
        action: trigger.action,
        condition: trigger.condition,
        actions: trigger.actions,
        updatedAt: now,
      })
      result.updated.push(trigger.slug)
    } else {
      await ctx.db.insert("triggers", {
        organizationId,
        environment,
        name: trigger.name,
        slug: trigger.slug,
        description: trigger.description,
        entityType: trigger.entityType,
        action: trigger.action,
        condition: trigger.condition,
        actions: trigger.actions,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      result.created.push(trigger.slug)
    }
  }

  for (const existing of existingTriggers) {
    if (!inputSlugs.has(existing.slug)) {
      await ctx.db.delete(existing._id)
      result.deleted.push(existing.slug)
    }
  }

  return result
}
