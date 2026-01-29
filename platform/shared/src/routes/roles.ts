import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  AuthorizationError,
  generateId
} from '../index'
import { createDb, roles, policies, scopeRules, fieldMasks } from '../db'
import type { MiddlewareHandler } from 'hono'
import type { AuthContext, RouteEnv } from './agents'

export function createRoleRoutes<E extends RouteEnv>(authMiddleware: MiddlewareHandler) {
  const routes = new Hono<{
    Bindings: E
    Variables: { auth: AuthContext }
  }>()

  routes.use('*', authMiddleware)

  routes.get('/', async (c) => {
    const auth = c.get('auth')
    const db = createDb(c.env.DB)

    const roleList = await db
      .select()
      .from(roles)
      .where(eq(roles.organizationId, auth.organizationId))
      .orderBy(desc(roles.createdAt))

    return c.json({ roles: roleList })
  })

  routes.post('/', async (c) => {
    const auth = c.get('auth')
    const body = await c.req.json()

    if (!body.name || typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 100) {
      throw new ValidationError('Name is required and must be 1-100 characters')
    }

    const db = createDb(c.env.DB)

    const existing = await db
      .select()
      .from(roles)
      .where(and(
        eq(roles.organizationId, auth.organizationId),
        eq(roles.name, body.name)
      ))
      .limit(1)

    if (existing.length > 0) {
      throw new ConflictError(`Role with name '${body.name}' already exists`)
    }

    const now = new Date()
    const roleId = generateId('role')

    await db.insert(roles).values({
      id: roleId,
      organizationId: auth.organizationId,
      name: body.name,
      description: body.description || null,
      isSystem: false,
      createdAt: now,
      updatedAt: now
    })

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))

    return c.json({ role }, 201)
  })

  routes.get('/:id', async (c) => {
    const auth = c.get('auth')
    const roleId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [role] = await db
      .select()
      .from(roles)
      .where(and(
        eq(roles.id, roleId),
        eq(roles.organizationId, auth.organizationId)
      ))
      .limit(1)

    if (!role) {
      throw new NotFoundError('Role', roleId)
    }

    const policyList = await db
      .select()
      .from(policies)
      .where(eq(policies.roleId, roleId))
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

    return c.json({ role, policies: policiesWithDetails })
  })

  routes.patch('/:id', async (c) => {
    const auth = c.get('auth')
    const roleId = c.req.param('id')
    const body = await c.req.json()
    const db = createDb(c.env.DB)

    const [existing] = await db
      .select()
      .from(roles)
      .where(and(
        eq(roles.id, roleId),
        eq(roles.organizationId, auth.organizationId)
      ))
      .limit(1)

    if (!existing) {
      throw new NotFoundError('Role', roleId)
    }

    if (existing.isSystem) {
      throw new AuthorizationError('Cannot modify system roles')
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 100) {
        throw new ValidationError('Name must be 1-100 characters')
      }

      if (body.name !== existing.name) {
        const duplicate = await db
          .select()
          .from(roles)
          .where(and(
            eq(roles.organizationId, auth.organizationId),
            eq(roles.name, body.name)
          ))
          .limit(1)

        if (duplicate.length > 0) {
          throw new ConflictError(`Role with name '${body.name}' already exists`)
        }
      }

      updates.name = body.name
    }

    if (body.description !== undefined) {
      updates.description = body.description
    }

    await db
      .update(roles)
      .set(updates)
      .where(eq(roles.id, roleId))

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))

    return c.json({ role })
  })

  routes.delete('/:id', async (c) => {
    const auth = c.get('auth')
    const roleId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [existing] = await db
      .select()
      .from(roles)
      .where(and(
        eq(roles.id, roleId),
        eq(roles.organizationId, auth.organizationId)
      ))
      .limit(1)

    if (!existing) {
      throw new NotFoundError('Role', roleId)
    }

    if (existing.isSystem) {
      throw new AuthorizationError('Cannot delete system roles')
    }

    const rolePolicies = await db
      .select()
      .from(policies)
      .where(eq(policies.roleId, roleId))

    for (const policy of rolePolicies) {
      await db.delete(scopeRules).where(eq(scopeRules.policyId, policy.id))
      await db.delete(fieldMasks).where(eq(fieldMasks.policyId, policy.id))
    }

    await db.delete(policies).where(eq(policies.roleId, roleId))
    await db.delete(roles).where(eq(roles.id, roleId))

    return c.json({ success: true })
  })

  return routes
}
