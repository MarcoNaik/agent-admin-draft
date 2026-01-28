import { createMiddleware } from 'hono/factory'
import { eq } from 'drizzle-orm'
import * as jose from 'jose'
import { AuthenticationError, AuthorizationError, parseApiKey, hashApiKey } from '@struere/platform-shared'
import { createDb, apiKeys } from '../db'
import type { Env, AuthContext, ApiKeyContext } from '../types'

export const jwtAuth = createMiddleware<{
  Bindings: Env
  Variables: { auth: AuthContext }
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid authorization header')
  }

  const token = authHeader.slice(7)

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret)

    c.set('auth', {
      userId: payload.sub as string,
      organizationId: payload.org as string,
      email: payload.email as string
    })

    await next()
  } catch {
    throw new AuthenticationError('Invalid or expired token')
  }
})

export const apiKeyAuth = createMiddleware<{
  Bindings: Env
  Variables: { apiKey: ApiKeyContext }
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const key = parseApiKey(authHeader ?? null)

  if (!key) {
    throw new AuthenticationError('Missing or invalid API key')
  }

  const db = createDb(c.env.DB)
  const keyHash = await hashApiKey(key)

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1)

  if (!apiKey) {
    throw new AuthenticationError('Invalid API key')
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new AuthenticationError('API key has expired')
  }

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id))

  c.set('apiKey', {
    apiKeyId: apiKey.id,
    organizationId: apiKey.organizationId,
    permissions: apiKey.permissions
  })

  await next()
})

export function requirePermission(...required: string[]) {
  return createMiddleware<{
    Bindings: Env
    Variables: { apiKey: ApiKeyContext }
  }>(async (c, next) => {
    const apiKey = c.get('apiKey')

    const hasPermission = required.every(p => apiKey.permissions.includes(p))
    if (!hasPermission) {
      throw new AuthorizationError(`Missing required permissions: ${required.join(', ')}`)
    }

    await next()
  })
}

export async function createJwt(
  env: Env,
  payload: { sub: string; org: string; email: string }
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET)

  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}
