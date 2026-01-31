import { MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"

export interface PolicyInput {
  resource: string
  actions: string[]
  effect: "allow" | "deny"
  priority?: number
}

export interface ScopeRuleInput {
  entityType: string
  field: string
  operator: string
  value: string
}

export interface FieldMaskInput {
  entityType: string
  fieldPath: string
  maskType: "hide" | "redact"
  maskConfig?: Record<string, unknown>
}

export interface RoleInput {
  name: string
  description?: string
  policies: PolicyInput[]
  scopeRules?: ScopeRuleInput[]
  fieldMasks?: FieldMaskInput[]
}

export async function syncRoles(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  roles: RoleInput[],
  preserveIds?: Set<string>
): Promise<{ created: string[]; updated: string[]; deleted: string[]; preserved: string[] }> {
  const result = { created: [] as string[], updated: [] as string[], deleted: [] as string[], preserved: [] as string[] }
  const now = Date.now()

  const existingRoles = await ctx.db
    .query("roles")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .collect()

  const nonSystemRoles = existingRoles.filter((r) => !r.isSystem)
  const existingByName = new Map(nonSystemRoles.map((r) => [r.name, r]))
  const inputNames = new Set(roles.map((r) => r.name))

  for (const role of roles) {
    const existing = existingByName.get(role.name)

    if (existing) {
      await ctx.db.patch(existing._id, {
        description: role.description,
        updatedAt: now,
      })

      await syncPoliciesForRole(ctx, organizationId, existing._id, role.policies, role.scopeRules || [], role.fieldMasks || [])
      result.updated.push(role.name)
    } else {
      const roleId = await ctx.db.insert("roles", {
        organizationId,
        name: role.name,
        description: role.description,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      })

      await syncPoliciesForRole(ctx, organizationId, roleId, role.policies, role.scopeRules || [], role.fieldMasks || [])
      result.created.push(role.name)
    }
  }

  for (const existing of nonSystemRoles) {
    if (!inputNames.has(existing.name)) {
      if (preserveIds?.has(existing._id.toString())) {
        result.preserved.push(existing.name)
      } else {
        await deleteRoleWithRelations(ctx, existing._id)
        result.deleted.push(existing.name)
      }
    }
  }

  return result
}

async function syncPoliciesForRole(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  roleId: Id<"roles">,
  policies: PolicyInput[],
  scopeRules: ScopeRuleInput[],
  fieldMasks: FieldMaskInput[]
): Promise<void> {
  const now = Date.now()

  const existingPolicies = await ctx.db
    .query("policies")
    .withIndex("by_role", (q) => q.eq("roleId", roleId))
    .collect()

  for (const policy of existingPolicies) {
    const scopeRulesForPolicy = await ctx.db
      .query("scopeRules")
      .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
      .collect()

    for (const sr of scopeRulesForPolicy) {
      await ctx.db.delete(sr._id)
    }

    const fieldMasksForPolicy = await ctx.db
      .query("fieldMasks")
      .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
      .collect()

    for (const fm of fieldMasksForPolicy) {
      await ctx.db.delete(fm._id)
    }

    await ctx.db.delete(policy._id)
  }

  const scopeRulesByResource = new Map<string, ScopeRuleInput[]>()
  for (const sr of scopeRules) {
    const key = sr.entityType
    if (!scopeRulesByResource.has(key)) {
      scopeRulesByResource.set(key, [])
    }
    scopeRulesByResource.get(key)!.push(sr)
  }

  const fieldMasksByResource = new Map<string, FieldMaskInput[]>()
  for (const fm of fieldMasks) {
    const key = fm.entityType
    if (!fieldMasksByResource.has(key)) {
      fieldMasksByResource.set(key, [])
    }
    fieldMasksByResource.get(key)!.push(fm)
  }

  for (const policy of policies) {
    for (const action of policy.actions) {
      const policyId = await ctx.db.insert("policies", {
        organizationId,
        roleId,
        resource: policy.resource,
        action,
        effect: policy.effect,
        priority: policy.priority ?? 50,
        createdAt: now,
      })

      const relatedScopeRules = scopeRulesByResource.get(policy.resource) || []
      for (const sr of relatedScopeRules) {
        await ctx.db.insert("scopeRules", {
          policyId,
          type: "field",
          field: sr.field,
          operator: sr.operator,
          value: sr.value,
          createdAt: now,
        })
      }

      const relatedFieldMasks = fieldMasksByResource.get(policy.resource) || []
      for (const fm of relatedFieldMasks) {
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

async function deleteRoleWithRelations(
  ctx: MutationCtx,
  roleId: Id<"roles">
): Promise<void> {
  const policies = await ctx.db
    .query("policies")
    .withIndex("by_role", (q) => q.eq("roleId", roleId))
    .collect()

  for (const policy of policies) {
    const scopeRules = await ctx.db
      .query("scopeRules")
      .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
      .collect()

    for (const sr of scopeRules) {
      await ctx.db.delete(sr._id)
    }

    const fieldMasks = await ctx.db
      .query("fieldMasks")
      .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
      .collect()

    for (const fm of fieldMasks) {
      await ctx.db.delete(fm._id)
    }

    await ctx.db.delete(policy._id)
  }

  const userRoles = await ctx.db
    .query("userRoles")
    .withIndex("by_role", (q) => q.eq("roleId", roleId))
    .collect()

  for (const ur of userRoles) {
    await ctx.db.delete(ur._id)
  }

  await ctx.db.delete(roleId)
}

export async function getRoleNames(
  ctx: MutationCtx,
  organizationId: Id<"organizations">
): Promise<string[]> {
  const roles = await ctx.db
    .query("roles")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("isSystem"), false))
    .collect()

  return roles.map((r) => r.name)
}
