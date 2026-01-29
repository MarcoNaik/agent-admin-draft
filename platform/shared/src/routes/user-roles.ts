import { Hono } from 'hono'
import { eq, and, desc, or, isNull, gt } from 'drizzle-orm'
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  generateId
} from '../index'
import { createDb, users, roles, userRoles } from '../db'
import type { MiddlewareHandler } from 'hono'
import type { AuthContext, RouteEnv } from './agents'

export function createUserRoleRoutes<E extends RouteEnv>(authMiddleware: MiddlewareHandler) {
  const routes = new Hono<{
    Bindings: E
    Variables: { auth: AuthContext }
  }>()

  routes.use('*', authMiddleware)

  routes.get('/', async (c) => {
    const auth = c.get('auth')
    const userId = c.req.query('userId')
    const roleId = c.req.query('roleId')
    const includeExpired = c.req.query('includeExpired') === 'true'
    const db = createDb(c.env.DB)

    const now = new Date()
    const conditions = []

    if (userId) {
      conditions.push(eq(userRoles.userId, userId))
    }

    if (roleId) {
      conditions.push(eq(userRoles.roleId, roleId))
    }

    if (!includeExpired) {
      conditions.push(or(
        isNull(userRoles.expiresAt),
        gt(userRoles.expiresAt, now)
      ))
    }

    const assignmentList = await db
      .select({
        userRole: userRoles,
        userName: users.name,
        userEmail: users.email,
        roleName: roles.name,
        roleDescription: roles.description
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(conditions.length > 0 ? and(...conditions) : eq(roles.organizationId, auth.organizationId))
      .orderBy(desc(userRoles.createdAt))

    const filteredAssignments = assignmentList.filter(a => {
      return a.roleName !== undefined
    })

    return c.json({
      assignments: filteredAssignments.map(a => ({
        id: a.userRole.id,
        userId: a.userRole.userId,
        roleId: a.userRole.roleId,
        resourceType: a.userRole.resourceType,
        resourceId: a.userRole.resourceId,
        grantedBy: a.userRole.grantedBy,
        expiresAt: a.userRole.expiresAt,
        createdAt: a.userRole.createdAt,
        user: {
          name: a.userName,
          email: a.userEmail
        },
        role: {
          name: a.roleName,
          description: a.roleDescription
        }
      }))
    })
  })

  routes.post('/', async (c) => {
    const auth = c.get('auth')
    const body = await c.req.json()
    const db = createDb(c.env.DB)

    if (!body.userId || typeof body.userId !== 'string') {
      throw new ValidationError('userId is required')
    }

    if (!body.roleId || typeof body.roleId !== 'string') {
      throw new ValidationError('roleId is required')
    }

    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, body.userId),
        eq(users.organizationId, auth.organizationId)
      ))
      .limit(1)

    if (!user) {
      throw new NotFoundError('User', body.userId)
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

    const resourceType = body.resourceType || null
    const resourceId = body.resourceId || null

    const existingConditions = [
      eq(userRoles.userId, body.userId),
      eq(userRoles.roleId, body.roleId)
    ]

    if (resourceType) {
      existingConditions.push(eq(userRoles.resourceType, resourceType))
    } else {
      existingConditions.push(isNull(userRoles.resourceType))
    }

    if (resourceId) {
      existingConditions.push(eq(userRoles.resourceId, resourceId))
    } else {
      existingConditions.push(isNull(userRoles.resourceId))
    }

    const [existing] = await db
      .select()
      .from(userRoles)
      .where(and(...existingConditions))
      .limit(1)

    if (existing) {
      throw new ConflictError('User role assignment already exists')
    }

    let expiresAt: Date | null = null
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt)
      if (isNaN(expiresAt.getTime())) {
        throw new ValidationError('Invalid expiresAt date')
      }
    }

    const now = new Date()
    const userRoleId = generateId('urol')

    await db.insert(userRoles).values({
      id: userRoleId,
      userId: body.userId,
      roleId: body.roleId,
      resourceType,
      resourceId,
      grantedBy: auth.userId,
      expiresAt,
      createdAt: now
    })

    const [userRole] = await db
      .select({
        userRole: userRoles,
        userName: users.name,
        userEmail: users.email,
        roleName: roles.name,
        roleDescription: roles.description
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.id, userRoleId))

    return c.json({
      assignment: {
        id: userRole.userRole.id,
        userId: userRole.userRole.userId,
        roleId: userRole.userRole.roleId,
        resourceType: userRole.userRole.resourceType,
        resourceId: userRole.userRole.resourceId,
        grantedBy: userRole.userRole.grantedBy,
        expiresAt: userRole.userRole.expiresAt,
        createdAt: userRole.userRole.createdAt,
        user: {
          name: userRole.userName,
          email: userRole.userEmail
        },
        role: {
          name: userRole.roleName,
          description: userRole.roleDescription
        }
      }
    }, 201)
  })

  routes.get('/:id', async (c) => {
    const auth = c.get('auth')
    const assignmentId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [result] = await db
      .select({
        userRole: userRoles,
        userName: users.name,
        userEmail: users.email,
        roleName: roles.name,
        roleDescription: roles.description,
        roleOrgId: roles.organizationId
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.id, assignmentId))
      .limit(1)

    if (!result || result.roleOrgId !== auth.organizationId) {
      throw new NotFoundError('User role assignment', assignmentId)
    }

    return c.json({
      assignment: {
        id: result.userRole.id,
        userId: result.userRole.userId,
        roleId: result.userRole.roleId,
        resourceType: result.userRole.resourceType,
        resourceId: result.userRole.resourceId,
        grantedBy: result.userRole.grantedBy,
        expiresAt: result.userRole.expiresAt,
        createdAt: result.userRole.createdAt,
        user: {
          name: result.userName,
          email: result.userEmail
        },
        role: {
          name: result.roleName,
          description: result.roleDescription
        }
      }
    })
  })

  routes.delete('/:id', async (c) => {
    const auth = c.get('auth')
    const assignmentId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [result] = await db
      .select({
        userRole: userRoles,
        roleOrgId: roles.organizationId
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.id, assignmentId))
      .limit(1)

    if (!result || result.roleOrgId !== auth.organizationId) {
      throw new NotFoundError('User role assignment', assignmentId)
    }

    await db.delete(userRoles).where(eq(userRoles.id, assignmentId))

    return c.json({ success: true })
  })

  return routes
}
