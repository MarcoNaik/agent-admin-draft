import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import { AVAILABLE_PACKS, getPackById } from "./packs/index"
import { isUpgrade, isMajorUpgrade, formatVersionDiff } from "./lib/packs/version"
import {
  findMigrationPath,
  executeMigration,
  describeMigrationStep,
  Customizations,
} from "./lib/packs/migrate"

export const list = query({
  args: {},
  returns: v.array(v.object({
    id: v.string(),
    name: v.string(),
    version: v.string(),
    description: v.string(),
    author: v.string(),
    license: v.string(),
    entityTypes: v.array(v.any()),
    roles: v.array(v.any()),
    scopeRules: v.optional(v.array(v.any())),
    fieldMasks: v.optional(v.array(v.any())),
    migrations: v.array(v.any()),
    isInstalled: v.boolean(),
    installedAt: v.optional(v.number()),
    installedVersion: v.optional(v.string()),
    hasUpgrade: v.boolean(),
    upgradeType: v.optional(v.string()),
    status: v.optional(v.string()),
    hasDrift: v.optional(v.boolean()),
    driftDetails: v.optional(v.object({
      missingEntityTypes: v.array(v.string()),
      missingRoles: v.array(v.string()),
    })),
  })),
  handler: async (ctx) => {
    const auth = await requireAuth(ctx)

    const installedPacks = await ctx.db
      .query("installedPacks")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    const installedMap = new Map(installedPacks.map((p) => [p.packId, p]))

    const results = await Promise.all(AVAILABLE_PACKS.map(async (pack) => {
      const installed = installedMap.get(pack.id)
      const hasUpgrade = installed ? isUpgrade(installed.version, pack.version) : false

      let hasDrift = false
      let driftDetails: { missingEntityTypes: string[]; missingRoles: string[] } | undefined

      if (installed) {
        const missingEntityTypes: string[] = []
        const missingRoles: string[] = []

        for (const etId of installed.entityTypeIds) {
          const et = await ctx.db.get(etId)
          if (!et) {
            const packEt = pack.entityTypes.find((_, i) => i < installed.entityTypeIds.length)
            missingEntityTypes.push(packEt?.slug || etId.toString())
          }
        }

        for (const roleId of installed.roleIds) {
          const role = await ctx.db.get(roleId)
          if (!role) {
            const packRole = pack.roles.find((_, i) => i < installed.roleIds.length)
            missingRoles.push(packRole?.name || roleId.toString())
          }
        }

        if (missingEntityTypes.length > 0 || missingRoles.length > 0) {
          hasDrift = true
          driftDetails = { missingEntityTypes, missingRoles }
        }
      }

      return {
        ...pack,
        isInstalled: !!installed,
        installedAt: installed?.installedAt,
        installedVersion: installed?.version,
        hasUpgrade,
        upgradeType: hasUpgrade && installed ? formatVersionDiff(installed.version, pack.version) : undefined,
        status: installed?.status || undefined,
        hasDrift: hasDrift || undefined,
        driftDetails,
      }
    }))

    return results
  },
})

