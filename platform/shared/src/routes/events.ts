import { Hono } from 'hono'
import { eq, and, desc, sql } from 'drizzle-orm'
import {
  ValidationError,
  generateUlid,
  emitEventSchema,
  queryEventsSchema
} from '../index'
import { createDb, events, entities, entityTypes } from '../db'
import type { MiddlewareHandler } from 'hono'
import type { AuthContext, RouteEnv } from './agents'

export function createEventRoutes<E extends RouteEnv>(authMiddleware: MiddlewareHandler) {
  const routes = new Hono<{
    Bindings: E
    Variables: { auth: AuthContext }
  }>()

  routes.use('*', authMiddleware)

  routes.get('/', async (c) => {
    const auth = c.get('auth')

    const queryParams = {
      entityId: c.req.query('entityId'),
      eventType: c.req.query('eventType'),
      limit: c.req.query('limit'),
      offset: c.req.query('offset')
    }

    const parsed = queryEventsSchema.safeParse(queryParams)
    if (!parsed.success) {
      throw new ValidationError('Invalid query parameters', { errors: parsed.error.flatten() })
    }

    const { entityId, eventType, limit, offset } = parsed.data
    const db = createDb(c.env.DB)

    const conditions = [eq(events.organizationId, auth.organizationId)]

    if (entityId) {
      conditions.push(eq(events.entityId, entityId))
    }

    if (eventType) {
      conditions.push(eq(events.eventType, eventType))
    }

    const eventList = await db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(desc(events.timestamp))
      .limit(limit)
      .offset(offset)

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(and(...conditions))

    return c.json({
      events: eventList,
      total: countResult[0]?.count || 0,
      limit,
      offset
    })
  })

  routes.post('/', async (c) => {
    const auth = c.get('auth')
    const body = await c.req.json()
    const parsed = emitEventSchema.safeParse(body)

    if (!parsed.success) {
      throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
    }

    const { entityId, entityTypeSlug, eventType, schemaVersion, payload } = parsed.data
    const db = createDb(c.env.DB)

    let resolvedEntityTypeSlug = entityTypeSlug

    if (entityId) {
      const [entity] = await db
        .select({
          entity: entities,
          entityTypeSlug: entityTypes.slug
        })
        .from(entities)
        .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
        .where(and(
          eq(entities.id, entityId),
          eq(entities.organizationId, auth.organizationId)
        ))
        .limit(1)

      if (entity) {
        resolvedEntityTypeSlug = entity.entityTypeSlug
      }
    }

    const eventId = generateUlid('evt')

    await db.insert(events).values({
      id: eventId,
      organizationId: auth.organizationId,
      entityId: entityId || null,
      entityTypeSlug: resolvedEntityTypeSlug || null,
      eventType,
      schemaVersion: schemaVersion || 1,
      actorId: auth.userId,
      actorType: 'user',
      payload,
      timestamp: new Date()
    })

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))

    return c.json({ event }, 201)
  })

  return routes
}
