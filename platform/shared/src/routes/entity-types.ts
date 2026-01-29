import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  generateId,
  createEntityTypeSchema,
  updateEntityTypeSchema
} from '../index'
import { createDb, entityTypes, type EntityTypeSchemaJson, type IndexMappingJson, type DisplayConfigJson } from '../db'
import type { MiddlewareHandler } from 'hono'
import type { AuthContext, RouteEnv } from './agents'

export function createEntityTypeRoutes<E extends RouteEnv>(authMiddleware: MiddlewareHandler) {
  const routes = new Hono<{
    Bindings: E
    Variables: { auth: AuthContext }
  }>()

  routes.use('*', authMiddleware)

  routes.get('/', async (c) => {
    const auth = c.get('auth')
    const db = createDb(c.env.DB)

    const typeList = await db
      .select()
      .from(entityTypes)
      .where(eq(entityTypes.organizationId, auth.organizationId))

    return c.json({ entityTypes: typeList })
  })

  routes.post('/', async (c) => {
    const auth = c.get('auth')
    const body = await c.req.json()
    const parsed = createEntityTypeSchema.safeParse(body)

    if (!parsed.success) {
      throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
    }

    const { name, slug, schema, indexMapping, searchFields, displayConfig } = parsed.data
    const db = createDb(c.env.DB)

    const existing = await db
      .select()
      .from(entityTypes)
      .where(and(
        eq(entityTypes.organizationId, auth.organizationId),
        eq(entityTypes.slug, slug)
      ))
      .limit(1)

    if (existing.length > 0) {
      throw new ConflictError(`Entity type with slug '${slug}' already exists`)
    }

    const now = new Date()
    const typeId = generateId('ety')

    await db.insert(entityTypes).values({
      id: typeId,
      organizationId: auth.organizationId,
      name,
      slug,
      schema: schema as EntityTypeSchemaJson,
      indexMapping: (indexMapping || null) as IndexMappingJson | null,
      searchFields: searchFields || null,
      displayConfig: (displayConfig || null) as DisplayConfigJson | null,
      createdAt: now,
      updatedAt: now
    })

    const [entityType] = await db
      .select()
      .from(entityTypes)
      .where(eq(entityTypes.id, typeId))

    return c.json({ entityType }, 201)
  })

  routes.get('/:slug', async (c) => {
    const auth = c.get('auth')
    const slug = c.req.param('slug')
    const db = createDb(c.env.DB)

    const [entityType] = await db
      .select()
      .from(entityTypes)
      .where(and(
        eq(entityTypes.organizationId, auth.organizationId),
        eq(entityTypes.slug, slug)
      ))
      .limit(1)

    if (!entityType) {
      throw new NotFoundError('Entity type', slug)
    }

    return c.json({ entityType })
  })

  routes.patch('/:slug', async (c) => {
    const auth = c.get('auth')
    const slug = c.req.param('slug')
    const body = await c.req.json()
    const parsed = updateEntityTypeSchema.safeParse(body)

    if (!parsed.success) {
      throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
    }

    const db = createDb(c.env.DB)

    const [existing] = await db
      .select()
      .from(entityTypes)
      .where(and(
        eq(entityTypes.organizationId, auth.organizationId),
        eq(entityTypes.slug, slug)
      ))
      .limit(1)

    if (!existing) {
      throw new NotFoundError('Entity type', slug)
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.name) updates.name = parsed.data.name
    if (parsed.data.schema) updates.schema = parsed.data.schema
    if (parsed.data.indexMapping !== undefined) updates.indexMapping = parsed.data.indexMapping || null
    if (parsed.data.searchFields !== undefined) updates.searchFields = parsed.data.searchFields || null
    if (parsed.data.displayConfig !== undefined) updates.displayConfig = parsed.data.displayConfig || null

    await db
      .update(entityTypes)
      .set(updates)
      .where(eq(entityTypes.id, existing.id))

    const [entityType] = await db
      .select()
      .from(entityTypes)
      .where(eq(entityTypes.id, existing.id))

    return c.json({ entityType })
  })

  return routes
}
