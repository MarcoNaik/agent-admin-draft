import { createMiddleware } from 'hono/factory'
import { NotFoundError } from '@struere/platform-shared'
import type { Env, AgentContext, ApiKeyContext } from '../types'

export const resolveAgent = createMiddleware<{
  Bindings: Env
  Variables: { apiKey: ApiKeyContext; agent: AgentContext }
}>(async (c, next) => {
  const slug = c.req.param('slug')
  const apiKey = c.get('apiKey')

  const agent = await c.env.DB.prepare(`
    SELECT
      a.id,
      a.organization_id,
      a.slug,
      a.current_version_id,
      v.bundle_key
    FROM agents a
    LEFT JOIN agent_versions v ON v.id = a.current_version_id
    WHERE a.slug = ?
      AND a.organization_id = ?
      AND a.status = 'active'
  `).bind(slug, apiKey.organizationId).first<{
    id: string
    organization_id: string
    slug: string
    current_version_id: string | null
    bundle_key: string | null
  }>()

  if (!agent) {
    throw new NotFoundError('Agent', slug)
  }

  if (!agent.current_version_id || !agent.bundle_key) {
    throw new NotFoundError('Agent has no deployed version')
  }

  c.set('agent', {
    agentId: agent.id,
    organizationId: agent.organization_id,
    slug: agent.slug,
    versionId: agent.current_version_id,
    bundleKey: agent.bundle_key
  })

  await next()
})
