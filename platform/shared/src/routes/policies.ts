import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import {
  ValidationError,
  NotFoundError,
  generateId
} from '../index'
import { createDb, roles, policies, scopeRules, fieldMasks } from '../db'
import type { MiddlewareHandler } from 'hono'
import type { AuthContext, RouteEnv } from './agents'

const VALID_ACTIONS = ['create', 'read', 'update', 'delete', 'list', '*']
const VALID_EFFECTS = ['allow', 'deny']
const VALID_SCOPE_TYPES = ['field', 'relation']
const VALID_OPERATORS = ['eq', 'neq', 'in', 'nin', 'contains', 'exists', 'gt', 'gte', 'lt', 'lte']
const VALID_MASK_TYPES = ['hide', 'redact']

export function createPolicyRoutes<E extends RouteEnv>(authMiddleware: MiddlewareHandler) {
  const routes = new Hono<{
    Bindings: E
    Variables: { auth: AuthContext }
  }>()

  routes.use('*', authMiddleware)

  routes.get('/', async (c) => {
    const auth = c.get('auth')
    const roleId = c.req.query('roleId')
    const resource = c.req.query('resource')
    const db = createDb(c.env.DB)

    const conditions = [eq(policies.organizationId, auth.organizationId)]

    if (roleId) {
      conditions.push(eq(policies.roleId, roleId))
    }

    if (resource) {
      conditions.push(eq(policies.resource, resource))
    }

    const policyList = await db
      .select()
      .from(policies)
      .where(and(...conditions))
      .orderBy(desc(policies.createdAt))

    const policyIds = policyList.map(p => p.id)

    let scopeRuleList: Array<typeof scopeRules.$inferSelect> = []
    let fieldMaskList: Array<typeof fieldMasks.$inferSelect> = []

    if (policyIds.length > 0) {
      const scopeRulesResult = await Promise.all(
        policyIds.map(id => db.select().from(scopeRules).where(eq(scopeRules.policyId, id)))
      )
      scopeRuleList = scopeRulesResult.flat()

      const fieldMasksResult = await Promise.all(
        policyIds.map(id => db.select().from(fieldMasks).where(eq(fieldMasks.policyId, id)))
      )
      fieldMaskList = fieldMasksResult.flat()
    }

    const policiesWithDetails = policyList.map(policy => ({
      ...policy,
      scopeRules: scopeRuleList.filter(s => s.policyId === policy.id),
      fieldMasks: fieldMaskList.filter(m => m.policyId === policy.id)
    }))

    return c.json({ policies: policiesWithDetails })
  })

  routes.post('/', async (c) => {
    const auth = c.get('auth')
    const body = await c.req.json()
    const db = createDb(c.env.DB)

    if (!body.roleId || typeof body.roleId !== 'string') {
      throw new ValidationError('roleId is required')
    }

    if (!body.resource || typeof body.resource !== 'string') {
      throw new ValidationError('resource is required')
    }

    if (!body.action || !VALID_ACTIONS.includes(body.action)) {
      throw new ValidationError(`action must be one of: ${VALID_ACTIONS.join(', ')}`)
    }

    const effect = body.effect || 'allow'
    if (!VALID_EFFECTS.includes(effect)) {
      throw new ValidationError(`effect must be one of: ${VALID_EFFECTS.join(', ')}`)
    }

    const [role] = await db
      .select()
      .from(roles)
      .where(and(
        eq(roles.id, body.roleId),
        eq(roles.organizationId, auth.organizationId)
      ))
      .limit(1)

    if (!role) {
      throw new NotFoundError('Role', body.roleId)
    }

    const now = new Date()
    const policyId = generateId('pol')

    await db.insert(policies).values({
      id: policyId,
      organizationId: auth.organizationId,
      roleId: body.roleId,
      resource: body.resource,
      action: body.action,
      effect: effect,
      priority: body.priority || 0,
      createdAt: now
    })

    if (body.scopeRules && Array.isArray(body.scopeRules)) {
      for (const rule of body.scopeRules) {
        if (!VALID_SCOPE_TYPES.includes(rule.type)) {
          throw new ValidationError(`scopeRule type must be one of: ${VALID_SCOPE_TYPES.join(', ')}`)
        }

        if (rule.type === 'field') {
          if (!rule.field || typeof rule.field !== 'string') {
            throw new ValidationError('field is required for field scope rules')
          }
          if (!rule.operator || !VALID_OPERATORS.includes(rule.operator)) {
            throw new ValidationError(`operator must be one of: ${VALID_OPERATORS.join(', ')}`)
          }
        }

        if (rule.type === 'relation' && !rule.relationPath) {
          throw new ValidationError('relationPath is required for relation scope rules')
        }

        const scopeRuleId = generateId('scp')
        await db.insert(scopeRules).values({
          id: scopeRuleId,
          policyId: policyId,
          type: rule.type,
          field: rule.field || null,
          operator: rule.operator || null,
          value: rule.value !== undefined ? String(rule.value) : null,
          relationPath: rule.relationPath || null,
          createdAt: now
        })
      }
    }

    if (body.fieldMasks && Array.isArray(body.fieldMasks)) {
      for (const mask of body.fieldMasks) {
        if (!mask.fieldPath || typeof mask.fieldPath !== 'string') {
          throw new ValidationError('fieldPath is required for field masks')
        }
        if (!VALID_MASK_TYPES.includes(mask.maskType)) {
          throw new ValidationError(`maskType must be one of: ${VALID_MASK_TYPES.join(', ')}`)
        }

        const fieldMaskId = generateId('fmask')
        await db.insert(fieldMasks).values({
          id: fieldMaskId,
          policyId: policyId,
          fieldPath: mask.fieldPath,
          maskType: mask.maskType,
          maskConfig: mask.maskConfig || null,
          createdAt: now
        })
      }
    }

    const [policy] = await db
      .select()
      .from(policies)
      .where(eq(policies.id, policyId))

    const policyScopeRules = await db
      .select()
      .from(scopeRules)
      .where(eq(scopeRules.policyId, policyId))

    const policyFieldMasks = await db
      .select()
      .from(fieldMasks)
      .where(eq(fieldMasks.policyId, policyId))

    return c.json({
      policy: {
        ...policy,
        scopeRules: policyScopeRules,
        fieldMasks: policyFieldMasks
      }
    }, 201)
  })

  routes.get('/:id', async (c) => {
    const auth = c.get('auth')
    const policyId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [policy] = await db
      .select()
      .from(policies)
      .where(and(
        eq(policies.id, policyId),
        eq(policies.organizationId, auth.organizationId)
      ))
      .limit(1)

    if (!policy) {
      throw new NotFoundError('Policy', policyId)
    }

    const policyScopeRules = await db
      .select()
      .from(scopeRules)
      .where(eq(scopeRules.policyId, policyId))

    const policyFieldMasks = await db
      .select()
      .from(fieldMasks)
      .where(eq(fieldMasks.policyId, policyId))

    return c.json({
      policy: {
        ...policy,
        scopeRules: policyScopeRules,
        fieldMasks: policyFieldMasks
      }
    })
  })

  routes.delete('/:id', async (c) => {
    const auth = c.get('auth')
    const policyId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [existing] = await db
      .select()
      .from(policies)
      .where(and(
        eq(policies.id, policyId),
        eq(policies.organizationId, auth.organizationId)
      ))
      .limit(1)

    if (!existing) {
      throw new NotFoundError('Policy', policyId)
    }

    await db.delete(scopeRules).where(eq(scopeRules.policyId, policyId))
    await db.delete(fieldMasks).where(eq(fieldMasks.policyId, policyId))
    await db.delete(policies).where(eq(policies.id, policyId))

    return c.json({ success: true })
  })

  return routes
}
