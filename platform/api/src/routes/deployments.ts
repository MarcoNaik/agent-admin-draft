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
import { jwtAuth } from '../middleware/auth'
import type { Env, AuthContext } from '../types'

export const deploymentRoutes = new Hono<{
  Bindings: Env
  Variables: { auth: AuthContext }
}>()

deploymentRoutes.use('*', jwtAuth)

deploymentRoutes.post('/agents/:agentId/deploy', async (c) => {
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

  const deploymentUrl = environment === 'preview'
    ? `https://${agent.slug}-${deploymentId.slice(0, 8)}.${baseUrl}`
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

  await db
    .update(agents)
    .set({ currentVersionId: versionId, updatedAt: now })
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

deploymentRoutes.get('/agents/:agentId/deployments', async (c) => {
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

deploymentRoutes.post('/agents/:agentId/rollback', async (c) => {
  const auth = c.get('auth')
  const agentId = c.req.param('agentId')
  const { versionId } = await c.req.json()
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

  await db
    .update(agentVersions)
    .set({ status: 'rolled_back' })
    .where(eq(agentVersions.id, agent.currentVersionId!))

  await db
    .update(agents)
    .set({ currentVersionId: versionId, updatedAt: new Date() })
    .where(eq(agents.id, agentId))

  return c.json({ success: true, currentVersionId: versionId })
})