export const get = query({
  args: { packId: v.string() },
  returns: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      version: v.string(),
      description: v.string(),
      author: v.string(),
      license: v.string(),
      entityTypes: v.array(v.any()),
      roles: v.array(v.any()),
      scopeRules: v.optional(v.array(v.any())),
      fieldMasks: v.optional(v.array(v.any())),
      migrations: v.array(v.any()),
      isInstalled: v.boolean(),
      installedAt: v.optional(v.number()),
      installedVersion: v.optional(v.string()),
      hasUpgrade: v.boolean(),
      upgradeType: v.optional(v.string()),
      status: v.optional(v.string()),
      customizations: v.optional(v.object({
        entityTypes: v.array(v.string()),
        roles: v.array(v.string()),
        policies: v.array(v.string()),
      })),
      upgradeHistory: v.optional(v.array(v.object({
        fromVersion: v.string(),
        toVersion: v.string(),
        upgradedAt: v.number(),
        upgradedBy: v.optional(v.id("users")),
      }))),
      hasDrift: v.optional(v.boolean()),
      driftDetails: v.optional(v.object({
        missingEntityTypes: v.array(v.string()),
        missingRoles: v.array(v.string()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const pack = getPackById(args.packId)
    if (!pack) return null

    const auth = await requireAuth(ctx)
    const installed = await ctx.db
      .query("installedPacks")
      .withIndex("by_org_pack", (q) =>
        q.eq("organizationId", auth.organizationId).eq("packId", args.packId)
      )
      .first()

    const hasUpgrade = installed ? isUpgrade(installed.version, pack.version) : false

    let hasDrift = false
    let driftDetails: { missingEntityTypes: string[]; missingRoles: string[] } | undefined

    if (installed) {
      const missingEntityTypes: string[] = []
      const missingRoles: string[] = []

      for (const etId of installed.entityTypeIds) {
        const et = await ctx.db.get(etId)
        if (!et) {
          const packEt = pack.entityTypes.find((_, i) => i < installed.entityTypeIds.length)
          missingEntityTypes.push(packEt?.slug || etId.toString())
        }
      }

      for (const roleId of installed.roleIds) {
        const role = await ctx.db.get(roleId)
        if (!role) {
          const packRole = pack.roles.find((_, i) => i < installed.roleIds.length)
          missingRoles.push(packRole?.name || roleId.toString())
        }
      }

      if (missingEntityTypes.length > 0 || missingRoles.length > 0) {
        hasDrift = true
        driftDetails = { missingEntityTypes, missingRoles }
      }
    }

    return {
      ...pack,
      isInstalled: !!installed,
      installedAt: installed?.installedAt,
      installedVersion: installed?.version,
      hasUpgrade,
      upgradeType: hasUpgrade && installed ? formatVersionDiff(installed.version, pack.version) : undefined,
      status: installed?.status || undefined,
      customizations: installed?.customizations || undefined,
      upgradeHistory: installed?.upgradeHistory || undefined,
      hasDrift: hasDrift || undefined,
      driftDetails,
    }
  },
})

export const install = mutation({
  args: { packId: v.string() },
  returns: v.object({
    success: v.boolean(),
    entityTypesCreated: v.number(),
    rolesCreated: v.number(),
  }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const pack = getPackById(args.packId)

    if (!pack) {
      throw new Error(`Pack ${args.packId} not found`)
    }

    const existing = await ctx.db
      .query("installedPacks")
      .withIndex("by_org_pack", (q) =>
        q.eq("organizationId", auth.organizationId).eq("packId", args.packId)
      )
      .first()

    if (existing) {
      throw new Error(`Pack ${args.packId} is already installed`)
    }

    const now = Date.now()
    const entityTypeIds: Id<"entityTypes">[] = []
    const roleIds: Id<"roles">[] = []
    const roleNameToId = new Map<string, Id<"roles">>()
    const entityTypeSlugToId = new Map<string, Id<"entityTypes">>()

    for (const et of pack.entityTypes) {
      const existingType = await ctx.db
        .query("entityTypes")
        .withIndex("by_org_slug", (q) =>
          q.eq("organizationId", auth.organizationId).eq("slug", et.slug)
        )
        .first()

      if (existingType) {
        entityTypeIds.push(existingType._id)
        entityTypeSlugToId.set(et.slug, existingType._id)
      } else {
        const id = await ctx.db.insert("entityTypes", {
          organizationId: auth.organizationId,
          name: et.name,
          slug: et.slug,
          schema: et.schema,
          searchFields: et.searchFields,
          displayConfig: et.displayConfig,
          createdAt: now,
          updatedAt: now,
        })
        entityTypeIds.push(id)
        entityTypeSlugToId.set(et.slug, id)
      }
    }

    for (const role of pack.roles) {
      const existingRole = await ctx.db
        .query("roles")
        .withIndex("by_org_name", (q) =>
          q.eq("organizationId", auth.organizationId).eq("name", role.name)
        )
        .first()

      let roleId: Id<"roles">
      if (existingRole) {
        roleId = existingRole._id
      } else {
        roleId = await ctx.db.insert("roles", {
          organizationId: auth.organizationId,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          createdAt: now,
          updatedAt: now,
        })
      }
      roleIds.push(roleId)
      roleNameToId.set(role.name, roleId)

      for (const policy of role.policies) {
        for (const action of policy.actions) {
          const policyId = await ctx.db.insert("policies", {
            organizationId: auth.organizationId,
            roleId,
            resource: policy.resource,
            action,
            effect: policy.effect,
            priority: policy.priority,
            createdAt: now,
          })

          if (pack.scopeRules) {
            const matchingScopeRules = pack.scopeRules.filter(
              (sr) =>
                sr.roleName === role.name &&
                (sr.entityTypeSlug === policy.resource || policy.resource === "*")
            )
            for (const sr of matchingScopeRules) {
              if (sr.entityTypeSlug === policy.resource) {
                await ctx.db.insert("scopeRules", {
                  policyId,
                  type: sr.type,
                  field: sr.field,
                  operator: sr.operator,
                  value: sr.value,
                  relationPath: sr.relationPath,
                  createdAt: now,
                })
              }
            }
          }

          if (pack.fieldMasks) {
            const matchingFieldMasks = pack.fieldMasks.filter(
              (fm) =>
                fm.roleName === role.name &&
                (fm.entityTypeSlug === policy.resource || policy.resource === "*")
            )
            for (const fm of matchingFieldMasks) {
              if (fm.entityTypeSlug === policy.resource) {
                await ctx.db.insert("fieldMasks", {
                  policyId,
                  fieldPath: fm.fieldPath,
                  maskType: fm.maskType,
                  maskConfig: fm.maskConfig,
                  createdAt: now,
                })
              }
            }
          }
        }
      }
    }

    await ctx.db.insert("installedPacks", {
      organizationId: auth.organizationId,
      packId: args.packId,
      version: pack.version,
      installedAt: now,
      installedBy: auth.userId,
      entityTypeIds,
      roleIds,
      status: "active",
      customizations: {
        entityTypes: [],
        roles: [],
        policies: [],
      },
      upgradeHistory: [],
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      eventType: "pack.installed",
      schemaVersion: 1,
      actorId: auth.userId as unknown as string,
      actorType: "user",
      payload: { packId: args.packId, version: pack.version },
      timestamp: now,
    })

    return {
      success: true,
      entityTypesCreated: entityTypeIds.length,
      rolesCreated: roleIds.length,
    }
  },
})

export const uninstall = mutation({
  args: { packId: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const installed = await ctx.db
      .query("installedPacks")
      .withIndex("by_org_pack", (q) =>
        q.eq("organizationId", auth.organizationId).eq("packId", args.packId)
      )
      .first()

    if (!installed) {
      throw new Error(`Pack ${args.packId} is not installed`)
    }

    await ctx.db.delete(installed._id)

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      eventType: "pack.uninstalled",
      schemaVersion: 1,
      actorId: auth.userId as unknown as string,
      actorType: "user",
      payload: { packId: args.packId },
      timestamp: Date.now(),
    })

    return { success: true }
  },
})

export const previewUpgrade = query({
  args: { packId: v.string() },
  returns: v.union(
    v.object({
      canUpgrade: v.boolean(),
      fromVersion: v.string(),
      toVersion: v.string(),
      upgradeType: v.string(),
      isMajor: v.boolean(),
      automaticChanges: v.array(v.object({
        type: v.string(),
        description: v.string(),
      })),
      skippedDueToCustomization: v.array(v.object({
        type: v.string(),
        description: v.string(),
        entityType: v.optional(v.string()),
      })),
      migrationsRequired: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const pack = getPackById(args.packId)
    if (!pack) return null

    const installed = await ctx.db
      .query("installedPacks")
      .withIndex("by_org_pack", (q) =>
        q.eq("organizationId", auth.organizationId).eq("packId", args.packId)
      )
      .first()

    if (!installed) return null
    if (!isUpgrade(installed.version, pack.version)) return null

    const customizations: Customizations = installed.customizations || {
      entityTypes: [],
      roles: [],
      policies: [],
    }

    let migrations: ReturnType<typeof findMigrationPath> = []
    try {
      migrations = findMigrationPath(pack.migrations, installed.version, pack.version)
    } catch {
      return {
        canUpgrade: false,
        fromVersion: installed.version,
        toVersion: pack.version,
        upgradeType: formatVersionDiff(installed.version, pack.version),
        isMajor: isMajorUpgrade(installed.version, pack.version),
        automaticChanges: [],
        skippedDueToCustomization: [],
        migrationsRequired: 0,
      }
    }

    const automaticChanges: { type: string; description: string }[] = []
    const skippedDueToCustomization: { type: string; description: string; entityType?: string }[] = []

    for (const migration of migrations) {
      for (const step of migration.steps) {
        const description = describeMigrationStep(step)
        const entityType = "entityType" in step ? step.entityType : undefined
        const entityTypeSlug = typeof entityType === "string" ? entityType : entityType?.slug

        if (entityTypeSlug && customizations.entityTypes.includes(entityTypeSlug)) {
          skippedDueToCustomization.push({
            type: step.type,
            description,
            entityType: entityTypeSlug,
          })
        } else {
          automaticChanges.push({
            type: step.type,
            description,
          })
        }
      }
    }

    return {
      canUpgrade: true,
      fromVersion: installed.version,
      toVersion: pack.version,
      upgradeType: formatVersionDiff(installed.version, pack.version),
      isMajor: isMajorUpgrade(installed.version, pack.version),
      automaticChanges,
      skippedDueToCustomization,
      migrationsRequired: migrations.length,
    }
  },
})

export const upgrade = mutation({
  args: { packId: v.string() },
  returns: v.object({
    success: v.boolean(),
    fromVersion: v.string(),
    toVersion: v.string(),
    migrationsApplied: v.number(),
  }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const pack = getPackById(args.packId)

    if (!pack) {
      throw new Error(`Pack ${args.packId} not found`)
    }

    const installed = await ctx.db
      .query("installedPacks")
      .withIndex("by_org_pack", (q) =>
        q.eq("organizationId", auth.organizationId).eq("packId", args.packId)
      )
      .first()

    if (!installed) {
      throw new Error(`Pack ${args.packId} is not installed`)
    }

    const fromVersion = installed.version

    if (!isUpgrade(fromVersion, pack.version)) {
      throw new Error(`Pack is already at version ${pack.version}`)
    }

    const customizations: Customizations = installed.customizations || {
      entityTypes: [],
      roles: [],
      policies: [],
    }

    await ctx.db.patch(installed._id, { status: "upgrading" })

    try {
      const migrations = findMigrationPath(pack.migrations, fromVersion, pack.version)

      for (const migration of migrations) {
        await executeMigration(ctx, auth.organizationId, pack, migration, customizations)
      }

      const now = Date.now()
      const upgradeHistory = installed.upgradeHistory || []

      await ctx.db.patch(installed._id, {
        version: pack.version,
        status: "active",
        lastUpgradedAt: now,
        lastUpgradedBy: auth.userId,
        upgradeHistory: [
          ...upgradeHistory,
          {
            fromVersion,
            toVersion: pack.version,
            upgradedAt: now,
            upgradedBy: auth.userId,
          },
        ],
      })

      await ctx.db.insert("events", {
        organizationId: auth.organizationId,
        eventType: "pack.upgraded",
        schemaVersion: 1,
        actorId: auth.userId as unknown as string,
        actorType: "user",
        payload: {
          packId: args.packId,
          fromVersion,
          toVersion: pack.version,
          migrationsApplied: migrations.length,
        },
        timestamp: now,
      })

      return {
        success: true,
        fromVersion,
        toVersion: pack.version,
        migrationsApplied: migrations.length,
      }
    } catch (error) {
      await ctx.db.patch(installed._id, { status: "failed" })
      throw error
    }
  },
})

export const trackCustomization = mutation({
  args: {
    packId: v.string(),
    customizationType: v.union(v.literal("entityType"), v.literal("role"), v.literal("policy")),
    identifier: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const installed = await ctx.db
      .query("installedPacks")
      .withIndex("by_org_pack", (q) =>
        q.eq("organizationId", auth.organizationId).eq("packId", args.packId)
      )
      .first()

    if (!installed) {
      return { success: false }
    }

    const customizations = installed.customizations || {
      entityTypes: [],
      roles: [],
      policies: [],
    }

    let updated = false

    if (args.customizationType === "entityType" && !customizations.entityTypes.includes(args.identifier)) {
      customizations.entityTypes.push(args.identifier)
      updated = true
    } else if (args.customizationType === "role" && !customizations.roles.includes(args.identifier)) {
      customizations.roles.push(args.identifier)
      updated = true
    } else if (args.customizationType === "policy" && !customizations.policies.includes(args.identifier)) {
      customizations.policies.push(args.identifier)
      updated = true
    }

    if (updated) {
      await ctx.db.patch(installed._id, { customizations })
    }

    return { success: true }
  },
})
