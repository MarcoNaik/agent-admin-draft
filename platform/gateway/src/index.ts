import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { PlatformError, generateId, chatRequestSchema } from '@struere/platform-shared'
import { chatHandler } from './handlers/chat'
import { devSyncHandler } from './handlers/dev-sync'
import { apiKeyAuth } from './middleware/auth'
import { resolveAgent } from './middleware/resolve'
import { DevSessionDO } from './durable-objects/DevSession'
import { executeAgent, streamAgent } from './executor'
import type { Env } from './types'

export { DevSessionDO }

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({
  origin: '*',
  credentials: true
}))

app.use('*', async (c, next) => {
  const host = c.req.header('host') || ''

  if (host.endsWith('-dev.struere.dev')) {
    const slug = host.replace('-dev.struere.dev', '')
    c.set('agentSlug', slug)
    c.set('environment', 'development')
    return next()
  }

  if (host.endsWith('.struere.dev') && !host.startsWith('gateway') && !host.startsWith('api')) {
    const slug = host.replace('.struere.dev', '')
    c.set('agentSlug', slug)
    c.set('environment', 'production')
    return next()
  }

  return next()
})

app.get('/health', (c) => c.json({ status: 'ok', service: 'gateway' }))

app.all('*', async (c, next) => {
  const slug = c.get('agentSlug')
  const environment = c.get('environment') as 'development' | 'production' | undefined

  if (!slug || !environment) {
    return next()
  }

  const path = new URL(c.req.url).pathname

  if (path === '/' || path === '') {
    const agent = await c.env.DB.prepare(`
      SELECT a.id, a.name, a.slug, a.development_version_id, a.production_version_id
      FROM agents a
      WHERE a.slug = ? AND a.status = 'active'
    `).bind(slug).first<{ id: string; name: string; slug: string; development_version_id: string | null; production_version_id: string | null }>()

    if (!agent) {
      return c.html(`<html><body><h1>Agent not found</h1><p>No agent with slug "${slug}" exists.</p></body></html>`, 404)
    }

    const versionId = environment === 'development' ? agent.development_version_id : agent.production_version_id

    if (!versionId) {
      return c.html(`<html><body><h1>${agent.name}</h1><p>Not deployed to ${environment} yet.</p><p>Run <code>struere ${environment === 'development' ? 'dev' : 'deploy'}</code> to deploy.</p></body></html>`, 200)
    }

    return c.html(`<html><body><h1>${agent.name}</h1><p>Environment: ${environment}</p><p>POST to /chat to interact with this agent.</p></body></html>`, 200)
  }

  if (path === '/chat' && c.req.method === 'POST') {
    const agent = await c.env.DB.prepare(`
      SELECT a.id, a.name, a.slug, a.organization_id,
        CASE WHEN ? = 'development' THEN a.development_version_id ELSE a.production_version_id END as version_id
      FROM agents a
      WHERE a.slug = ? AND a.status = 'active'
    `).bind(environment, slug).first<{ id: string; name: string; slug: string; organization_id: string; version_id: string | null }>()

    if (!agent || !agent.version_id) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Agent not deployed to this environment' } }, 404)
    }

    const version = await c.env.DB.prepare(`
      SELECT bundle_key FROM agent_versions WHERE id = ?
    `).bind(agent.version_id).first<{ bundle_key: string }>()

    if (!version) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Agent version not found' } }, 404)
    }

    const bundle = await c.env.BUNDLES.get(version.bundle_key)
    if (!bundle) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Agent bundle not found' } }, 404)
    }

    const bundleCode = await bundle.text()
    const body = await c.req.json()
    const parsed = chatRequestSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } }, 400)
    }

    const { message, conversationId, userId, stream, metadata } = parsed.data
    const convId = conversationId || generateId('conv')

    const agentContext = {
      agentId: agent.id,
      versionId: agent.version_id,
      bundleKey: version.bundle_key,
      organizationId: agent.organization_id
    }

    if (stream) {
      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      const encoder = new TextEncoder()

      streamAgent({
        bundleCode,
        message,
        conversationId: convId,
        userId,
        metadata,
        env: c.env,
        agent: agentContext,
        onChunk: async (chunk) => {
          await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        },
        onComplete: async () => {
          await writer.close()
        },
        onError: async (error) => {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`))
          await writer.close()
        }
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    }

    const result = await executeAgent({
      bundleCode,
      message,
      conversationId: convId,
      userId,
      metadata,
      env: c.env,
      agent: agentContext
    })

    return c.json({
      id: generateId('msg'),
      conversationId: convId,
      content: result.content,
      toolCalls: result.toolCalls,
      usage: result.usage,
      finishReason: result.finishReason
    })
  }

  return c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404)
})

app.post('/v1/agents/:slug/chat', apiKeyAuth, resolveAgent, chatHandler)

app.get('/v1/dev/sync', (c) => {
  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426)
  }

  const sessionId = c.req.query('session') || crypto.randomUUID()
  const id = c.env.DEV_SESSIONS.idFromName(sessionId)
  const stub = c.env.DEV_SESSIONS.get(id)

  return stub.fetch(c.req.raw)
})

app.post('/v1/dev/:sessionId/chat', devSyncHandler)

app.onError((err, c) => {
  if (err instanceof PlatformError) {
    return c.json(err.toJSON(), err.statusCode as 400)
  }
  console.error('Gateway error:', err)
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
})

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))

export default app
