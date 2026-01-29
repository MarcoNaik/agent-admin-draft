import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { PlatformError, createAgentRoutes, createApiKeyRoutes, createUsageRoutes, createEntityTypeRoutes, createEntityRoutes, createEventRoutes, createRoleRoutes, createPolicyRoutes, createUserRoleRoutes, createJobRoutes } from '@struere/platform-shared'
import { authRoutes } from './routes/auth'
import { authClerkRoutes } from './routes/auth-clerk'
import { deploymentRoutes } from './routes/deployments'
import { configRoutes } from './routes/config'
import { debugRoutes } from './routes/debug'
import { statusRoutes } from './routes/status'
import { createPackRoutes } from './routes/packs'
import { clerkAuth } from './middleware/clerk'
import type { Env } from './types'

const agentRoutes = createAgentRoutes<Env>(clerkAuth)
const apiKeyRoutes = createApiKeyRoutes<Env>(clerkAuth)
const usageRoutes = createUsageRoutes<Env>(clerkAuth)
const entityTypeRoutes = createEntityTypeRoutes<Env>(clerkAuth)
const entityRoutes = createEntityRoutes<Env>(clerkAuth)
const eventRoutes = createEventRoutes<Env>(clerkAuth)
const roleRoutes = createRoleRoutes<Env>(clerkAuth)
const policyRoutes = createPolicyRoutes<Env>(clerkAuth)
const userRoleRoutes = createUserRoleRoutes<Env>(clerkAuth)
const jobRoutes = createJobRoutes<Env>(clerkAuth)
const packRoutes = createPackRoutes<Env>(clerkAuth)

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

