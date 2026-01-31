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
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const entityTypeResult = await syncEntityTypes(
      ctx,
      auth.organizationId,
      args.entityTypes
    )

    const roleResult = await syncRoles(
      ctx,
      auth.organizationId,
      args.roles
    )

    const agentResult = await syncAgents(
      ctx,
      auth.organizationId,
      args.agents,
      auth.userId
    )

    return {
      success: true,
      entityTypes: entityTypeResult,
      roles: roleResult,
      agents: agentResult,
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

    return {
      agents: agentStates,
      entityTypes: entityTypes.map((t) => ({
        slug: t.slug,
        name: t.name,
      })),
      roles: roleWithPolicyCounts,
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
