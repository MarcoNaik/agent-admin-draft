import { Hono } from 'hono'
import { verifyToken } from '@clerk/backend'
import { createDb, users, organizations } from '../db'
import { eq } from 'drizzle-orm'
import type { Env } from '../types'

export const debugRoutes = new Hono<{ Bindings: Env }>()

debugRoutes.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasClerkSecretKey: !!c.env.CLERK_SECRET_KEY,
      hasClerkPublishableKey: !!c.env.CLERK_PUBLISHABLE_KEY,
      hasJwtSecret: !!c.env.JWT_SECRET,
      hasDb: !!c.env.DB,
      environment: c.env.ENVIRONMENT
    }
  })
})

debugRoutes.post('/verify-token', async (c) => {
  const steps: Array<{ step: string; value: unknown }> = []
  const results: { timestamp: string; steps: typeof steps; error?: string; success?: boolean } = {
    timestamp: new Date().toISOString(),
    steps
  }

  try {
    const authHeader = c.req.header('Authorization')
    results.steps.push({ step: 'Extract Auth Header', value: authHeader ? `Bearer ${authHeader.slice(7, 20)}...` : 'MISSING' })

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ ...results, error: 'Missing or invalid Authorization header' }, 400)
    }

    const token = authHeader.slice(7)
    results.steps.push({ step: 'Token Length', value: token.length })

    const tokenParts = token.split('.')
    results.steps.push({ step: 'Token Parts', value: tokenParts.length })

    if (tokenParts.length === 3) {
      try {
        const header = JSON.parse(atob(tokenParts[0]))
        const payload = JSON.parse(atob(tokenParts[1]))
        results.steps.push({ step: 'Token Header', value: header })
        results.steps.push({
          step: 'Token Payload (sanitized)',
          value: {
            sub: payload.sub,
            azp: payload.azp,
            exp: payload.exp,
            iat: payload.iat,
            nbf: payload.nbf,
            iss: payload.iss,
            org_id: payload.org_id,
            hasEmail: !!payload.email,
            hasMetadata: !!payload.metadata,
            expDate: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'N/A',
            isExpired: payload.exp ? Date.now() > payload.exp * 1000 : 'N/A'
          }
        })
      } catch (decodeErr) {
        results.steps.push({ step: 'Token Decode Error', value: String(decodeErr) })
      }
    }

    results.steps.push({ step: 'Has CLERK_SECRET_KEY', value: !!c.env.CLERK_SECRET_KEY })
    results.steps.push({ step: 'CLERK_SECRET_KEY prefix', value: c.env.CLERK_SECRET_KEY?.slice(0, 10) + '...' })

    try {
      const payload = await verifyToken(token, {
        secretKey: c.env.CLERK_SECRET_KEY,
        clockSkewInMs: 300000
      })

      results.steps.push({ step: 'verifyToken SUCCESS', value: true })
      results.steps.push({
        step: 'Verified Payload',
        value: {
          sub: payload.sub,
          azp: payload.azp,
          org_id: payload.org_id,
          email: payload.email
        }
      })

      const db = createDb(c.env.DB)
      results.steps.push({ step: 'DB Created', value: true })

      try {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, payload.sub))
          .limit(1)

        results.steps.push({ step: 'DB Query Success', value: true })
        results.steps.push({ step: 'User Found', value: !!existingUser })

        if (existingUser) {
          results.steps.push({
            step: 'User Data',
            value: {
              id: existingUser.id,
              email: existingUser.email,
              organizationId: existingUser.organizationId
            }
          })
        }
      } catch (dbErr) {
        results.steps.push({ step: 'DB Query Error', value: String(dbErr) })
      }

      return c.json({ ...results, success: true })

    } catch (verifyErr) {
      const errorMessage = verifyErr instanceof Error ? verifyErr.message : String(verifyErr)
      const errorStack = verifyErr instanceof Error ? verifyErr.stack : undefined
      results.steps.push({ step: 'verifyToken FAILED', value: errorMessage })
      results.steps.push({ step: 'Error Stack', value: errorStack?.split('\n').slice(0, 3) })

      return c.json({ ...results, error: errorMessage }, 401)
    }

  } catch (err) {
    return c.json({ ...results, error: String(err) }, 500)
  }
})

debugRoutes.post('/verify-cli-token', async (c) => {
  const { jwtVerify } = await import('jose')
  const results: Record<string, unknown> = { timestamp: new Date().toISOString() }

  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing Authorization header' }, 400)
  }

  const token = authHeader.slice(7)
  results.tokenLength = token.length
  results.tokenPreview = token.slice(0, 50) + '...'

  try {
    const parts = token.split('.')
    if (parts.length === 3) {
      const header = JSON.parse(atob(parts[0]))
      const payload = JSON.parse(atob(parts[1]))
      results.header = header
      results.payload = { sub: payload.sub, org: payload.org, type: payload.type, exp: payload.exp }
    }
  } catch (e) {
    results.decodeError = String(e)
  }

  results.hasJwtSecret = !!c.env.JWT_SECRET
  results.jwtSecretLength = c.env.JWT_SECRET?.length
  results.jwtSecretPreview = c.env.JWT_SECRET?.slice(0, 8) + '...'

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    results.verified = true
    results.verifiedPayload = payload
  } catch (e) {
    results.verified = false
    results.verifyError = e instanceof Error ? e.message : String(e)
  }

  return c.json(results)
})

debugRoutes.get('/db-test', async (c) => {
  try {
    const db = createDb(c.env.DB)

    const userCount = await db.select().from(users).limit(1)
    const orgCount = await db.select().from(organizations).limit(1)

    return c.json({
      success: true,
      hasUsers: userCount.length > 0,
      hasOrgs: orgCount.length > 0
    })
  } catch (err) {
    return c.json({
      success: false,
      error: String(err)
    }, 500)
  }
})
