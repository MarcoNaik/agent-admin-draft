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
  environment: "development" | "production"
): Promise<{ created: string[]; updated: string[]; deleted: string[] }> {
  const result = { created: [] as string[], updated: [] as string[], deleted: [] as string[] }
  const now = Date.now()

  const existingRoles = await ctx.db
    .query("roles")
    .withIndex("by_org_env", (q) => q.eq("organizationId", organizationId).eq("environment", environment))
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
        environment,
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
      await deleteRoleWithRelations(ctx, existing._id)
      result.deleted.push(existing.name)
    }
  }

  if (environment === "production") {
    await duplicateUserRolesForProduction(ctx, organizationId, roles)
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

export async function deleteRoleWithRelations(
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

async function duplicateUserRolesForProduction(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  roles: RoleInput[]
): Promise<void> {
  const now = Date.now()

  for (const roleInput of roles) {
    const devRole = await ctx.db
      .query("roles")
      .withIndex("by_org_env_name", (q) =>
        q.eq("organizationId", organizationId).eq("environment", "development").eq("name", roleInput.name)
      )
      .first()

    if (!devRole) continue

    const prodRole = await ctx.db
      .query("roles")
      .withIndex("by_org_env_name", (q) =>
        q.eq("organizationId", organizationId).eq("environment", "production").eq("name", roleInput.name)
      )
      .first()

    if (!prodRole) continue

    const devUserRoles = await ctx.db
      .query("userRoles")
      .withIndex("by_role", (q) => q.eq("roleId", devRole._id))
      .collect()

    for (const devUR of devUserRoles) {
      const existingProdUR = await ctx.db
        .query("userRoles")
        .withIndex("by_user", (q) => q.eq("userId", devUR.userId))
        .filter((q) => q.eq(q.field("roleId"), prodRole._id))
        .first()

      if (!existingProdUR) {
        await ctx.db.insert("userRoles", {
          userId: devUR.userId,
          roleId: prodRole._id,
          resourceType: devUR.resourceType,
          resourceId: devUR.resourceId,
          grantedBy: devUR.grantedBy,
          expiresAt: devUR.expiresAt,
          createdAt: now,
        })
      }
    }
  }
}

export async function getRoleNames(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  environment: "development" | "production"
): Promise<string[]> {
  const roles = await ctx.db
    .query("roles")
    .withIndex("by_org_env", (q) => q.eq("organizationId", organizationId).eq("environment", environment))
    .filter((q) => q.eq(q.field("isSystem"), false))
    .collect()

  return roles.map((r) => r.name)
}
