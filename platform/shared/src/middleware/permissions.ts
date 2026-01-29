import { createMiddleware } from 'hono/factory'
import { eq, and, or, isNull, gt } from 'drizzle-orm'
import { AuthorizationError } from '../errors'
import { createDb, roles, policies, scopeRules, fieldMasks, userRoles } from '../db'
import { PermissionEvaluator } from '../permissions/evaluator'
import { FieldMasker } from '../permissions/masking'
import type { ActorContext, ResolvedPolicy, Action, PermissionResult, ScopeRule, FieldMask } from '../permissions/types'

export interface PermissionContext {
  evaluator: PermissionEvaluator
  masker: FieldMasker
  actor: ActorContext
}

export const withPermissions = createMiddleware(async (c, next) => {
  const auth = c.get('auth')
  if (!auth) {
    throw new AuthorizationError('Authentication required for permission evaluation')
  }

  const db = createDb(c.env.DB)
  const now = new Date()

  const userRoleAssignments = await db
    .select({
      userRole: userRoles,
      roleName: roles.name
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(
      eq(userRoles.userId, auth.userId),
      or(
        isNull(userRoles.expiresAt),
        gt(userRoles.expiresAt, now)
      )
    ))

  const roleIds = userRoleAssignments.map(r => r.userRole.roleId)
  const roleNames = userRoleAssignments.map(r => r.roleName)

  const actor: ActorContext = {
    userId: auth.userId,
    organizationId: auth.organizationId,
    roles: roleNames,
    attributes: {}
  }

  let resolvedPolicies: ResolvedPolicy[] = []

  if (roleIds.length > 0) {
    const policyRecords = await db
      .select()
      .from(policies)
      .where(and(
        eq(policies.organizationId, auth.organizationId),
        or(...roleIds.map(id => eq(policies.roleId, id)))
      ))

    const policyIds = policyRecords.map(p => p.id)

    let scopeRuleRecords: Array<typeof scopeRules.$inferSelect> = []
    let fieldMaskRecords: Array<typeof fieldMasks.$inferSelect> = []

    if (policyIds.length > 0) {
      scopeRuleRecords = await db
        .select()
        .from(scopeRules)
        .where(or(...policyIds.map(id => eq(scopeRules.policyId, id))))

      fieldMaskRecords = await db
        .select()
        .from(fieldMasks)
        .where(or(...policyIds.map(id => eq(fieldMasks.policyId, id))))
    }

    resolvedPolicies = policyRecords.map(policy => {
      const policyScopes: ScopeRule[] = scopeRuleRecords
        .filter(s => s.policyId === policy.id)
        .map(s => ({
          id: s.id,
          policyId: s.policyId,
          type: s.type as 'field' | 'relation',
          field: s.field,
          operator: s.operator as ScopeRule['operator'],
          value: s.value,
          relationPath: s.relationPath
        }))

      const policyMasks: FieldMask[] = fieldMaskRecords
        .filter(m => m.policyId === policy.id)
        .map(m => ({
          id: m.id,
          policyId: m.policyId,
          fieldPath: m.fieldPath,
          maskType: m.maskType as 'hide' | 'redact',
          config: m.maskConfig
        }))

      return {
        id: policy.id,
        organizationId: policy.organizationId,
        roleId: policy.roleId,
        resource: policy.resource,
        action: policy.action,
        effect: policy.effect as 'allow' | 'deny',
        priority: policy.priority || 0,
        scopeRules: policyScopes,
        fieldMasks: policyMasks
      }
    })
  }

  const evaluator = new PermissionEvaluator(resolvedPolicies)
  const masker = new FieldMasker()

  const permissionContext: PermissionContext = {
    evaluator,
    masker,
    actor
  }

  c.set('permissions', permissionContext)

  await next()
})

export const requirePermission = (resource: string, action: Action) => {
  return createMiddleware(async (c, next) => {
    const permissions = c.get('permissions') as PermissionContext | undefined

    if (!permissions) {
      throw new AuthorizationError('Permission context not available')
    }

    const result = await permissions.evaluator.evaluate(
      permissions.actor,
      resource,
      action
    )

    if (!result.allowed) {
      throw new AuthorizationError(result.reason)
    }

    c.set('permissionResult', result)

    await next()
  })
}

export function applyFieldMasks<T extends Record<string, unknown>>(
  data: T,
  permissions: PermissionContext,
  permissionResult?: PermissionResult
): T {
  const masks = permissionResult?.fieldMasks || []
  return permissions.masker.mask(data, masks)
}

export function applyFieldMasksArray<T extends Record<string, unknown>>(
  data: T[],
  permissions: PermissionContext,
  permissionResult?: PermissionResult
): T[] {
  const masks = permissionResult?.fieldMasks || []
  return permissions.masker.maskArray(data, masks)
}
