import { eq, and, desc, isNull, like, gte, lte, sql } from 'drizzle-orm'
import {
  createDb,
  entities,
  entityTypes,
  entityRelations,
  events,
  jobs
} from '../db'
import {
  generateId,
  generateUlid,
  NotFoundError,
  ValidationError,
  ConflictError,
  populateIndexes,
  buildSearchText,
  validateDataAgainstSchema
} from '@struere/platform-shared'
import { enqueueJob, cancelScheduledJob } from '../jobs/enqueue'
import type { ToolContext } from './context'
import type { ActorType } from '@struere/platform-shared'

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required?: boolean
  default?: unknown
}

export interface BuiltinTool {
  name: string
  description: string
  parameters: Record<string, ToolParameter>
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
}

async function emitEventInternal(
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

export const builtinTools: Record<string, BuiltinTool> = {
  'entity.create': {
    name: 'entity.create',
    description: 'Create a new entity',
    parameters: {
      type: {
        type: 'string',
        description: 'Entity type slug (e.g., "student", "session")',
        required: true
      },
      data: {
        type: 'object',
        description: 'Entity data matching the type schema',
        required: true
      },
      status: {
        type: 'string',
        description: 'Initial status (optional)',
        required: false,
        default: 'active'
      }
    },
    handler: async (args, ctx) => {
      const { type, data, status } = args as {
        type: string
        data: Record<string, unknown>
        status?: string
      }

      const db = createDb(ctx.env.DB)

      const [entityType] = await db
        .select()
        .from(entityTypes)
        .where(and(
          eq(entityTypes.organizationId, ctx.organizationId),
          eq(entityTypes.slug, type)
        ))
        .limit(1)

      if (!entityType) {
        throw new NotFoundError('Entity type', type)
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
        organizationId: ctx.organizationId,
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

      await emitEventInternal(
        db,
        ctx.organizationId,
        entityId,
        entityType.slug,
        `${entityType.slug}.created`,
        ctx.effectiveActor.userId,
        'agent',
        { data, status: status || 'active' }
      )

      const [entity] = await db
        .select()
        .from(entities)
        .where(eq(entities.id, entityId))

      return {
        entity: {
          ...entity,
          entityTypeName: entityType.name,
          entityTypeSlug: entityType.slug
        }
      }
    }
  },

  'entity.get': {
    name: 'entity.get',
    description: 'Get an entity by ID',
    parameters: {
      id: {
        type: 'string',
        description: 'Entity ID',
        required: true
      },
      includeRelations: {
        type: 'boolean',
        description: 'Include related entities',
        required: false,
        default: false
      }
    },
    handler: async (args, ctx) => {
      const { id, includeRelations } = args as {
        id: string
        includeRelations?: boolean
      }

      const db = createDb(ctx.env.DB)

      const [result] = await db
        .select({
          entity: entities,
          entityTypeName: entityTypes.name,
          entityTypeSlug: entityTypes.slug
        })
        .from(entities)
        .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
        .where(and(
          eq(entities.id, id),
          eq(entities.organizationId, ctx.organizationId),
          isNull(entities.deletedAt)
        ))
        .limit(1)

      if (!result) {
        throw new NotFoundError('Entity', id)
      }

      const response: Record<string, unknown> = {
        entity: {
          ...result.entity,
          entityTypeName: result.entityTypeName,
          entityTypeSlug: result.entityTypeSlug
        }
      }

      if (includeRelations) {
        const relations = await db
          .select()
          .from(entityRelations)
          .where(eq(entityRelations.fromEntityId, id))

        const reverseRelations = await db
          .select()
          .from(entityRelations)
          .where(eq(entityRelations.toEntityId, id))

        response.relations = relations
        response.reverseRelations = reverseRelations
      }

      return response
    }
  },

  'entity.query': {
    name: 'entity.query',
    description: 'Query entities with filters',
    parameters: {
      type: {
        type: 'string',
        description: 'Entity type slug',
        required: true
      },
      filters: {
        type: 'object',
        description: 'Filter conditions (field: value)',
        required: false
      },
      status: {
        type: 'string',
        description: 'Filter by status',
        required: false
      },
      search: {
        type: 'string',
        description: 'Full-text search',
        required: false
      },
      limit: {
        type: 'number',
        description: 'Max results (default 20)',
        required: false,
        default: 20
      },
      offset: {
        type: 'number',
        description: 'Pagination offset',
        required: false,
        default: 0
      }
    },
    handler: async (args, ctx) => {
      const { type, filters, status, search, limit = 20, offset = 0 } = args as {
        type: string
        filters?: Record<string, unknown>
        status?: string
        search?: string
        limit?: number
        offset?: number
      }

      const db = createDb(ctx.env.DB)

      const [entityType] = await db
        .select()
        .from(entityTypes)
        .where(and(
          eq(entityTypes.organizationId, ctx.organizationId),
          eq(entityTypes.slug, type)
        ))
        .limit(1)

      if (!entityType) {
        throw new NotFoundError('Entity type', type)
      }

      const conditions = [
        eq(entities.organizationId, ctx.organizationId),
        eq(entities.entityTypeId, entityType.id),
        isNull(entities.deletedAt)
      ]

      if (status) {
        conditions.push(eq(entities.status, status))
      }

      if (search) {
        conditions.push(like(entities.searchText, `%${search.toLowerCase()}%`))
      }

      if (filters) {
        if (filters.idx_0) conditions.push(eq(entities.idx0, String(filters.idx_0)))
        if (filters.idx_1) conditions.push(eq(entities.idx1, String(filters.idx_1)))
        if (filters.idx_2) conditions.push(eq(entities.idx2, String(filters.idx_2)))
        if (filters.idx_3) conditions.push(eq(entities.idx3, String(filters.idx_3)))
        if (filters.idx_num_0 !== undefined) conditions.push(eq(entities.idxNum0, Number(filters.idx_num_0)))
        if (filters.idx_num_1 !== undefined) conditions.push(eq(entities.idxNum1, Number(filters.idx_num_1)))
        if (filters.idx_date_0_gte) conditions.push(gte(entities.idxDate0, new Date(String(filters.idx_date_0_gte))))
        if (filters.idx_date_0_lte) conditions.push(lte(entities.idxDate0, new Date(String(filters.idx_date_0_lte))))
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
        .limit(Math.min(limit, 100))
        .offset(offset)

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(entities)
        .where(and(...conditions))

      return {
        entities: entityList.map(e => ({
          ...e.entity,
          entityTypeName: e.entityTypeName,
          entityTypeSlug: e.entityTypeSlug
        })),
        total: countResult[0]?.count || 0,
        limit: Math.min(limit, 100),
        offset
      }
    }
  },

  'entity.update': {
    name: 'entity.update',
    description: 'Update an entity',
    parameters: {
      id: {
        type: 'string',
        description: 'Entity ID',
        required: true
      },
      data: {
        type: 'object',
        description: 'Fields to update',
        required: false
      },
      status: {
        type: 'string',
        description: 'New status (optional)',
        required: false
      }
    },
    handler: async (args, ctx) => {
      const { id, data, status } = args as {
        id: string
        data?: Record<string, unknown>
        status?: string
      }

      const db = createDb(ctx.env.DB)

      const [existing] = await db
        .select({
          entity: entities,
          entityType: entityTypes
        })
        .from(entities)
        .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
        .where(and(
          eq(entities.id, id),
          eq(entities.organizationId, ctx.organizationId),
          isNull(entities.deletedAt)
        ))
        .limit(1)

      if (!existing) {
        throw new NotFoundError('Entity', id)
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() }
      const eventPayload: Record<string, unknown> = {}

      if (status) {
        updates.status = status
        eventPayload.oldStatus = existing.entity.status
        eventPayload.newStatus = status
      }

      if (data) {
        const mergedData = { ...existing.entity.data, ...data }

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

        eventPayload.changes = data
      }

      await db
        .update(entities)
        .set(updates)
        .where(eq(entities.id, id))

      await emitEventInternal(
        db,
        ctx.organizationId,
        id,
        existing.entityType.slug,
        `${existing.entityType.slug}.updated`,
        ctx.effectiveActor.userId,
        'agent',
        eventPayload
      )

      const [entity] = await db
        .select()
        .from(entities)
        .where(eq(entities.id, id))

      return {
        entity: {
          ...entity,
          entityTypeName: existing.entityType.name,
          entityTypeSlug: existing.entityType.slug
        }
      }
    }
  },

  'entity.delete': {
    name: 'entity.delete',
    description: 'Delete an entity (soft delete)',
    parameters: {
      id: {
        type: 'string',
        description: 'Entity ID',
        required: true
      }
    },
    handler: async (args, ctx) => {
      const { id } = args as { id: string }

      const db = createDb(ctx.env.DB)

      const [existing] = await db
        .select({
          entity: entities,
          entityTypeSlug: entityTypes.slug
        })
        .from(entities)
        .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
        .where(and(
          eq(entities.id, id),
          eq(entities.organizationId, ctx.organizationId),
          isNull(entities.deletedAt)
        ))
        .limit(1)

      if (!existing) {
        throw new NotFoundError('Entity', id)
      }

      await db
        .update(entities)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(entities.id, id))

      await emitEventInternal(
        db,
        ctx.organizationId,
        id,
        existing.entityTypeSlug,
        `${existing.entityTypeSlug}.deleted`,
        ctx.effectiveActor.userId,
        'agent',
        {}
      )

      return { success: true, deletedId: id }
    }
  },

  'entity.link': {
    name: 'entity.link',
    description: 'Create a relation between entities',
    parameters: {
      fromId: {
        type: 'string',
        description: 'Source entity ID',
        required: true
      },
      toId: {
        type: 'string',
        description: 'Target entity ID',
        required: true
      },
      relationType: {
        type: 'string',
        description: 'Relation type (e.g., "guardian_of")',
        required: true
      },
      metadata: {
        type: 'object',
        description: 'Optional relation metadata',
        required: false
      }
    },
    handler: async (args, ctx) => {
      const { fromId, toId, relationType, metadata } = args as {
        fromId: string
        toId: string
        relationType: string
        metadata?: Record<string, unknown>
      }

      const db = createDb(ctx.env.DB)

      const [fromEntity] = await db
        .select()
        .from(entities)
        .where(and(
          eq(entities.id, fromId),
          eq(entities.organizationId, ctx.organizationId),
          isNull(entities.deletedAt)
        ))
        .limit(1)

      if (!fromEntity) {
        throw new NotFoundError('Entity', fromId)
      }

      const [toEntity] = await db
        .select()
        .from(entities)
        .where(and(
          eq(entities.id, toId),
          eq(entities.organizationId, ctx.organizationId),
          isNull(entities.deletedAt)
        ))
        .limit(1)

      if (!toEntity) {
        throw new NotFoundError('Entity', toId)
      }

      const [existingRelation] = await db
        .select()
        .from(entityRelations)
        .where(and(
          eq(entityRelations.fromEntityId, fromId),
          eq(entityRelations.toEntityId, toId),
          eq(entityRelations.relationType, relationType)
        ))
        .limit(1)

      if (existingRelation) {
        throw new ConflictError(`Relation '${relationType}' already exists between these entities`)
      }

      const relationId = generateId('rel')

      await db.insert(entityRelations).values({
        id: relationId,
        organizationId: ctx.organizationId,
        fromEntityId: fromId,
        toEntityId: toId,
        relationType,
        metadata: metadata || null,
        createdAt: new Date()
      })

      const [relation] = await db
        .select()
        .from(entityRelations)
        .where(eq(entityRelations.id, relationId))

      return { relation }
    }
  },

  'entity.unlink': {
    name: 'entity.unlink',
    description: 'Remove a relation between entities',
    parameters: {
      fromId: {
        type: 'string',
        description: 'Source entity ID',
        required: true
      },
      toId: {
        type: 'string',
        description: 'Target entity ID',
        required: true
      },
      relationType: {
        type: 'string',
        description: 'Relation type',
        required: true
      }
    },
    handler: async (args, ctx) => {
      const { fromId, toId, relationType } = args as {
        fromId: string
        toId: string
        relationType: string
      }

      const db = createDb(ctx.env.DB)

      const [relation] = await db
        .select()
        .from(entityRelations)
        .where(and(
          eq(entityRelations.fromEntityId, fromId),
          eq(entityRelations.toEntityId, toId),
          eq(entityRelations.relationType, relationType),
          eq(entityRelations.organizationId, ctx.organizationId)
        ))
        .limit(1)

      if (!relation) {
        throw new NotFoundError('Relation', `${fromId}->${toId}:${relationType}`)
      }

      await db
        .delete(entityRelations)
        .where(eq(entityRelations.id, relation.id))

      return { success: true, deletedRelationId: relation.id }
    }
  },

  'event.emit': {
    name: 'event.emit',
    description: 'Emit a custom event',
    parameters: {
      entityId: {
        type: 'string',
        description: 'Related entity ID (optional)',
        required: false
      },
      eventType: {
        type: 'string',
        description: 'Event type (e.g., "session.reminder_sent")',
        required: true
      },
      payload: {
        type: 'object',
        description: 'Event payload data',
        required: true
      }
    },
    handler: async (args, ctx) => {
      const { entityId, eventType, payload } = args as {
        entityId?: string
        eventType: string
        payload: Record<string, unknown>
      }

      const db = createDb(ctx.env.DB)

      let entityTypeSlug: string | null = null

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
            eq(entities.organizationId, ctx.organizationId)
          ))
          .limit(1)

        if (entity) {
          entityTypeSlug = entity.entityTypeSlug
        }
      }

      const eventId = await emitEventInternal(
        db,
        ctx.organizationId,
        entityId || null,
        entityTypeSlug,
        eventType,
        ctx.effectiveActor.userId,
        'agent',
        payload
      )

      return { eventId, eventType }
    }
  },

  'event.query': {
    name: 'event.query',
    description: 'Query events',
    parameters: {
      entityId: {
        type: 'string',
        description: 'Filter by entity',
        required: false
      },
      eventType: {
        type: 'string',
        description: 'Filter by event type',
        required: false
      },
      limit: {
        type: 'number',
        description: 'Max results',
        required: false,
        default: 50
      }
    },
    handler: async (args, ctx) => {
      const { entityId, eventType, limit = 50 } = args as {
        entityId?: string
        eventType?: string
        limit?: number
      }

      const db = createDb(ctx.env.DB)

      const conditions = [eq(events.organizationId, ctx.organizationId)]

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
        .limit(Math.min(limit, 100))

      return { events: eventList }
    }
  },

  'job.enqueue': {
    name: 'job.enqueue',
    description: 'Schedule a job for execution',
    parameters: {
      jobType: {
        type: 'string',
        description: 'Job type (e.g., "send_session_reminder")',
        required: true
      },
      payload: {
        type: 'object',
        description: 'Job payload data',
        required: true
      },
      entityId: {
        type: 'string',
        description: 'Related entity ID (optional)',
        required: false
      },
      scheduledFor: {
        type: 'string',
        description: 'ISO datetime for scheduled execution (optional)',
        required: false
      },
      idempotencyKey: {
        type: 'string',
        description: 'Key to prevent duplicate jobs',
        required: false
      }
    },
    handler: async (args, ctx) => {
      const { jobType, payload, entityId, scheduledFor, idempotencyKey } = args as {
        jobType: string
        payload: Record<string, unknown>
        entityId?: string
        scheduledFor?: string
        idempotencyKey?: string
      }

      const result = await enqueueJob(
        {
          organizationId: ctx.organizationId,
          jobType,
          payload,
          entityId,
          idempotencyKey,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined
        },
        ctx.env
      )

      return {
        jobId: result.jobId,
        existing: result.existing,
        scheduledFor: scheduledFor || new Date().toISOString()
      }
    }
  },

  'job.cancel': {
    name: 'job.cancel',
    description: 'Cancel a pending job',
    parameters: {
      jobId: {
        type: 'string',
        description: 'Job ID to cancel',
        required: true
      }
    },
    handler: async (args, ctx) => {
      const { jobId } = args as { jobId: string }

      const db = createDb(ctx.env.DB)

      const [existing] = await db
        .select()
        .from(jobs)
        .where(and(
          eq(jobs.id, jobId),
          eq(jobs.organizationId, ctx.organizationId)
        ))
        .limit(1)

      if (!existing) {
        throw new NotFoundError('Job', jobId)
      }

      if (existing.status !== 'pending') {
        throw new ConflictError(`Cannot cancel job with status '${existing.status}'`)
      }

      await db
        .update(jobs)
        .set({
          status: 'dead',
          errorMessage: 'Cancelled by agent',
          completedAt: new Date()
        })
        .where(eq(jobs.id, jobId))

      await cancelScheduledJob(jobId, ctx.env)

      return { success: true, cancelledJobId: jobId }
    }
  }
}

export function getBuiltinToolNames(): string[] {
  return Object.keys(builtinTools)
}

export function getBuiltinTool(name: string): BuiltinTool | undefined {
  return builtinTools[name]
}

export function formatToolForLLM(tool: BuiltinTool): {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
} {
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [paramName, param] of Object.entries(tool.parameters)) {
    properties[paramName] = {
      type: param.type,
      description: param.description
    }
    if (param.required) {
      required.push(paramName)
    }
  }

  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object',
      properties,
      required
    }
  }
}
