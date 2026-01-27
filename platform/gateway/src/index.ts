import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { PlatformError } from '@struere/platform-shared'
import { chatHandler } from './handlers/chat'
import { devSyncHandler } from './handlers/dev-sync'
import { apiKeyAuth } from './middleware/auth'
import { resolveAgent } from './middleware/resolve'
import { DevSessionDO } from './durable-objects/DevSession'
import type { Env } from './types'

export { DevSessionDO }

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({
  origin: '*',
  credentials: true
}))

app.get('/health', (c) => c.json({ status: 'ok', service: 'gateway' }))

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
