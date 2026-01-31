import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { requireAuth, getAuthContext } from "./lib/auth"
import {
  syncEntityTypes,
  syncRoles,
  syncAgents,
  deployAllAgentsToProd,
} from "./lib/sync"

export const syncOrganization = mutation({
  args: {
    agents: v.array(
      v.object({
        name: v.string(),
        slug: v.string(),
        version: v.string(),
        description: v.optional(v.string()),
        systemPrompt: v.string(),
        model: v.object({
          provider: v.string(),
          name: v.string(),
          temperature: v.optional(v.number()),
          maxTokens: v.optional(v.number()),
        }),
        tools: v.array(
          v.object({
            name: v.string(),
            description: v.string(),
            parameters: v.any(),
            handlerCode: v.optional(v.string()),
            isBuiltin: v.boolean(),
          })
        ),
      })
    ),
    entityTypes: v.array(
      v.object({
        name: v.string(),
        slug: v.string(),
        schema: v.any(),
        searchFields: v.optional(v.array(v.string())),
        displayConfig: v.optional(v.any()),
      })
    ),
    roles: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        policies: v.array(
          v.object({
            resource: v.string(),
            actions: v.array(v.string()),
            effect: v.union(v.literal("allow"), v.literal("deny")),
            priority: v.optional(v.number()),
          })
        ),
        scopeRules: v.optional(
          v.array(
            v.object({
              entityType: v.string(),
              field: v.string(),
              operator: v.string(),
              value: v.string(),
            })
          )
        ),
        fieldMasks: v.optional(
          v.array(
            v.object({
              entityType: v.string(),
              fieldPath: v.string(),
              maskType: v.union(v.literal("hide"), v.literal("redact")),
              maskConfig: v.optional(v.any()),
            })
          )
        ),
      })
    ),
    preservePackResources: v.optional(v.boolean()),
    preserveUnmanagedAgents: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const installedPacks = await ctx.db
      .query("installedPacks")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    const packEntityTypeIds = new Set(
      installedPacks.flatMap((p) => p.entityTypeIds.map((id) => id.toString()))
    )
    const packRoleIds = new Set(
      installedPacks.flatMap((p) => p.roleIds.map((id) => id.toString()))
    )

    const entityTypeResult = await syncEntityTypes(
      ctx,
      auth.organizationId,
      args.entityTypes,
      args.preservePackResources !== false ? packEntityTypeIds : undefined
    )

    const roleResult = await syncRoles(
      ctx,
      auth.organizationId,
      args.roles,
      args.preservePackResources !== false ? packRoleIds : undefined
    )

    const agentResult = await syncAgents(
      ctx,
      auth.organizationId,
      args.agents,
      auth.userId,
      args.preserveUnmanagedAgents !== false
    )

    return {
      success: true,
      entityTypes: entityTypeResult,
      roles: roleResult,
      agents: agentResult,
      packResourcesPreserved: installedPacks.length > 0,
    }
  },
})

export const getSyncState = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx)

    const entityTypes = await ctx.db
      .query("entityTypes")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    const nonSystemRoles = roles.filter((r) => !r.isSystem)

    const roleWithPolicyCounts = await Promise.all(
      nonSystemRoles.map(async (role) => {
        const policies = await ctx.db
          .query("policies")
          .withIndex("by_role", (q) => q.eq("roleId", role._id))
          .collect()
        return {
          name: role.name,
          policyCount: policies.length,
        }
      })
    )

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    const activeAgents = agents.filter((a) => a.status !== "deleted")

    const agentStates = await Promise.all(
      activeAgents.map(async (agent) => {
        let version = "0.0.0"
        let hasDevConfig = false
        let hasProdConfig = false

        if (agent.developmentConfigId) {
          const devConfig = await ctx.db.get(agent.developmentConfigId)
          if (devConfig) {
            version = devConfig.version
            hasDevConfig = true
          }
        }

        if (agent.productionConfigId) {
          hasProdConfig = true
        }

        return {
          slug: agent.slug,
          name: agent.name,
          version,
          hasDevConfig,
          hasProdConfig,
        }
      })
    )

    const installedPacks = await ctx.db
      .query("installedPacks")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    const packEntityTypeIds = new Set(
      installedPacks.flatMap((p) => p.entityTypeIds.map((id) => id.toString()))
    )
    const packRoleIds = new Set(
      installedPacks.flatMap((p) => p.roleIds.map((id) => id.toString()))
    )

    return {
      agents: agentStates,
      entityTypes: entityTypes.map((t) => ({
        slug: t.slug,
        name: t.name,
        isPackManaged: packEntityTypeIds.has(t._id.toString()),
      })),
      roles: roleWithPolicyCounts.map((r) => {
        const role = nonSystemRoles.find((nr) => nr.name === r.name)
        return {
          ...r,
          isPackManaged: role ? packRoleIds.has(role._id.toString()) : false,
        }
      }),
      installedPacks: installedPacks.map((p) => ({
        packId: p.packId,
        version: p.version,
        entityTypeCount: p.entityTypeIds.length,
        roleCount: p.roleIds.length,
      })),
    }
  },
})

export const deployAllAgents = mutation({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx)

    const result = await deployAllAgentsToProd(
      ctx,
      auth.organizationId,
      auth.userId
    )

    return {
      success: true,
      ...result,
    }
  },
})
