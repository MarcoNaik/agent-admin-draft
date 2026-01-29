import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  generateId,
  createAgentSchema,
  updateAgentSchema
} from '../index'
import { createDb, agents, agentVersions, deployments } from '../db'
import type { MiddlewareHandler } from 'hono'

export interface AuthContext {
  clerkUserId?: string
  userId: string
  organizationId: string
  email: string
}

export interface RouteEnv {
  DB: D1Database
}

export function createAgentRoutes<E extends RouteEnv>(authMiddleware: MiddlewareHandler) {
  const agentRoutes = new Hono<{
    Bindings: E
    Variables: { auth: AuthContext }
  }>()

  agentRoutes.use('*', authMiddleware)

  agentRoutes.get('/', async (c) => {
    const auth = c.get('auth')
    const db = createDb(c.env.DB)

    const agentList = await db
      .select()
      .from(agents)
      .where(and(
        eq(agents.organizationId, auth.organizationId),
        eq(agents.status, 'active')
      ))
      .orderBy(desc(agents.updatedAt))

    const agentsWithEnvironments = await Promise.all(
      agentList.map(async (agent) => {
        const [devVersion, prodVersion, devDeployment, prodDeployment] = await Promise.all([
          agent.developmentVersionId
            ? db.select().from(agentVersions).where(eq(agentVersions.id, agent.developmentVersionId)).limit(1)
            : Promise.resolve([]),
          agent.productionVersionId
            ? db.select().from(agentVersions).where(eq(agentVersions.id, agent.productionVersionId)).limit(1)
            : Promise.resolve([]),
          db.select().from(deployments).where(and(eq(deployments.agentId, agent.id), eq(deployments.environment, 'development'), eq(deployments.status, 'active'))).orderBy(desc(deployments.createdAt)).limit(1),
          db.select().from(deployments).where(and(eq(deployments.agentId, agent.id), eq(deployments.environment, 'production'), eq(deployments.status, 'active'))).orderBy(desc(deployments.createdAt)).limit(1)
        ])

        return {
          ...agent,
          environments: {
            development: devVersion[0] && devDeployment[0] ? {
              versionId: devVersion[0].id,
              version: devVersion[0].version,
              url: devDeployment[0].url,
              deployedAt: devVersion[0].deployedAt
            } : null,
            production: prodVersion[0] && prodDeployment[0] ? {
              versionId: prodVersion[0].id,
              version: prodVersion[0].version,
              url: prodDeployment[0].url,
              deployedAt: prodVersion[0].deployedAt
            } : null
          }
        }
      })
    )

    return c.json({ agents: agentsWithEnvironments })
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

    const [versions, devDeployment, prodDeployment] = await Promise.all([
      db.select().from(agentVersions).where(eq(agentVersions.agentId, agentId)).orderBy(desc(agentVersions.deployedAt)).limit(10),
      db.select().from(deployments).where(and(eq(deployments.agentId, agentId), eq(deployments.environment, 'development'), eq(deployments.status, 'active'))).orderBy(desc(deployments.createdAt)).limit(1),
      db.select().from(deployments).where(and(eq(deployments.agentId, agentId), eq(deployments.environment, 'production'), eq(deployments.status, 'active'))).orderBy(desc(deployments.createdAt)).limit(1)
    ])

    const devVersion = agent.developmentVersionId ? versions.find(v => v.id === agent.developmentVersionId) : null
    const prodVersion = agent.productionVersionId ? versions.find(v => v.id === agent.productionVersionId) : null

    const agentWithEnvironments = {
      ...agent,
      environments: {
        development: devVersion && devDeployment[0] ? {
          versionId: devVersion.id,
          version: devVersion.version,
          url: devDeployment[0].url,
          deployedAt: devVersion.deployedAt
        } : null,
        production: prodVersion && prodDeployment[0] ? {
          versionId: prodVersion.id,
          version: prodVersion.version,
          url: prodDeployment[0].url,
          deployedAt: prodVersion.deployedAt
        } : null
      }
    }

    return c.json({ agent: agentWithEnvironments, versions })
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

  return agentRoutes
}
