import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { PlatformError } from '@struere/platform-shared'
import { authRoutes } from './routes/auth'
import { authClerkRoutes } from './routes/auth-clerk'
import { agentRoutes } from './routes/agents'
import { apiKeyRoutes } from './routes/api-keys'
import { deploymentRoutes } from './routes/deployments'
import { usageRoutes } from './routes/usage'
import { debugRoutes } from './routes/debug'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return 'http://localhost:3000'
    if (origin.includes('localhost')) return origin
    if (origin.includes('struere.dev')) return origin
    return 'http://localhost:3000'
  },
  credentials: true
}))

app.get('/health', (c) => c.json({ status: 'ok', version: '0.1.0' }))

app.route('/v1/debug', debugRoutes)
app.route('/v1/auth', authRoutes)
app.route('/v1/auth/clerk', authClerkRoutes)
app.route('/v1/agents', agentRoutes)
app.route('/v1/api-keys', apiKeyRoutes)
app.route('/v1/deployments', deploymentRoutes)
app.route('/v1/usage', usageRoutes)

app.onError((err, c) => {
  if (err instanceof PlatformError) {
    return c.json(err.toJSON(), err.statusCode as 400)
  }
  console.error('Unhandled error:', err)
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
})

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))

export default app
