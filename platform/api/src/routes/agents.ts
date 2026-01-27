import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  generateId,
  createAgentSchema,
  updateAgentSchema
} from '@struere/platform-shared'
import { createDb, agents, agentVersions } from '../db'
import { jwtAuth } from '../middleware/auth'
import type { Env, AuthContext } from '../types'

export const agentRoutes = new Hono<{
  Bindings: Env
  Variables: { auth: AuthContext }
}>()

agentRoutes.use('*', jwtAuth)

agentRoutes.get('/', async (c) => {
  const auth = c.get('auth')
  const db = createDb(c.env.DB)

  const result = await db
    .select()
    .from(agents)
    .where(and(
      eq(agents.organizationId, auth.organizationId),
      eq(agents.status, 'active')
    ))
    .orderBy(desc(agents.updatedAt))

  return c.json({ agents: result })
})

agentRoutes.post('/', async (c) => {
  const auth = c.get('auth')
  const body = await c.req.json()
  const parsed = createAgentSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
  }

  const { name, slug, description } = parsed.data
  const db = createDb(c.env.DB)

  const existing = await db
    .select()
    .from(agents)
    .where(and(
      eq(agents.organizationId, auth.organizationId),
      eq(agents.slug, slug)
    ))
    .limit(1)

  if (existing.length > 0) {
    throw new ConflictError(`Agent with slug '${slug}' already exists`)
  }

  const now = new Date()
  const agentId = generateId('agt')

  await db.insert(agents).values({
    id: agentId,
    organizationId: auth.organizationId,
    name,
    slug,
    description: description || null,
    status: 'active',
    createdAt: now,
    updatedAt: now
  })

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))

  return c.json({ agent }, 201)
})

agentRoutes.get('/:id', async (c) => {
  const auth = c.get('auth')
  const agentId = c.req.param('id')
  const db = createDb(c.env.DB)

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(
      eq(agents.id, agentId),
      eq(agents.organizationId, auth.organizationId)
    ))
    .limit(1)

  if (!agent) {
    throw new NotFoundError('Agent', agentId)
  }

  const versions = await db
    .select()
    .from(agentVersions)
    .where(eq(agentVersions.agentId, agentId))
    .orderBy(desc(agentVersions.deployedAt))
    .limit(10)

  return c.json({ agent, versions })
})

agentRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth')
  const agentId = c.req.param('id')
  const body = await c.req.json()
  const parsed = updateAgentSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
  }

  const db = createDb(c.env.DB)

  const [existing] = await db
    .select()
    .from(agents)
    .where(and(
      eq(agents.id, agentId),
      eq(agents.organizationId, auth.organizationId)
    ))
    .limit(1)

  if (!existing) {
    throw new NotFoundError('Agent', agentId)
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (parsed.data.name) updates.name = parsed.data.name
  if (parsed.data.description !== undefined) updates.description = parsed.data.description
  if (parsed.data.status) updates.status = parsed.data.status

  await db
    .update(agents)
    .set(updates)
    .where(eq(agents.id, agentId))

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))

  return c.json({ agent })
})

agentRoutes.delete('/:id', async (c) => {
  const auth = c.get('auth')
  const agentId = c.req.param('id')
  const db = createDb(c.env.DB)

  const [existing] = await db
    .select()
    .from(agents)
    .where(and(
      eq(agents.id, agentId),
      eq(agents.organizationId, auth.organizationId)
    ))
    .limit(1)

  if (!existing) {
    throw new NotFoundError('Agent', agentId)
  }

  await db
    .update(agents)
    .set({ status: 'deleted', updatedAt: new Date() })
    .where(eq(agents.id, agentId))

  return c.json({ success: true })
})
