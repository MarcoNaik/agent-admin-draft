import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { getAuthContextForOrg } from "./lib/auth"
import {
  syncEntityTypes,
  syncRoles,
  syncAgents,
  syncEvalSuites,
  syncTriggers,
} from "./lib/sync"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

export const syncOrganization = mutation({
  args: {
    organizationId: v.optional(v.string()),
    environment: environmentValidator,
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
        boundToRole: v.optional(v.string()),
        userIdField: v.optional(v.string()),
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
    evalSuites: v.optional(v.array(
      v.object({
        name: v.string(),
        slug: v.string(),
        agentSlug: v.string(),
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        judgeModel: v.optional(v.object({
          provider: v.string(),
          name: v.string(),
        })),
        judgeContext: v.optional(v.string()),
        judgePrompt: v.optional(v.string()),
        cases: v.array(
          v.object({
            name: v.string(),
            description: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
            turns: v.array(
              v.object({
                userMessage: v.string(),
                assertions: v.optional(v.array(
                  v.object({
                    type: v.union(
                      v.literal("llm_judge"),
                      v.literal("contains"),
                      v.literal("matches"),
                      v.literal("tool_called"),
                      v.literal("tool_not_called")
                    ),
                    criteria: v.optional(v.string()),
                    value: v.optional(v.string()),
                    weight: v.optional(v.number()),
                  })
                )),
              })
            ),
            finalAssertions: v.optional(v.array(
              v.object({
                type: v.union(
                  v.literal("llm_judge"),
                  v.literal("contains"),
                  v.literal("matches"),
                  v.literal("tool_called"),
                  v.literal("tool_not_called")
                ),
                criteria: v.optional(v.string()),
                value: v.optional(v.string()),
                weight: v.optional(v.number()),
              })
            )),
          })
        ),
      })
    )),
    triggers: v.optional(v.array(
      v.object({
        name: v.string(),
        slug: v.string(),
        description: v.optional(v.string()),
        entityType: v.string(),
        action: v.string(),
        condition: v.optional(v.any()),
        actions: v.array(
          v.object({
            tool: v.string(),
            args: v.any(),
            as: v.optional(v.string()),
          })
        ),
        schedule: v.optional(v.object({
          delay: v.optional(v.number()),
          at: v.optional(v.string()),
          offset: v.optional(v.number()),
          cancelPrevious: v.optional(v.boolean()),
        })),
        retry: v.optional(v.object({
          maxAttempts: v.optional(v.number()),
          backoffMs: v.optional(v.number()),
        })),
      })
    )),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)

    const entityTypeResult = await syncEntityTypes(
      ctx,
      auth.organizationId,
      args.entityTypes,
      args.environment
    )

    const roleResult = await syncRoles(
      ctx,
      auth.organizationId,
      args.roles,
      args.environment
    )

    const agentResult = await syncAgents(
      ctx,
      auth.organizationId,
      args.agents,
      args.environment,
      auth.userId
    )

    let evalSuitesResult
    if (args.evalSuites && args.evalSuites.length > 0) {
      evalSuitesResult = await syncEvalSuites(
        ctx,
        auth.organizationId,
        args.evalSuites,
        args.environment
      )
    }

    let triggersResult
    if (args.triggers && args.triggers.length > 0) {
      triggersResult = await syncTriggers(
        ctx,
        auth.organizationId,
        args.triggers,
        args.environment
      )
    }

    return {
      success: true,
      entityTypes: entityTypeResult,
      roles: roleResult,
      agents: agentResult,
      evalSuites: evalSuitesResult,
      triggers: triggersResult,
    }
  },
})

export const getSyncState = query({
  args: {
    organizationId: v.optional(v.string()),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)

    const entityTypes = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", args.environment))
      .collect()

    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", args.environment))
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
        const config = await ctx.db
          .query("agentConfigs")
          .withIndex("by_agent_env", (q) => q.eq("agentId", agent._id).eq("environment", args.environment))
          .first()

        return {
          slug: agent.slug,
          name: agent.name,
          version: config?.version ?? "0.0.0",
          hasConfig: !!config,
        }
      })
    )

    const evalSuites = await ctx.db
      .query("evalSuites")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", args.environment))
      .collect()

    const activeEvalSuites = evalSuites.filter((s) => s.status === "active")

    const triggers = await ctx.db
      .query("triggers")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", args.environment))
      .collect()

    const enabledTriggers = triggers.filter((t) => t.enabled)

    return {
      agents: agentStates,
      entityTypes: entityTypes.map((t) => ({
        slug: t.slug,
        name: t.name,
        boundToRole: t.boundToRole,
      })),
      roles: roleWithPolicyCounts,
      evalSuites: activeEvalSuites.map((s) => ({
        slug: s.slug,
        name: s.name,
        agentId: s.agentId,
      })),
      triggers: enabledTriggers.map((t) => ({
        slug: t.slug,
        name: t.name,
        entityType: t.entityType,
        action: t.action,
        hasSchedule: !!t.schedule,
        hasRetry: !!t.retry,
      })),
    }
  },
})

