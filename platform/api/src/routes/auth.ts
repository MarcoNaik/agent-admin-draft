import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import {
  ValidationError,
  ConflictError,
  AuthenticationError,
  generateId,
  hashPassword,
  verifyPassword,
  generateSlug,
  loginSchema,
  createUserSchema
} from '@struere/platform-shared'
import { createDb, users, organizations } from '../db'
import { jwtAuth, createJwt } from '../middleware/auth'
import type { Env, AuthContext } from '../types'

export const authRoutes = new Hono<{
  Bindings: Env
  Variables: { auth: AuthContext }
}>()

authRoutes.post('/signup', async (c) => {
  const body = await c.req.json()
  const parsed = createUserSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
  }

  const { email, name, password } = parsed.data
  const db = createDb(c.env.DB)

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing.length > 0) {
    throw new ConflictError('User with this email already exists')
  }

  const now = new Date()
  const orgId = generateId('org')
  const userId = generateId('usr')
  const orgSlug = generateSlug(name)

  await db.insert(organizations).values({
    id: orgId,
    name: `${name}'s Organization`,
    slug: orgSlug,
    plan: 'free',
    createdAt: now,
    updatedAt: now
  })

  await db.insert(users).values({
    id: userId,
    email,
    name,
    passwordHash: await hashPassword(password),
    organizationId: orgId,
    role: 'owner',
    createdAt: now,
    updatedAt: now
  })

  const token = await createJwt(c.env, {
    sub: userId,
    org: orgId,
    email
  })

  return c.json({
    token,
    user: { id: userId, email, name, organizationId: orgId, role: 'owner' }
  }, 201)
})

authRoutes.post('/login', async (c) => {
  const body = await c.req.json()
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
  }

  const { email, password } = parsed.data
  const db = createDb(c.env.DB)

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AuthenticationError('Invalid email or password')
  }

  const token = await createJwt(c.env, {
    sub: user.id,
    org: user.organizationId,
    email: user.email
  })

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      role: user.role
    }
  })
})

authRoutes.get('/me', jwtAuth, async (c) => {
  const auth = c.get('auth')
  const db = createDb(c.env.DB)

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      organizationId: users.organizationId,
      role: users.role
    })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1)

  if (!user) {
    throw new AuthenticationError('User not found')
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, auth.organizationId))
    .limit(1)

  return c.json({ user, organization: org })
})

authRoutes.post('/refresh', jwtAuth, async (c) => {
  const auth = c.get('auth')

  const token = await createJwt(c.env, {
    sub: auth.userId,
    org: auth.organizationId,
    email: auth.email
  })

  return c.json({ token })
})
