import { MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"
import {
  Migration,
  MigrationStep,
  PackDefinition,
  EntityTypeDefinition,
} from "../../packs/index"
import { isUpgrade } from "./version"

export interface Customizations {
  entityTypes: string[]
  roles: string[]
  policies: string[]
}

export function findMigrationPath(
  migrations: Migration[],
  from: string,
  to: string
): Migration[] {
  const path: Migration[] = []
  let current = from

  while (current !== to) {
    const next = migrations.find((m) => m.fromVersion === current)
    if (!next) {
      throw new Error(`No migration path from ${current} to ${to}`)
    }
    if (!isUpgrade(current, next.toVersion)) {
      throw new Error(`Invalid migration: ${current} -> ${next.toVersion}`)
    }
    path.push(next)
    current = next.toVersion
  }

  return path
}

export async function executeMigration(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  pack: PackDefinition,
  migration: Migration,
  customizations: Customizations
): Promise<void> {
  for (const step of migration.steps) {
    await executeMigrationStep(ctx, organizationId, pack, step, customizations)
  }
}

export async function executeMigrationStep(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  pack: PackDefinition,
  step: MigrationStep,
  customizations: Customizations
): Promise<void> {
  switch (step.type) {
    case "add_field":
      if (customizations.entityTypes.includes(step.entityType)) {
        return
      }
      await addFieldToEntities(
        ctx,
        organizationId,
        step.entityType,
        step.field,
        step.defaultValue
      )
      break

    case "remove_field":
      await removeFieldFromEntities(
        ctx,
        organizationId,
        step.entityType,
        step.field
      )
      break

    case "rename_field":
      await renameFieldInEntities(
        ctx,
        organizationId,
        step.entityType,
        step.oldField,
        step.newField
      )
      break

    case "add_entity_type":
      await createEntityType(ctx, organizationId, step.entityType)
      break

    case "modify_schema":
      if (customizations.entityTypes.includes(step.entityType)) {
        return
      }
      await updateEntityTypeSchema(
        ctx,
        organizationId,
        step.entityType,
        step.schemaChanges
      )
      break

    case "run_script":
      const scriptFn = pack.migrationScripts?.[step.script]
      if (scriptFn) {
        await scriptFn(ctx, organizationId)
      }
      break
  }
}

export async function addFieldToEntities(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  entityTypeSlug: string,
  field: string,
  defaultValue: unknown
): Promise<number> {
  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) return 0

  const entities = await ctx.db
    .query("entities")
    .withIndex("by_org_type", (q) =>
      q.eq("organizationId", organizationId).eq("entityTypeId", entityType._id)
    )
    .collect()

  let updated = 0
  for (const entity of entities) {
    const data = entity.data as Record<string, unknown>
    if (!(field in data)) {
      await ctx.db.patch(entity._id, {
        data: { ...data, [field]: defaultValue },
        updatedAt: Date.now(),
      })
      updated++
    }
  }

  return updated
}

export async function removeFieldFromEntities(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  entityTypeSlug: string,
  field: string
): Promise<number> {
  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) return 0

  const entities = await ctx.db
    .query("entities")
    .withIndex("by_org_type", (q) =>
      q.eq("organizationId", organizationId).eq("entityTypeId", entityType._id)
    )
    .collect()

  let updated = 0
  for (const entity of entities) {
    const data = entity.data as Record<string, unknown>
    if (field in data) {
      const newData = { ...data }
      delete newData[field]
      await ctx.db.patch(entity._id, {
        data: newData,
        updatedAt: Date.now(),
      })
      updated++
    }
  }

  return updated
}

export async function renameFieldInEntities(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  entityTypeSlug: string,
  oldField: string,
  newField: string
): Promise<number> {
  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) return 0

  const entities = await ctx.db
    .query("entities")
    .withIndex("by_org_type", (q) =>
      q.eq("organizationId", organizationId).eq("entityTypeId", entityType._id)
    )
    .collect()

  let updated = 0
  for (const entity of entities) {
    const data = entity.data as Record<string, unknown>
    if (oldField in data) {
      const newData = { ...data }
      newData[newField] = newData[oldField]
      delete newData[oldField]
      await ctx.db.patch(entity._id, {
        data: newData,
        updatedAt: Date.now(),
      })
      updated++
    }
  }

  return updated
}

export async function createEntityType(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  entityType: EntityTypeDefinition
): Promise<Id<"entityTypes"> | null> {
  const existing = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", entityType.slug)
    )
    .first()

  if (existing) return null

  const now = Date.now()
  return await ctx.db.insert("entityTypes", {
    organizationId,
    name: entityType.name,
    slug: entityType.slug,
    schema: entityType.schema,
    searchFields: entityType.searchFields,
    displayConfig: entityType.displayConfig,
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateEntityTypeSchema(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  entityTypeSlug: string,
  schemaChanges: Record<string, unknown>
): Promise<boolean> {
  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) return false

  const currentSchema = entityType.schema as Record<string, unknown>
  const newSchema = { ...currentSchema, ...schemaChanges }

  await ctx.db.patch(entityType._id, {
    schema: newSchema,
    updatedAt: Date.now(),
  })

  return true
}

export function describeMigrationStep(step: MigrationStep): string {
  switch (step.type) {
    case "add_field":
      return `Add field "${step.field}" to ${step.entityType}`
    case "remove_field":
      return `Remove field "${step.field}" from ${step.entityType}`
    case "rename_field":
      return `Rename field "${step.oldField}" to "${step.newField}" in ${step.entityType}`
    case "add_entity_type":
      return `Add entity type "${step.entityType.name}"`
    case "modify_schema":
      return `Modify schema for ${step.entityType}`
    case "run_script":
      return `Run migration script: ${step.script}`
  }
}