export const getPullState = query({
  args: {
    organizationId: v.optional(v.string()),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)

    const entityTypes = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", args.environment))
      .collect()

    const filteredEntityTypes = entityTypes.map((et) => ({
      name: et.name,
      slug: et.slug,
      schema: et.schema,
      searchFields: et.searchFields,
      displayConfig: et.displayConfig,
      boundToRole: et.boundToRole,
      userIdField: et.userIdField,
    }))

    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", args.environment))
      .collect()

    const nonSystemRoles = roles.filter((r) => !r.isSystem)

    const filteredRoles = await Promise.all(
      nonSystemRoles.map(async (role) => {
          const policies = await ctx.db
            .query("policies")
            .withIndex("by_role", (q) => q.eq("roleId", role._id))
            .collect()

          const grouped = new Map<string, { resource: string; actions: string[]; effect: string }>()

          for (const policy of policies) {
            const key = `${policy.resource}:${policy.effect}`
            const existing = grouped.get(key)
            if (existing) {
              existing.actions.push(policy.action)
            } else {
              grouped.set(key, {
                resource: policy.resource,
                actions: [policy.action],
                effect: policy.effect,
              })
            }
          }

          const scopeRulesSeen = new Set<string>()
          const scopeRules: Array<{ entityType: string; field: string; operator: string; value: string }> = []
          const fieldMasksSeen = new Set<string>()
          const fieldMasks: Array<{ entityType: string; fieldPath: string; maskType: string; maskConfig?: Record<string, unknown> }> = []

          const seenResources = new Set<string>()
          for (const policy of policies) {
            if (seenResources.has(policy.resource)) continue
            seenResources.add(policy.resource)

            const policyScopeRules = await ctx.db
              .query("scopeRules")
              .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
              .collect()

            for (const sr of policyScopeRules) {
              if (!sr.field || !sr.operator || !sr.value) continue
              const srKey = `${policy.resource}:${sr.field}:${sr.operator}:${sr.value}`
              if (!scopeRulesSeen.has(srKey)) {
                scopeRulesSeen.add(srKey)
                scopeRules.push({
                  entityType: policy.resource,
                  field: sr.field,
                  operator: sr.operator,
                  value: sr.value,
                })
              }
            }

            const policyFieldMasks = await ctx.db
              .query("fieldMasks")
              .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
              .collect()

            for (const fm of policyFieldMasks) {
              const fmKey = `${policy.resource}:${fm.fieldPath}:${fm.maskType}`
              if (!fieldMasksSeen.has(fmKey)) {
                fieldMasksSeen.add(fmKey)
                fieldMasks.push({
                  entityType: policy.resource,
                  fieldPath: fm.fieldPath,
                  maskType: fm.maskType,
                  maskConfig: fm.maskConfig as Record<string, unknown> | undefined,
                })
              }
            }
          }

          return {
            name: role.name,
            description: role.description,
            policies: Array.from(grouped.values()),
            scopeRules,
            fieldMasks,
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
        const config = await ctx.db
          .query("agentConfigs")
          .withIndex("by_agent_env", (q) => q.eq("agentId", agent._id).eq("environment", args.environment))
          .first()

        return {
          name: config?.name ?? agent.name,
          slug: agent.slug,
          description: agent.description,
          version: config?.version ?? "0.1.0",
          systemPrompt: config?.systemPrompt ?? "",
          model: config?.model ?? { provider: "anthropic", name: "claude-haiku-4-5" },
          tools: config?.tools ?? [],
        }
      })
    )

    const triggers = await ctx.db
      .query("triggers")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", args.environment))
      .collect()

    const enabledTriggers = triggers.filter((t) => t.enabled)

    return {
      agents: agentStates,
      entityTypes: filteredEntityTypes,
      roles: filteredRoles,
      triggers: enabledTriggers.map((t) => ({
        name: t.name,
        slug: t.slug,
        description: t.description,
        entityType: t.entityType,
        action: t.action,
        condition: t.condition,
        actions: t.actions,
        schedule: t.schedule,
        retry: t.retry,
      })),
    }
  },
})
