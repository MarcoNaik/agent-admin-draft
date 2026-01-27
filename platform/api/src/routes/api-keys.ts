import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import {
  ValidationError,
  NotFoundError,
  generateId,
  generateApiKey,
  generateDevApiKey,
  createApiKeySchema
} from '@struere/platform-shared'
import { createDb, apiKeys } from '../db'
import { jwtAuth } from '../middleware/auth'
import type { Env, AuthContext } from '../types'

export const apiKeyRoutes = new Hono<{
  Bindings: Env
  Variables: { auth: AuthContext }
}>()

apiKeyRoutes.use('*', jwtAuth)

apiKeyRoutes.get('/', async (c) => {
  const auth = c.get('auth')
  const db = createDb(c.env.DB)

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      permissions: apiKeys.permissions,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt
    })
    .from(apiKeys)
    .where(eq(apiKeys.organizationId, auth.organizationId))

  return c.json({ apiKeys: keys })
})

apiKeyRoutes.post('/', async (c) => {
  const auth = c.get('auth')
  const body = await c.req.json()
  const parsed = createApiKeySchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
  }

  const { name, permissions, expiresAt } = parsed.data
  const db = createDb(c.env.DB)

  const isDev = c.req.query('type') === 'dev'
  const { key, hash, prefix } = isDev ? await generateDevApiKey() : await generateApiKey()
  const keyId = generateId('key')

  await db.insert(apiKeys).values({
    id: keyId,
    organizationId: auth.organizationId,
    name,
    keyHash: hash,
    keyPrefix: prefix,
    permissions,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    createdAt: new Date()
  })

  return c.json({
    apiKey: {
      id: keyId,
      name,
      key,
      keyPrefix: prefix,
      permissions,
      expiresAt: expiresAt || null,
      createdAt: new Date()
    }
  }, 201)
})

apiKeyRoutes.delete('/:id', async (c) => {
  const auth = c.get('auth')
  const keyId = c.req.param('id')
  const db = createDb(c.env.DB)

  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(and(
      eq(apiKeys.id, keyId),
      eq(apiKeys.organizationId, auth.organizationId)
    ))
    .limit(1)

  if (!existing) {
    throw new NotFoundError('API key', keyId)
  }

  await db
    .delete(apiKeys)
    .where(eq(apiKeys.id, keyId))

  return c.json({ success: true })
})
