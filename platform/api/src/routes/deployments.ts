import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import {
  ValidationError,
  NotFoundError,
  generateId,
  hashBundle,
  deployAgentSchema
} from '@struere/platform-shared'
import { createDb, agents, agentVersions, deployments } from '../db'
import { clerkAuth } from '../middleware/clerk'
import type { Env, AuthContext } from '../types'

export const deploymentRoutes = new Hono<{
  Bindings: Env
  Variables: { auth: AuthContext }
}>()

deploymentRoutes.post('/agents/:agentId/deploy', clerkAuth, async (c) => {
  const auth = c.get('auth')
  const agentId = c.req.param('agentId')
  const body = await c.req.json()
  const parsed = deployAgentSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
  }

  const { bundle, version, environment, metadata } = parsed.data
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

  const bundleKey = `${auth.organizationId}/${agent.slug}/${version}.js`
  await c.env.BUNDLES.put(bundleKey, bundle, {
    httpMetadata: { contentType: 'application/javascript' }
  })

  const versionId = generateId('ver')
  const deploymentId = generateId('dpl')
  const now = new Date()
  const configHash = await hashBundle(bundle)

  await db.insert(agentVersions).values({
    id: versionId,
    agentId,
    version,
    bundleKey,
    configHash,
    metadata,
    status: 'active',
    deployedAt: now,
    deployedBy: auth.userId
  })

  const baseUrl = c.env.ENVIRONMENT === 'production'
    ? 'struere.dev'
    : 'staging.struere.dev'

  const deploymentUrl = environment === 'development'
    ? `https://${agent.slug}-dev.${baseUrl}`
    : `https://${agent.slug}.${baseUrl}`

  await db.insert(deployments).values({
    id: deploymentId,
    agentId,
    versionId,
    environment,
    url: deploymentUrl,
    status: 'active',
    createdAt: now
  })

  const versionUpdate = environment === 'development'
    ? { developmentVersionId: versionId, updatedAt: now }
    : { productionVersionId: versionId, updatedAt: now }

  await db
    .update(agents)
    .set(versionUpdate)
    .where(eq(agents.id, agentId))

  return c.json({
    deployment: {
      id: deploymentId,
      agentId,
      versionId,
      version,
      environment,
      url: deploymentUrl,
      status: 'active'
    }
  }, 201)
})

deploymentRoutes.get('/agents/:agentId/deployments', clerkAuth, async (c) => {
  const auth = c.get('auth')
  const agentId = c.req.param('agentId')
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

  const result = await db
    .select()
    .from(deployments)
    .where(eq(deployments.agentId, agentId))
    .orderBy(desc(deployments.createdAt))
    .limit(20)

  return c.json({ deployments: result })
})

deploymentRoutes.post('/agents/:agentId/rollback', clerkAuth, async (c) => {
  const auth = c.get('auth')
  const agentId = c.req.param('agentId')
  const { versionId, environment = 'production' } = await c.req.json() as { versionId: string; environment?: 'development' | 'production' }
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

  const [version] = await db
    .select()
    .from(agentVersions)
    .where(and(
      eq(agentVersions.id, versionId),
      eq(agentVersions.agentId, agentId)
    ))
    .limit(1)

  if (!version) {
    throw new NotFoundError('Version', versionId)
  }

  const currentVersionId = environment === 'development'
    ? agent.developmentVersionId
    : agent.productionVersionId

  if (currentVersionId) {
    await db
      .update(agentVersions)
      .set({ status: 'rolled_back' })
      .where(eq(agentVersions.id, currentVersionId))
  }

  const versionUpdate = environment === 'development'
    ? { developmentVersionId: versionId, updatedAt: new Date() }
    : { productionVersionId: versionId, updatedAt: new Date() }

  await db
    .update(agents)
    .set(versionUpdate)
    .where(eq(agents.id, agentId))

  return c.json({ success: true, versionId, environment })
})
