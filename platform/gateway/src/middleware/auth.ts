import { createMiddleware } from 'hono/factory'
import { AuthenticationError, AuthorizationError, parseApiKey, hashApiKey } from '@struere/platform-shared'
import type { Env, ApiKeyContext } from '../types'

export const apiKeyAuth = createMiddleware<{
  Bindings: Env
  Variables: { apiKey: ApiKeyContext }
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const key = parseApiKey(authHeader)

  if (!key) {
    throw new AuthenticationError('Missing or invalid API key')
  }

  const keyHash = await hashApiKey(key)

  const result = await c.env.DB.prepare(`
    SELECT id, organization_id, permissions, expires_at
    FROM api_keys
    WHERE key_hash = ?
  `).bind(keyHash).first<{
    id: string
    organization_id: string
    permissions: string
    expires_at: number | null
  }>()

  if (!result) {
    throw new AuthenticationError('Invalid API key')
  }

  if (result.expires_at && result.expires_at < Date.now() / 1000) {
    throw new AuthenticationError('API key has expired')
  }

  const permissions = JSON.parse(result.permissions) as string[]
  if (!permissions.includes('agent:execute')) {
    throw new AuthorizationError('API key does not have execute permission')
  }

  await c.env.DB.prepare(`
    UPDATE api_keys SET last_used_at = ? WHERE id = ?
  `).bind(Math.floor(Date.now() / 1000), result.id).run()

  c.set('apiKey', {
    apiKeyId: result.id,
    organizationId: result.organization_id,
    permissions
  })

  await next()
})
