import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import { AVAILABLE_PACKS, getPackById } from "./packs/index"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx)

    const installedPacks = await ctx.db
      .query("installedPacks")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    const installedIds = new Set(installedPacks.map((p) => p.packId))

    return AVAILABLE_PACKS.map((pack) => ({
      ...pack,
      isInstalled: installedIds.has(pack.id),
      installedAt: installedPacks.find((p) => p.packId === pack.id)?.installedAt,
    }))
  },
})

export const get = query({
  args: { packId: v.string() },
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

    return {
      ...pack,
      isInstalled: !!installed,
      installedAt: installed?.installedAt,
    }
  },
})

export const install = mutation({
  args: { packId: v.string() },
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

    for (const et of pack.entityTypes) {
      const existingType = await ctx.db
        .query("entityTypes")
        .withIndex("by_org_slug", (q) =>
          q.eq("organizationId", auth.organizationId).eq("slug", et.slug)
        )
        .first()

      if (existingType) {
        entityTypeIds.push(existingType._id)
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

      for (const policy of role.policies) {
        for (const action of policy.actions) {
          await ctx.db.insert("policies", {
            organizationId: auth.organizationId,
            roleId,
            resource: policy.resource,
            action,
            effect: policy.effect,
            priority: policy.priority,
            createdAt: now,
          })
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
