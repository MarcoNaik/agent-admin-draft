import { Hono } from 'hono'
import { eq, and, desc, isNull, like, gte, lte, sql, or } from 'drizzle-orm'
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
import { createDb, entities, entityTypes, entityRelations, events, roles, policies, scopeRules, fieldMasks, userRoles } from '../db'
import { populateIndexes, buildSearchText, validateDataAgainstSchema } from '../services/entity-indexer'
import { PermissionEvaluator } from '../permissions/evaluator'
import { FieldMasker } from '../permissions/masking'
import { AuthorizationError } from '../errors'
import type { MiddlewareHandler } from 'hono'
import type { AuthContext, RouteEnv } from './agents'
import type { ActorType } from '../types'
import type { ActorContext, ResolvedPolicy, ScopeRule, FieldMask, PermissionResult, ScopeFilter } from '../permissions/types'

interface PermissionContext {
  evaluator: PermissionEvaluator
  masker: FieldMasker
  actor: ActorContext
}

export function createEntityRoutesWithPermissions<E extends RouteEnv>(authMiddleware: MiddlewareHandler) {
  const routes = new Hono<{
    Bindings: E
    Variables: {
      auth: AuthContext
      permissions?: PermissionContext
      permissionResult?: PermissionResult
    }
  }>()

  routes.use('*', authMiddleware)

  routes.use('*', async (c, next) => {
    const auth = c.get('auth')
    if (!auth) {
      throw new AuthorizationError('Authentication required')
    }

    const db = createDb(c.env.DB)
    const now = new Date()

    const userRoleAssignments = await db
      .select({
        userRole: userRoles,
        roleName: roles.name
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(
        eq(userRoles.userId, auth.userId),
        or(
          isNull(userRoles.expiresAt),
          gte(userRoles.expiresAt, now)
        )
      ))

    const roleIds = userRoleAssignments.map(r => r.userRole.roleId)
    const roleNames = userRoleAssignments.map(r => r.roleName)

    const actor: ActorContext = {
      userId: auth.userId,
      organizationId: auth.organizationId,
      roles: roleNames,
      attributes: {}
    }

    let resolvedPolicies: ResolvedPolicy[] = []

    if (roleIds.length > 0) {
      const policyRecords = await db
        .select()
        .from(policies)
        .where(and(
          eq(policies.organizationId, auth.organizationId),
          or(...roleIds.map(id => eq(policies.roleId, id)))
        ))

      const policyIds = policyRecords.map(p => p.id)

      let scopeRuleRecords: Array<typeof scopeRules.$inferSelect> = []
      let fieldMaskRecords: Array<typeof fieldMasks.$inferSelect> = []

      if (policyIds.length > 0) {
        scopeRuleRecords = await db
          .select()
          .from(scopeRules)
          .where(or(...policyIds.map(id => eq(scopeRules.policyId, id))))

        fieldMaskRecords = await db
          .select()
          .from(fieldMasks)
          .where(or(...policyIds.map(id => eq(fieldMasks.policyId, id))))
      }

      resolvedPolicies = policyRecords.map(policy => {
        const policyScopes: ScopeRule[] = scopeRuleRecords
          .filter(s => s.policyId === policy.id)
          .map(s => ({
            id: s.id,
            policyId: s.policyId,
            type: s.type as 'field' | 'relation',
            field: s.field,
            operator: s.operator as ScopeRule['operator'],
            value: s.value,
            relationPath: s.relationPath
          }))

        const policyMasks: FieldMask[] = fieldMaskRecords
          .filter(m => m.policyId === policy.id)
          .map(m => ({
            id: m.id,
            policyId: m.policyId,
            fieldPath: m.fieldPath,
            maskType: m.maskType as 'hide' | 'redact',
            config: m.maskConfig
          }))

        return {
          id: policy.id,
          organizationId: policy.organizationId,
          roleId: policy.roleId,
          resource: policy.resource,
          action: policy.action,
          effect: policy.effect as 'allow' | 'deny',
          priority: policy.priority || 0,
          scopeRules: policyScopes,
          fieldMasks: policyMasks
        }
      })
    }

    const evaluator = new PermissionEvaluator(resolvedPolicies)
    const masker = new FieldMasker()

    c.set('permissions', { evaluator, masker, actor })

    await next()
  })

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

  function applyScopeFilters(
    conditions: ReturnType<typeof eq>[],
    scopeFilters: ScopeFilter[],
    actor: ActorContext
  ) {
    for (const filter of scopeFilters) {
      const resolvedValue = typeof filter.value === 'string' && filter.value.startsWith('$actor.')
        ? resolveActorVariable(filter.value, actor)
        : filter.value

      if (filter.field === 'organizationId' || filter.field === 'organization_id') {
        conditions.push(eq(entities.organizationId, String(resolvedValue)))
      } else if (filter.field.startsWith('data.')) {
        continue
      } else if (filter.field.startsWith('idx_')) {
        const mappedField = mapIndexField(filter.field)
        if (mappedField && filter.operator === 'eq') {
          conditions.push(eq(mappedField, resolvedValue as string | number))
        }
      }
    }
  }

  function resolveActorVariable(value: string, actor: ActorContext): unknown {
    const path = value.slice(7)
    if (path === 'userId') return actor.userId
    if (path === 'organizationId') return actor.organizationId
    if (path === 'roles') return actor.roles
    if (path.startsWith('attributes.')) {
      const attrPath = path.slice(11)
      return actor.attributes[attrPath]
    }
    return value
  }

  function mapIndexField(field: string) {
    switch (field) {
      case 'idx_0': return entities.idx0
      case 'idx_1': return entities.idx1
      case 'idx_2': return entities.idx2
      case 'idx_3': return entities.idx3
      case 'idx_num_0': return entities.idxNum0
      case 'idx_num_1': return entities.idxNum1
      default: return null
    }
  }

  routes.get('/', async (c) => {
    const auth = c.get('auth')
    const permissions = c.get('permissions')
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

    const resource = type || 'entity'

    let permissionResult: PermissionResult | null = null
    if (permissions) {
      permissionResult = await permissions.evaluator.evaluate(
        permissions.actor,
        resource,
        'list'
      )

      if (!permissionResult.allowed) {
        throw new AuthorizationError(permissionResult.reason)
      }
    }

    const conditions: ReturnType<typeof eq>[] = [
      eq(entities.organizationId, auth.organizationId),
      isNull(entities.deletedAt)
    ]

    if (permissionResult?.scopeFilters && permissions) {
      applyScopeFilters(conditions, permissionResult.scopeFilters, permissions.actor)
    }

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

    let resultEntities = entityList.map(e => ({
      ...e.entity,
      entityTypeName: e.entityTypeName,
      entityTypeSlug: e.entityTypeSlug
    }))

    if (permissionResult?.fieldMasks && permissionResult.fieldMasks.length > 0 && permissions) {
      resultEntities = permissions.masker.maskArray(
        resultEntities as Record<string, unknown>[],
        permissionResult.fieldMasks
      ) as typeof resultEntities
    }

    return c.json({
      entities: resultEntities,
      total: countResult[0]?.count || 0,
      limit,
      offset
    })
  })

  routes.post('/', async (c) => {
    const auth = c.get('auth')
    const permissions = c.get('permissions')
    const body = await c.req.json()
    const parsed = createEntitySchema.safeParse(body)

    if (!parsed.success) {
      throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
    }

    const { entityTypeSlug, status, data } = parsed.data

    if (permissions) {
      const permissionResult = await permissions.evaluator.evaluate(
        permissions.actor,
        entityTypeSlug,
        'create',
        data
      )

      if (!permissionResult.allowed) {
        throw new AuthorizationError(permissionResult.reason)
      }
    }

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
    const permissions = c.get('permissions')
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

    let permissionResult: PermissionResult | null = null
    if (permissions) {
      permissionResult = await permissions.evaluator.evaluate(
        permissions.actor,
        result.entityTypeSlug,
        'read',
        result.entity as unknown as Record<string, unknown>
      )

      if (!permissionResult.allowed) {
        throw new AuthorizationError(permissionResult.reason)
      }
    }

    const relations = await db
      .select()
      .from(entityRelations)
      .where(eq(entityRelations.fromEntityId, entityId))

    const reverseRelations = await db
      .select()
      .from(entityRelations)
      .where(eq(entityRelations.toEntityId, entityId))

    let responseEntity: Record<string, unknown> = {
      ...result.entity,
      entityTypeName: result.entityTypeName,
      entityTypeSlug: result.entityTypeSlug
    }

    if (permissionResult?.fieldMasks && permissionResult.fieldMasks.length > 0 && permissions) {
      responseEntity = permissions.masker.mask(responseEntity, permissionResult.fieldMasks)
    }

    return c.json({
      entity: responseEntity,
      relations,
      reverseRelations
    })
  })

  routes.patch('/:id', async (c) => {
    const auth = c.get('auth')
    const permissions = c.get('permissions')
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

    if (permissions) {
      const permissionResult = await permissions.evaluator.evaluate(
        permissions.actor,
        existing.entityType.slug,
        'update',
        existing.entity as unknown as Record<string, unknown>
      )

      if (!permissionResult.allowed) {
        throw new AuthorizationError(permissionResult.reason)
      }
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
    const permissions = c.get('permissions')
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

    if (permissions) {
      const permissionResult = await permissions.evaluator.evaluate(
        permissions.actor,
        existing.entityTypeSlug,
        'delete',
        existing.entity as unknown as Record<string, unknown>
      )

      if (!permissionResult.allowed) {
        throw new AuthorizationError(permissionResult.reason)
      }
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
    const permissions = c.get('permissions')
    const entityId = c.req.param('id')
    const db = createDb(c.env.DB)

    const [entity] = await db
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

    if (!entity) {
      throw new NotFoundError('Entity', entityId)
    }

    if (permissions) {
      const permissionResult = await permissions.evaluator.evaluate(
        permissions.actor,
        entity.entityTypeSlug,
        'read',
        entity.entity as unknown as Record<string, unknown>
      )

      if (!permissionResult.allowed) {
        throw new AuthorizationError(permissionResult.reason)
      }
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
    const permissions = c.get('permissions')
    const fromEntityId = c.req.param('id')
    const body = await c.req.json()
    const parsed = createRelationSchema.safeParse(body)

    if (!parsed.success) {
      throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
    }

    const { toEntityId, relationType, metadata } = parsed.data
    const db = createDb(c.env.DB)

    const [fromEntity] = await db
      .select({
        entity: entities,
        entityTypeSlug: entityTypes.slug
      })
      .from(entities)
      .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
      .where(and(
        eq(entities.id, fromEntityId),
        eq(entities.organizationId, auth.organizationId),
        isNull(entities.deletedAt)
      ))
      .limit(1)

    if (!fromEntity) {
      throw new NotFoundError('Entity', fromEntityId)
    }

    if (permissions) {
      const permissionResult = await permissions.evaluator.evaluate(
        permissions.actor,
        fromEntity.entityTypeSlug,
        'update',
        fromEntity.entity as unknown as Record<string, unknown>
      )

      if (!permissionResult.allowed) {
        throw new AuthorizationError(permissionResult.reason)
      }
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
    const permissions = c.get('permissions')
    const entityId = c.req.param('id')
    const relationId = c.req.param('relId')
    const db = createDb(c.env.DB)

    const [entityResult] = await db
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

    if (!entityResult) {
      throw new NotFoundError('Entity', entityId)
    }

    if (permissions) {
      const permissionResult = await permissions.evaluator.evaluate(
        permissions.actor,
        entityResult.entityTypeSlug,
        'update',
        entityResult.entity as unknown as Record<string, unknown>
      )

      if (!permissionResult.allowed) {
        throw new AuthorizationError(permissionResult.reason)
      }
    }

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
    const permissions = c.get('permissions')
    const entityId = c.req.param('id')
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')
    const db = createDb(c.env.DB)

    const [entityResult] = await db
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

    if (!entityResult) {
      throw new NotFoundError('Entity', entityId)
    }

    if (permissions) {
      const permissionResult = await permissions.evaluator.evaluate(
        permissions.actor,
        entityResult.entityTypeSlug,
        'read',
        entityResult.entity as unknown as Record<string, unknown>
      )

      if (!permissionResult.allowed) {
        throw new AuthorizationError(permissionResult.reason)
      }
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
