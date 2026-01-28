import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { PlatformError } from '@struere/platform-shared'
import { authRoutes } from './routes/auth'
import { authClerkRoutes } from './routes/auth-clerk'
import { agentRoutes } from './routes/agents'
import { apiKeyRoutes } from './routes/api-keys'
import { deploymentRoutes } from './routes/deployments'
import { usageRoutes } from './routes/usage'
import { debugRoutes } from './routes/debug'
import type { Env } from './types'

const api = new Hono<{ Bindings: Env }>()

api.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*'
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return origin
    if (origin.endsWith('.struere.dev') || origin === 'https://struere.dev') return origin
    return null
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length']
}))

api.get('/health', (c) => c.json({ status: 'ok', service: 'api' }))

api.route('/v1/auth', authRoutes)
api.route('/v1/auth/clerk', authClerkRoutes)
api.route('/v1/agents', agentRoutes)
api.route('/v1/api-keys', apiKeyRoutes)
api.route('/v1', deploymentRoutes)
api.route('/v1/usage', usageRoutes)
api.route('/debug', debugRoutes)

api.onError((err, c) => {
  if (err instanceof PlatformError) {
    return c.json(err.toJSON(), err.statusCode as 400)
  }
  console.error('API error:', err)
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
})

api.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))

export { api }
