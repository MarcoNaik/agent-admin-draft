import { MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"

export interface FixtureEntityInput {
  ref: string
  type: string
  data: Record<string, unknown>
  status?: string
}

export interface FixtureRelationInput {
  from: string
  to: string
  type: string
  metadata?: Record<string, unknown>
}

export interface FixtureInput {
  name: string
  slug: string
  entities: FixtureEntityInput[]
  relations?: FixtureRelationInput[]
}

export async function syncFixtures(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  fixtures: FixtureInput[],
  environment: "development" | "production" | "eval"
): Promise<{ entitiesCreated: number; relationsCreated: number }> {
  const now = Date.now()

  const existingEntities = await ctx.db
    .query("entities")
    .withIndex("by_org_env_type", (q) => q.eq("organizationId", organizationId).eq("environment", environment))
    .collect()

  const activeEntities = existingEntities.filter((e) => !e.deletedAt)

  for (const entity of activeEntities) {
    const fromRelations = await ctx.db
      .query("entityRelations")
      .withIndex("by_from", (q) => q.eq("fromEntityId", entity._id))
      .collect()
    for (const rel of fromRelations) {
      await ctx.db.delete(rel._id)
    }

    const toRelations = await ctx.db
      .query("entityRelations")
      .withIndex("by_to", (q) => q.eq("toEntityId", entity._id))
      .collect()
    for (const rel of toRelations) {
      await ctx.db.delete(rel._id)
    }
  }

  for (const entity of activeEntities) {
    await ctx.db.delete(entity._id)
  }

  const refMap = new Map<string, Id<"entities">>()
  let entitiesCreated = 0
  let relationsCreated = 0

  for (const fixture of fixtures) {
    for (const entity of fixture.entities) {
      const entityType = await ctx.db
        .query("entityTypes")
        .withIndex("by_org_env_slug", (q) =>
          q.eq("organizationId", organizationId)
            .eq("environment", environment)
            .eq("slug", entity.type)
        )
        .first()

      if (!entityType) {
        throw new Error(`Fixture "${fixture.slug}": entity type "${entity.type}" not found in ${environment} environment`)
      }

      const entityId = await ctx.db.insert("entities", {
        organizationId,
        environment,
        entityTypeId: entityType._id,
        data: entity.data,
        status: entity.status || "active",
        searchText: "",
        createdAt: now,
        updatedAt: now,
      })

      refMap.set(entity.ref, entityId)
      entitiesCreated++
    }

    if (fixture.relations) {
      for (const relation of fixture.relations) {
        const fromId = refMap.get(relation.from)
        const toId = refMap.get(relation.to)

        if (!fromId) {
          throw new Error(`Fixture "${fixture.slug}": relation references unknown ref "${relation.from}"`)
        }
        if (!toId) {
          throw new Error(`Fixture "${fixture.slug}": relation references unknown ref "${relation.to}"`)
        }

        await ctx.db.insert("entityRelations", {
          organizationId,
          environment,
          fromEntityId: fromId,
          toEntityId: toId,
          relationType: relation.type,
          metadata: relation.metadata || {},
          createdAt: now,
        })

        relationsCreated++
      }
    }
  }

  const incomingSlugs = new Set(fixtures.map((f) => f.slug))

  const existingFixtures = await ctx.db
    .query("fixtures")
    .withIndex("by_org_env", (q) => q.eq("organizationId", organizationId).eq("environment", environment))
    .collect()

  for (const existing of existingFixtures) {
    if (!incomingSlugs.has(existing.slug)) {
      await ctx.db.delete(existing._id)
    }
  }

  for (const fixture of fixtures) {
    const entityTypeCounts: Record<string, number> = {}
    for (const entity of fixture.entities) {
      entityTypeCounts[entity.type] = (entityTypeCounts[entity.type] || 0) + 1
    }

    const existing = await ctx.db
      .query("fixtures")
      .withIndex("by_org_env_slug", (q) =>
        q.eq("organizationId", organizationId)
          .eq("environment", environment)
          .eq("slug", fixture.slug)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: fixture.name,
        entityCount: fixture.entities.length,
        relationCount: fixture.relations?.length ?? 0,
        entityTypeCounts,
        syncedAt: now,
      })
    } else {
      await ctx.db.insert("fixtures", {
        organizationId,
        environment,
        name: fixture.name,
        slug: fixture.slug,
        entityCount: fixture.entities.length,
        relationCount: fixture.relations?.length ?? 0,
        entityTypeCounts,
        syncedAt: now,
      })
    }
  }

  return { entitiesCreated, relationsCreated }
}
