import { Hono } from 'hono'
import { eq, and, desc, isNull, like, gte, lte, sql } from 'drizzle-orm'
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  generateId,
  generateUlid,
  createEntitySchema,
  updateEntitySchema,
  createRelationSchema,
  queryEntitiesSchema
} from '../index'
import { createDb, entities, entityTypes, entityRelations, events } from '../db'
import { populateIndexes, buildSearchText, validateDataAgainstSchema } from '../services/entity-indexer'
import type { MiddlewareHandler } from 'hono'
import type { AuthContext, RouteEnv } from './agents'
import type { ActorType } from '../types'

export function createEntityRoutes<E extends RouteEnv>(authMiddleware: MiddlewareHandler) {
  const routes = new Hono<{
    Bindings: E
    Variables: { auth: AuthContext }
  }>()

  routes.use('*', authMiddleware)

  async function emitEvent(
    db: ReturnType<typeof createDb>,
    organizationId: string,
    entityId: string | null,
    entityTypeSlug: string | null,
    eventType: string,
    actorId: string | null,
    actorType: ActorType,
    payload: Record<string, unknown>
  ) {
    const eventId = generateUlid('evt')
    await db.insert(events).values({
      id: eventId,
      organizationId,
      entityId,
      entityTypeSlug,
      eventType,
      schemaVersion: 1,
      actorId,
      actorType,
      payload,
      timestamp: new Date()
    })
    return eventId
  }

  routes.get('/', async (c) => {
    const auth = c.get('auth')
    const db = createDb(c.env.DB)

    const queryParams = {
      type: c.req.query('type'),
      status: c.req.query('status'),
      search: c.req.query('search'),
      idx_0: c.req.query('idx_0'),
      idx_1: c.req.query('idx_1'),
      idx_2: c.req.query('idx_2'),
      idx_3: c.req.query('idx_3'),
      idx_num_0: c.req.query('idx_num_0'),
      idx_num_1: c.req.query('idx_num_1'),
      idx_date_0_gte: c.req.query('idx_date_0_gte'),
      idx_date_0_lte: c.req.query('idx_date_0_lte'),
      idx_date_1_gte: c.req.query('idx_date_1_gte'),
      idx_date_1_lte: c.req.query('idx_date_1_lte'),
      limit: c.req.query('limit'),
      offset: c.req.query('offset')
    }

    const parsed = queryEntitiesSchema.safeParse(queryParams)
    if (!parsed.success) {
      throw new ValidationError('Invalid query parameters', { errors: parsed.error.flatten() })
    }

    const { type, status, search, limit, offset } = parsed.data

    const conditions = [
      eq(entities.organizationId, auth.organizationId),
      isNull(entities.deletedAt)
    ]

    if (type) {
      const [entityType] = await db
        .select()
        .from(entityTypes)
        .where(and(
          eq(entityTypes.organizationId, auth.organizationId),
          eq(entityTypes.slug, type)
        ))
        .limit(1)

      if (!entityType) {
        throw new NotFoundError('Entity type', type)
      }
      conditions.push(eq(entities.entityTypeId, entityType.id))
    }

    if (status) {
      conditions.push(eq(entities.status, status))
    }

    if (search) {
      conditions.push(like(entities.searchText, `%${search.toLowerCase()}%`))
    }

    if (parsed.data.idx_0) {
      conditions.push(eq(entities.idx0, parsed.data.idx_0))
    }
    if (parsed.data.idx_1) {
      conditions.push(eq(entities.idx1, parsed.data.idx_1))
    }
    if (parsed.data.idx_2) {
      conditions.push(eq(entities.idx2, parsed.data.idx_2))
    }
    if (parsed.data.idx_3) {
      conditions.push(eq(entities.idx3, parsed.data.idx_3))
    }
    if (parsed.data.idx_num_0 !== undefined) {
      conditions.push(eq(entities.idxNum0, parsed.data.idx_num_0))
    }
    if (parsed.data.idx_num_1 !== undefined) {
      conditions.push(eq(entities.idxNum1, parsed.data.idx_num_1))
    }
    if (parsed.data.idx_date_0_gte) {
      conditions.push(gte(entities.idxDate0, new Date(parsed.data.idx_date_0_gte)))
    }
    if (parsed.data.idx_date_0_lte) {
      conditions.push(lte(entities.idxDate0, new Date(parsed.data.idx_date_0_lte)))
    }
    if (parsed.data.idx_date_1_gte) {
      conditions.push(gte(entities.idxDate1, new Date(parsed.data.idx_date_1_gte)))
    }
    if (parsed.data.idx_date_1_lte) {
      conditions.push(lte(entities.idxDate1, new Date(parsed.data.idx_date_1_lte)))
    }

    const entityList = await db
      .select({
        entity: entities,
        entityTypeName: entityTypes.name,
        entityTypeSlug: entityTypes.slug
      })
      .from(entities)
      .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
      .where(and(...conditions))
      .orderBy(desc(entities.updatedAt))
      .limit(limit)
      .offset(offset)

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(entities)
      .where(and(...conditions))

    return c.json({
      entities: entityList.map(e => ({
        ...e.entity,
        entityTypeName: e.entityTypeName,
        entityTypeSlug: e.entityTypeSlug
      })),
      total: countResult[0]?.count || 0,
      limit,
      offset
    })
  })

  routes.post('/', async (c) => {
    const auth = c.get('auth')
    const body = await c.req.json()
    const parsed = createEntitySchema.safeParse(body)

    if (!parsed.success) {
      throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
    }

    const { entityTypeSlug, status, data } = parsed.data
    const db = createDb(c.env.DB)

    const [entityType] = await db
      .select()
      .from(entityTypes)
      .where(and(
        eq(entityTypes.organizationId, auth.organizationId),
        eq(entityTypes.slug, entityTypeSlug)
      ))
      .limit(1)

    if (!entityType) {
      throw new NotFoundError('Entity type', entityTypeSlug)
    }

    const validation = validateDataAgainstSchema(data, entityType.schema)
    if (!validation.valid) {
      throw new ValidationError('Data validation failed', { errors: validation.errors })
    }

    const indexedFields = populateIndexes(data, entityType.indexMapping)
    const searchText = buildSearchText(data, entityType.searchFields)

    const now = new Date()
    const entityId = generateId('ent')

    await db.insert(entities).values({
      id: entityId,
      organizationId: auth.organizationId,
      entityTypeId: entityType.id,
      status: status || 'active',
      data,
      searchText,
      idx0: indexedFields.idx0 || null,
      idx1: indexedFields.idx1 || null,
      idx2: indexedFields.idx2 || null,
      idx3: indexedFields.idx3 || null,
      idxNum0: indexedFields.idxNum0 || null,
      idxNum1: indexedFields.idxNum1 || null,
      idxDate0: indexedFields.idxDate0 || null,
      idxDate1: indexedFields.idxDate1 || null,
      createdAt: now,
      updatedAt: now
    })

    await emitEvent(
      db,
      auth.organizationId,
      entityId,
      entityType.slug,
      `${entityType.slug}.created`,
      auth.userId,
      'user',
      { data, status: status || 'active' }
    )

    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entityId))

    return c.json({
      entity: {
        ...entity,
        entityTypeName: entityType.name,
        entityTypeSlug: entityType.slug
      }
    }, 201)
  })

  routes.get('/:id', async (c) => {
    const auth = c.get('auth')
    const entityId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [result] = await db
      .select({
        entity: entities,
        entityTypeName: entityTypes.name,
        entityTypeSlug: entityTypes.slug
      })
      .from(entities)
      .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
      .where(and(
        eq(entities.id, entityId),
        eq(entities.organizationId, auth.organizationId),
        isNull(entities.deletedAt)
      ))
      .limit(1)

    if (!result) {
      throw new NotFoundError('Entity', entityId)
    }

    const relations = await db
      .select()
      .from(entityRelations)
      .where(eq(entityRelations.fromEntityId, entityId))

    const reverseRelations = await db
      .select()
      .from(entityRelations)
      .where(eq(entityRelations.toEntityId, entityId))

    return c.json({
      entity: {
        ...result.entity,
        entityTypeName: result.entityTypeName,
        entityTypeSlug: result.entityTypeSlug
      },
      relations,
      reverseRelations
    })
  })

  routes.patch('/:id', async (c) => {
    const auth = c.get('auth')
    const entityId = c.req.param('id')
    const body = await c.req.json()
    const parsed = updateEntitySchema.safeParse(body)

    if (!parsed.success) {
      throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
    }

    const db = createDb(c.env.DB)

    const [existing] = await db
      .select({
        entity: entities,
        entityType: entityTypes
      })
      .from(entities)
      .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
      .where(and(
        eq(entities.id, entityId),
        eq(entities.organizationId, auth.organizationId),
        isNull(entities.deletedAt)
      ))
      .limit(1)

    if (!existing) {
      throw new NotFoundError('Entity', entityId)
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    const eventPayload: Record<string, unknown> = {}

    if (parsed.data.status) {
      updates.status = parsed.data.status
      eventPayload.oldStatus = existing.entity.status
      eventPayload.newStatus = parsed.data.status
    }

    if (parsed.data.data) {
      const mergedData = { ...existing.entity.data, ...parsed.data.data }

      const validation = validateDataAgainstSchema(mergedData, existing.entityType.schema)
      if (!validation.valid) {
        throw new ValidationError('Data validation failed', { errors: validation.errors })
      }

      const indexedFields = populateIndexes(mergedData, existing.entityType.indexMapping)
      const searchText = buildSearchText(mergedData, existing.entityType.searchFields)

      updates.data = mergedData
      updates.searchText = searchText
      updates.idx0 = indexedFields.idx0 || null
      updates.idx1 = indexedFields.idx1 || null
      updates.idx2 = indexedFields.idx2 || null
      updates.idx3 = indexedFields.idx3 || null
      updates.idxNum0 = indexedFields.idxNum0 || null
      updates.idxNum1 = indexedFields.idxNum1 || null
      updates.idxDate0 = indexedFields.idxDate0 || null
      updates.idxDate1 = indexedFields.idxDate1 || null

      eventPayload.changes = parsed.data.data
    }

    await db
      .update(entities)
      .set(updates)
      .where(eq(entities.id, entityId))

    await emitEvent(
      db,
      auth.organizationId,
      entityId,
      existing.entityType.slug,
      `${existing.entityType.slug}.updated`,
      auth.userId,
      'user',
      eventPayload
    )

    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entityId))

    return c.json({
      entity: {
        ...entity,
        entityTypeName: existing.entityType.name,
        entityTypeSlug: existing.entityType.slug
      }
    })
  })

  routes.delete('/:id', async (c) => {
    const auth = c.get('auth')
    const entityId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [existing] = await db
      .select({
        entity: entities,
        entityTypeSlug: entityTypes.slug
      })
      .from(entities)
      .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
      .where(and(
        eq(entities.id, entityId),
        eq(entities.organizationId, auth.organizationId),
        isNull(entities.deletedAt)
      ))
      .limit(1)

    if (!existing) {
      throw new NotFoundError('Entity', entityId)
    }

    await db
      .update(entities)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(entities.id, entityId))

    await emitEvent(
      db,
      auth.organizationId,
      entityId,
      existing.entityTypeSlug,
      `${existing.entityTypeSlug}.deleted`,
      auth.userId,
      'user',
      {}
    )

    return c.json({ success: true })
  })

  routes.get('/:id/relations', async (c) => {
    const auth = c.get('auth')
    const entityId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [entity] = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.id, entityId),
        eq(entities.organizationId, auth.organizationId),
        isNull(entities.deletedAt)
      ))
      .limit(1)

    if (!entity) {
      throw new NotFoundError('Entity', entityId)
    }

    const outgoing = await db
      .select({
        relation: entityRelations,
        toEntity: entities,
        toEntityTypeName: entityTypes.name,
        toEntityTypeSlug: entityTypes.slug
      })
      .from(entityRelations)
      .innerJoin(entities, eq(entityRelations.toEntityId, entities.id))
      .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
      .where(eq(entityRelations.fromEntityId, entityId))

    const incoming = await db
      .select({
        relation: entityRelations,
        fromEntity: entities,
        fromEntityTypeName: entityTypes.name,
        fromEntityTypeSlug: entityTypes.slug
      })
      .from(entityRelations)
      .innerJoin(entities, eq(entityRelations.fromEntityId, entities.id))
      .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
      .where(eq(entityRelations.toEntityId, entityId))

    return c.json({
      outgoing: outgoing.map(r => ({
        ...r.relation,
        toEntity: {
          ...r.toEntity,
          entityTypeName: r.toEntityTypeName,
          entityTypeSlug: r.toEntityTypeSlug
        }
      })),
      incoming: incoming.map(r => ({
        ...r.relation,
        fromEntity: {
          ...r.fromEntity,
          entityTypeName: r.fromEntityTypeName,
          entityTypeSlug: r.fromEntityTypeSlug
        }
      }))
    })
  })

  routes.post('/:id/relations', async (c) => {
    const auth = c.get('auth')
    const fromEntityId = c.req.param('id')
    const body = await c.req.json()
    const parsed = createRelationSchema.safeParse(body)

    if (!parsed.success) {
      throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
    }

    const { toEntityId, relationType, metadata } = parsed.data
    const db = createDb(c.env.DB)

    const [fromEntity] = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.id, fromEntityId),
        eq(entities.organizationId, auth.organizationId),
        isNull(entities.deletedAt)
      ))
      .limit(1)

    if (!fromEntity) {
      throw new NotFoundError('Entity', fromEntityId)
    }

    const [toEntity] = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.id, toEntityId),
        eq(entities.organizationId, auth.organizationId),
        isNull(entities.deletedAt)
      ))
      .limit(1)

    if (!toEntity) {
      throw new NotFoundError('Entity', toEntityId)
    }

    const [existingRelation] = await db
      .select()
      .from(entityRelations)
      .where(and(
        eq(entityRelations.fromEntityId, fromEntityId),
        eq(entityRelations.toEntityId, toEntityId),
        eq(entityRelations.relationType, relationType)
      ))
      .limit(1)

    if (existingRelation) {
      throw new ConflictError(`Relation '${relationType}' already exists between these entities`)
    }

    const relationId = generateId('rel')

    await db.insert(entityRelations).values({
      id: relationId,
      organizationId: auth.organizationId,
      fromEntityId,
      toEntityId,
      relationType,
      metadata: metadata || null,
      createdAt: new Date()
    })

    const [relation] = await db
      .select()
      .from(entityRelations)
      .where(eq(entityRelations.id, relationId))

    return c.json({ relation }, 201)
  })

  routes.delete('/:id/relations/:relId', async (c) => {
    const auth = c.get('auth')
    const entityId = c.req.param('id')
    const relationId = c.req.param('relId')
    const db = createDb(c.env.DB)

    const [relation] = await db
      .select()
      .from(entityRelations)
      .where(and(
        eq(entityRelations.id, relationId),
        eq(entityRelations.organizationId, auth.organizationId),
        eq(entityRelations.fromEntityId, entityId)
      ))
      .limit(1)

    if (!relation) {
      throw new NotFoundError('Relation', relationId)
    }

    await db
      .delete(entityRelations)
      .where(eq(entityRelations.id, relationId))

    return c.json({ success: true })
  })

  routes.get('/:id/events', async (c) => {
    const auth = c.get('auth')
    const entityId = c.req.param('id')
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')
    const db = createDb(c.env.DB)

    const [entity] = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.id, entityId),
        eq(entities.organizationId, auth.organizationId)
      ))
      .limit(1)

    if (!entity) {
      throw new NotFoundError('Entity', entityId)
    }

    const eventList = await db
      .select()
      .from(events)
      .where(eq(events.entityId, entityId))
      .orderBy(desc(events.timestamp))
      .limit(Math.min(limit, 100))
      .offset(offset)

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(eq(events.entityId, entityId))

    return c.json({
      events: eventList,
      total: countResult[0]?.count || 0,
      limit,
      offset
    })
  })

  return routes
}