app.get('/v1/status', async (c) => {
  const { createRemoteJWKSet, jwtVerify, decodeJwt, decodeProtectedHeader } = await import('jose')

  const CLERK_DOMAIN = 'clerk.struere.dev'
  const JWKS_URL = `https://${CLERK_DOMAIN}/.well-known/jwks.json`
  const EXPECTED_ISSUER = `https://${CLERK_DOMAIN}`

  const results: Array<{ name: string; status: string; message: string; data?: unknown; duration?: number }> = []
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  results.push({
    name: 'env_clerk_secret_key',
    status: c.env.CLERK_SECRET_KEY ? 'pass' : 'fail',
    message: c.env.CLERK_SECRET_KEY ? 'CLERK_SECRET_KEY is set' : 'CLERK_SECRET_KEY is missing',
    data: c.env.CLERK_SECRET_KEY ? `${c.env.CLERK_SECRET_KEY.slice(0, 10)}...` : null
  })

  results.push({
    name: 'env_clerk_publishable_key',
    status: c.env.CLERK_PUBLISHABLE_KEY ? 'pass' : 'fail',
    message: c.env.CLERK_PUBLISHABLE_KEY ? 'CLERK_PUBLISHABLE_KEY is set' : 'CLERK_PUBLISHABLE_KEY is missing',
    data: c.env.CLERK_PUBLISHABLE_KEY || null
  })

  let jwksData: { keys: Array<{ kid: string; kty: string; alg: string }> } | null = null
  const jwksFetchStart = Date.now()
  try {
    const response = await fetch(JWKS_URL, { headers: { 'User-Agent': 'struere-api/1.0' } })
    const jwksFetchDuration = Date.now() - jwksFetchStart
    if (response.ok) {
      const text = await response.text()
      try {
        jwksData = JSON.parse(text)
        results.push({ name: 'jwks_fetch', status: 'pass', message: `Fetched JWKS from ${JWKS_URL}`, data: { status: response.status, keyCount: jwksData?.keys?.length }, duration: jwksFetchDuration })
      } catch {
        results.push({ name: 'jwks_fetch', status: 'fail', message: 'JWKS not valid JSON', data: { body: text.slice(0, 200) }, duration: jwksFetchDuration })
      }
    } else {
      results.push({ name: 'jwks_fetch', status: 'fail', message: `HTTP ${response.status}`, data: { status: response.status }, duration: jwksFetchDuration })
    }
  } catch (err) {
    results.push({ name: 'jwks_fetch', status: 'fail', message: `Network error: ${err}`, duration: Date.now() - jwksFetchStart })
  }

  if (!token) {
    results.push({ name: 'token_present', status: 'skip', message: 'No Authorization Bearer token' })
    return c.json({ tests: results, summary: { passed: results.filter(r => r.status === 'pass').length, failed: results.filter(r => r.status === 'fail').length }, config: { CLERK_DOMAIN, JWKS_URL, EXPECTED_ISSUER } })
  }

  results.push({ name: 'token_present', status: 'pass', message: 'Token provided', data: { length: token.length, preview: `${token.slice(0, 20)}...` } })

  try {
    const header = decodeProtectedHeader(token)
    results.push({ name: 'token_header', status: 'pass', message: 'Decoded header', data: header })
  } catch (err) {
    results.push({ name: 'token_header', status: 'fail', message: `${err}` })
  }

  try {
    const payload = decodeJwt(token)
    results.push({ name: 'token_payload', status: 'pass', message: 'Decoded payload', data: { iss: payload.iss, sub: payload.sub, azp: payload.azp, exp: payload.exp, expDate: payload.exp ? new Date(payload.exp * 1000).toISOString() : null } })

    const issuerMatch = payload.iss === EXPECTED_ISSUER
    results.push({ name: 'issuer_match', status: issuerMatch ? 'pass' : 'fail', message: issuerMatch ? 'Issuer matches' : `Issuer mismatch: ${payload.iss} vs ${EXPECTED_ISSUER}`, data: { actual: payload.iss, expected: EXPECTED_ISSUER } })

    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000)
      const expired = payload.exp < now
      results.push({ name: 'token_expiry', status: expired ? 'fail' : 'pass', message: expired ? `Expired ${now - payload.exp}s ago` : `Expires in ${payload.exp - now}s` })
    }
  } catch (err) {
    results.push({ name: 'token_payload', status: 'fail', message: `${err}` })
  }

  const verifyStart = Date.now()
  try {
    const JWKS = createRemoteJWKSet(new URL(JWKS_URL))
    const { payload } = await jwtVerify(token, JWKS, { issuer: EXPECTED_ISSUER, clockTolerance: 60 })
    results.push({ name: 'jose_verify', status: 'pass', message: 'JWT verified with jose', data: { sub: payload.sub }, duration: Date.now() - verifyStart })
  } catch (err) {
    results.push({ name: 'jose_verify', status: 'fail', message: `${err}`, duration: Date.now() - verifyStart })
  }

  const verifyNoIssuerStart = Date.now()
  try {
    const JWKS = createRemoteJWKSet(new URL(JWKS_URL))
    const { payload } = await jwtVerify(token, JWKS, { clockTolerance: 60 })
    results.push({ name: 'jose_verify_no_issuer', status: 'pass', message: 'JWT verified without issuer check', data: { sub: payload.sub, iss: payload.iss }, duration: Date.now() - verifyNoIssuerStart })
  } catch (err) {
    results.push({ name: 'jose_verify_no_issuer', status: 'fail', message: `${err}`, duration: Date.now() - verifyNoIssuerStart })
  }

  return c.json({
    tests: results,
    summary: { passed: results.filter(r => r.status === 'pass').length, failed: results.filter(r => r.status === 'fail').length },
    config: { CLERK_DOMAIN, JWKS_URL, EXPECTED_ISSUER }
  })
})

app.route('/v1/debug', debugRoutes)
app.route('/v1/auth', authRoutes)
app.route('/v1/auth/clerk', authClerkRoutes)
app.route('/v1/agents/:agentId/config', configRoutes)
app.route('/v1/agents', agentRoutes)
app.route('/v1/api-keys', apiKeyRoutes)
app.route('/v1', deploymentRoutes)
app.route('/v1/usage', usageRoutes)
app.route('/v1/entity-types', entityTypeRoutes)
app.route('/v1/entities', entityRoutes)
app.route('/v1/events', eventRoutes)
app.route('/v1/roles', roleRoutes)
app.route('/v1/policies', policyRoutes)
app.route('/v1/user-roles', userRoleRoutes)
app.route('/v1/jobs', jobRoutes)
app.route('/v1/packs', packRoutes)

app.onError((err, c) => {
  if (err instanceof PlatformError) {
    return c.json(err.toJSON(), err.statusCode as 400)
  }
  console.error('Unhandled error:', err)
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
})

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))

export default app
