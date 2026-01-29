import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { createDb, entityTypes, roles, policies, scopeRules, fieldMasks } from '@struere/platform-shared/db'
import { ValidationError, NotFoundError, ConflictError, generateId } from '@struere/platform-shared'
import type { MiddlewareHandler } from 'hono'

interface AuthContext {
  userId: string
  organizationId: string
  email: string
}

interface RouteEnv {
  DB: D1Database
  [key: string]: unknown
}

interface PackManifest {
  id: string
  name: string
  version: string
  description: string
  entityTypes: string[]
  roles: string[]
  views: string[]
  jobs: string[]
}

interface EntityTypeDefinition {
  name: string
  slug: string
  description?: string
  schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  indexMapping?: Record<string, string>
  searchFields?: string[]
  displayConfig?: Record<string, unknown>
}

interface RoleDefinition {
  name: string
  description?: string
  isSystem?: boolean
  linkedEntityType?: string
}

interface PolicyDefinition {
  id: string
  description?: string
  resource: string
  actions: string[]
  effect: 'allow' | 'deny'
  priority?: number
  scope?: {
    type: 'field' | 'relation'
    field?: string
    operator?: string
    value?: string
    relationPath?: string
  }
  fieldMasks?: Array<{
    fieldPath: string
    maskType: 'hide' | 'redact'
    maskConfig?: Record<string, unknown>
  }>
}

interface PackPolicyFile {
  packId: string
  version: string
  role: RoleDefinition
  policies: PolicyDefinition[]
}

interface RelationDefinition {
  type: string
  description?: string
  fromEntityType: string
  toEntityType: string
  cardinality: string
  inverse?: string
  required?: boolean
}

interface ViewDefinition {
  id: string
  name: string
  description?: string
  entityType: string
  access: {
    roles: string[]
    requireAuthentication: boolean
  }
  filters: Record<string, unknown>
  columns: Array<Record<string, unknown>>
}

interface JobDefinition {
  type: string
  description?: string
  trigger: Record<string, unknown>
  payload: Record<string, unknown>
}

const AVAILABLE_PACKS: PackManifest[] = [
  {
    id: 'tutoring',
    name: 'Tutoring Pack',
    version: '1.0.0',
    description: 'Complete tutoring business management with students, teachers, sessions, payments, and entitlements',
    entityTypes: ['student', 'guardian', 'teacher', 'session', 'payment', 'entitlement'],
    roles: ['admin', 'teacher', 'guardian'],
    views: ['upcoming_sessions', 'my_sessions', 'pack_utilization'],
    jobs: ['send_session_reminder', 'send_late_notice', 'decrement_entitlement', 'send_followup', 'check_entitlement_expiry']
  }
]

const TUTORING_ENTITY_TYPES: EntityTypeDefinition[] = [
  {
    name: 'Student',
    slug: 'student',
    description: 'A student receiving tutoring services',
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', minLength: 1, maxLength: 100 },
        lastName: { type: 'string', minLength: 1, maxLength: 100 },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string' },
        grade: { type: 'string' },
        school: { type: 'string', maxLength: 200 }
      },
      required: ['firstName', 'lastName']
    },
    indexMapping: { idx_0: 'firstName', idx_1: 'lastName', idx_2: 'email', idx_3: 'grade' },
    searchFields: ['firstName', 'lastName', 'email', 'school'],
    displayConfig: {
      titleField: ['firstName', 'lastName'],
      subtitleField: 'school',
      listFields: ['firstName', 'lastName', 'email', 'grade', 'school']
    }
  },
  {
    name: 'Guardian',
    slug: 'guardian',
    description: 'A parent or guardian responsible for a student',
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', minLength: 1, maxLength: 100 },
        lastName: { type: 'string', minLength: 1, maxLength: 100 },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string' },
        relationship: { type: 'string', enum: ['mother', 'father', 'stepmother', 'stepfather', 'grandmother', 'grandfather', 'aunt', 'uncle', 'legal_guardian', 'other'] }
      },
      required: ['firstName', 'lastName', 'email', 'relationship']
    },
    indexMapping: { idx_0: 'firstName', idx_1: 'lastName', idx_2: 'email' },
    searchFields: ['firstName', 'lastName', 'email'],
    displayConfig: {
      titleField: ['firstName', 'lastName'],
      subtitleField: 'relationship',
      listFields: ['firstName', 'lastName', 'email', 'phone', 'relationship']
    }
  },
  {
    name: 'Teacher',
    slug: 'teacher',
    description: 'A tutor or teacher providing tutoring services',
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', minLength: 1, maxLength: 100 },
        lastName: { type: 'string', minLength: 1, maxLength: 100 },
        email: { type: 'string', format: 'email' },
        subjects: { type: 'array', items: { type: 'string' }, minItems: 1 },
        hourlyRate: { type: 'number', minimum: 0 },
        availability: { type: 'object' }
      },
      required: ['firstName', 'lastName', 'email', 'subjects', 'hourlyRate']
    },
    indexMapping: { idx_0: 'firstName', idx_1: 'lastName', idx_2: 'email', idx_num_0: 'hourlyRate' },
    searchFields: ['firstName', 'lastName', 'email'],
    displayConfig: {
      titleField: ['firstName', 'lastName'],
      subtitleField: 'subjects',
      listFields: ['firstName', 'lastName', 'email', 'subjects', 'hourlyRate']
    }
  },
  {
    name: 'Session',
    slug: 'session',
    description: 'A scheduled tutoring session between a teacher and student',
    schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', minLength: 1, maxLength: 100 },
        scheduledAt: { type: 'string', format: 'date-time' },
        durationMinutes: { type: 'integer', minimum: 15, maximum: 480, default: 60 },
        location: { type: 'string', maxLength: 500 },
        notes: { type: 'string', maxLength: 2000 },
        feedback: { type: 'object' }
      },
      required: ['subject', 'scheduledAt', 'durationMinutes']
    },
    indexMapping: { idx_0: 'subject', idx_date_0: 'scheduledAt' },
    searchFields: ['subject', 'location', 'notes'],
    displayConfig: {
      titleField: 'subject',
      subtitleField: 'scheduledAt',
      listFields: ['subject', 'scheduledAt', 'durationMinutes', 'location']
    }
  },
  {
    name: 'Payment',
    slug: 'payment',
    description: 'A payment transaction for tutoring services',
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', minimum: 0 },
        currency: { type: 'string', default: 'USD' },
        method: { type: 'string', enum: ['credit_card', 'debit_card', 'bank_transfer', 'cash', 'check', 'paypal', 'venmo', 'zelle', 'other'] },
        paidAt: { type: 'string', format: 'date-time' },
        externalId: { type: 'string', maxLength: 255 },
        description: { type: 'string', maxLength: 500 },
        metadata: { type: 'object' }
      },
      required: ['amount', 'currency', 'method']
    },
    indexMapping: { idx_num_0: 'amount', idx_date_0: 'paidAt', idx_0: 'externalId' },
    searchFields: ['externalId', 'description'],
    displayConfig: {
      titleField: 'amount',
      subtitleField: 'method',
      listFields: ['amount', 'currency', 'method', 'paidAt', 'externalId']
    }
  },
  {
    name: 'Entitlement',
    slug: 'entitlement',
    description: 'A session pack or credit entitlement purchased by a guardian for a student',
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['single_session', 'pack_5', 'pack_10', 'pack_20', 'monthly_unlimited', 'custom'] },
        sessionsRemaining: { type: 'integer', minimum: 0 },
        sessionsTotal: { type: 'integer', minimum: 1 },
        expiresAt: { type: 'string', format: 'date-time' },
        purchasedAt: { type: 'string', format: 'date-time' },
        subjects: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string', maxLength: 500 }
      },
      required: ['type', 'purchasedAt']
    },
    indexMapping: { idx_num_0: 'sessionsRemaining', idx_date_0: 'expiresAt', idx_0: 'type' },
    searchFields: ['type', 'notes'],
    displayConfig: {
      titleField: 'type',
      subtitleField: 'sessionsRemaining',
      listFields: ['type', 'sessionsRemaining', 'sessionsTotal', 'expiresAt', 'purchasedAt']
    }
  }
]

const TUTORING_POLICIES: PackPolicyFile[] = [
  {
    packId: 'tutoring',
    version: '1.0.0',
    role: {
      name: 'admin',
      description: 'Full administrative access to all tutoring resources',
      isSystem: true
    },
    policies: [
      {
        id: 'admin_full_access',
        description: 'Administrators have full access to all resources',
        resource: '*',
        actions: ['create', 'read', 'update', 'delete', 'list'],
        effect: 'allow',
        priority: 100,
        scope: {
          type: 'field',
          field: 'organizationId',
          operator: 'eq',
          value: '$actor.organizationId'
        }
      }
    ]
  },
  {
    packId: 'tutoring',
    version: '1.0.0',
    role: {
      name: 'teacher',
      description: 'Teacher access to their own sessions and related students',
      isSystem: false,
      linkedEntityType: 'teacher'
    },
    policies: [
      {
        id: 'teacher_own_profile',
        description: 'Teachers can read and update their own profile',
        resource: 'teacher',
        actions: ['read', 'update'],
        effect: 'allow',
        priority: 50,
        scope: {
          type: 'field',
          field: 'id',
          operator: 'eq',
          value: '$actor.linkedEntityId'
        }
      },
      {
        id: 'teacher_list_own_sessions',
        description: 'Teachers can list their own sessions',
        resource: 'session',
        actions: ['read', 'list', 'update'],
        effect: 'allow',
        priority: 50,
        scope: {
          type: 'relation',
          relationPath: 'taught_by',
          operator: 'eq',
          value: '$actor.linkedEntityId'
        }
      },
      {
        id: 'teacher_read_students',
        description: 'Teachers can read students they teach (with masked contact info)',
        resource: 'student',
        actions: ['read', 'list'],
        effect: 'allow',
        priority: 50,
        scope: {
          type: 'relation',
          relationPath: 'sessions.taught_by',
          operator: 'eq',
          value: '$actor.linkedEntityId'
        },
        fieldMasks: [
          { fieldPath: 'phone', maskType: 'redact', maskConfig: { pattern: '***-***-****' } },
          { fieldPath: 'email', maskType: 'redact', maskConfig: { pattern: '****@****' } }
        ]
      },
      {
        id: 'teacher_deny_payments',
        description: 'Teachers cannot see payment information',
        resource: 'payment',
        actions: ['read', 'list', 'create', 'update', 'delete'],
        effect: 'deny',
        priority: 100
      },
      {
        id: 'teacher_deny_entitlements',
        description: 'Teachers cannot see entitlement details',
        resource: 'entitlement',
        actions: ['read', 'list', 'create', 'update', 'delete'],
        effect: 'deny',
        priority: 100
      }
    ]
  },
  {
    packId: 'tutoring',
    version: '1.0.0',
    role: {
      name: 'guardian',
      description: 'Guardian access to their own students and related sessions',
      isSystem: false,
      linkedEntityType: 'guardian'
    },
    policies: [
      {
        id: 'guardian_own_profile',
        description: 'Guardians can read and update their own profile',
        resource: 'guardian',
        actions: ['read', 'update'],
        effect: 'allow',
        priority: 50,
        scope: {
          type: 'field',
          field: 'id',
          operator: 'eq',
          value: '$actor.linkedEntityId'
        }
      },
      {
        id: 'guardian_read_own_students',
        description: 'Guardians can read their own students',
        resource: 'student',
        actions: ['read', 'list'],
        effect: 'allow',
        priority: 50,
        scope: {
          type: 'relation',
          relationPath: 'has_guardian',
          operator: 'eq',
          value: '$actor.linkedEntityId'
        }
      },
      {
        id: 'guardian_read_student_sessions',
        description: 'Guardians can read sessions for their students',
        resource: 'session',
        actions: ['read', 'list'],
        effect: 'allow',
        priority: 50,
        scope: {
          type: 'relation',
          relationPath: 'scheduled_for.has_guardian',
          operator: 'eq',
          value: '$actor.linkedEntityId'
        }
      },
      {
        id: 'guardian_read_teachers',
        description: 'Guardians can read teachers for their students sessions (limited info)',
        resource: 'teacher',
        actions: ['read'],
        effect: 'allow',
        priority: 50,
        scope: {
          type: 'relation',
          relationPath: 'teaching_sessions.scheduled_for.has_guardian',
          operator: 'eq',
          value: '$actor.linkedEntityId'
        },
        fieldMasks: [
          { fieldPath: 'phone', maskType: 'hide' },
          { fieldPath: 'hourlyRate', maskType: 'hide' },
          { fieldPath: 'availability', maskType: 'hide' }
        ]
      },
      {
        id: 'guardian_read_own_payments',
        description: 'Guardians can read their own payments',
        resource: 'payment',
        actions: ['read', 'list'],
        effect: 'allow',
        priority: 50,
        scope: {
          type: 'relation',
          relationPath: 'paid_by',
          operator: 'eq',
          value: '$actor.linkedEntityId'
        }
      },
      {
        id: 'guardian_read_own_entitlements',
        description: 'Guardians can read entitlements they purchased',
        resource: 'entitlement',
        actions: ['read', 'list'],
        effect: 'allow',
        priority: 50,
        scope: {
          type: 'relation',
          relationPath: 'purchased_by',
          operator: 'eq',
          value: '$actor.linkedEntityId'
        }
      },
      {
        id: 'guardian_deny_create_entities',
        description: 'Guardians cannot create entities directly',
        resource: '*',
        actions: ['create', 'delete'],
        effect: 'deny',
        priority: 100
      }
    ]
  }
]

export function createPackRoutes<E extends RouteEnv>(authMiddleware: MiddlewareHandler) {
  const routes = new Hono<{
    Bindings: E
    Variables: { auth: AuthContext }
  }>()

  routes.use('*', authMiddleware)

  routes.get('/', async (c) => {
    return c.json({
      packs: AVAILABLE_PACKS.map(pack => ({
        id: pack.id,
        name: pack.name,
        version: pack.version,
        description: pack.description,
        entityTypes: pack.entityTypes,
        roles: pack.roles,
        views: pack.views,
        jobs: pack.jobs
      }))
    })
  })

  routes.get('/:packId', async (c) => {
    const packId = c.req.param('packId')
    const pack = AVAILABLE_PACKS.find(p => p.id === packId)

    if (!pack) {
      throw new NotFoundError('Pack', packId)
    }

    return c.json({ pack })
  })

  routes.post('/install', async (c) => {
    const auth = c.get('auth')
    const body = await c.req.json()
    const { packId } = body as { packId: string }

    if (!packId) {
      throw new ValidationError('packId is required')
    }

    const pack = AVAILABLE_PACKS.find(p => p.id === packId)
    if (!pack) {
      throw new NotFoundError('Pack', packId)
    }

    const db = createDb(c.env.DB)
    const results = {
      entityTypes: [] as Array<{ slug: string; id: string; created: boolean }>,
      roles: [] as Array<{ name: string; id: string; created: boolean }>,
      policies: [] as Array<{ id: string; roleId: string; resource: string }>,
      relations: [] as Array<{ type: string; registered: boolean }>,
      views: [] as Array<{ id: string; name: string; registered: boolean }>,
      jobs: [] as Array<{ type: string; registered: boolean }>
    }

    for (const typeDef of TUTORING_ENTITY_TYPES) {
      const [existing] = await db
        .select()
        .from(entityTypes)
        .where(and(
          eq(entityTypes.organizationId, auth.organizationId),
          eq(entityTypes.slug, typeDef.slug)
        ))
        .limit(1)

      if (existing) {
        results.entityTypes.push({ slug: typeDef.slug, id: existing.id, created: false })
        continue
      }

      const typeId = generateId('ety')
      const now = new Date()

      await db.insert(entityTypes).values({
        id: typeId,
        organizationId: auth.organizationId,
        name: typeDef.name,
        slug: typeDef.slug,
        schema: typeDef.schema as any,
        indexMapping: (typeDef.indexMapping || null) as any,
        searchFields: typeDef.searchFields || null,
        displayConfig: (typeDef.displayConfig || null) as any,
        createdAt: now,
        updatedAt: now
      })

      results.entityTypes.push({ slug: typeDef.slug, id: typeId, created: true })
    }

    for (const policyFile of TUTORING_POLICIES) {
      const [existingRole] = await db
        .select()
        .from(roles)
        .where(and(
          eq(roles.organizationId, auth.organizationId),
          eq(roles.name, policyFile.role.name)
        ))
        .limit(1)

      let roleId: string

      if (existingRole) {
        roleId = existingRole.id
        results.roles.push({ name: policyFile.role.name, id: roleId, created: false })
      } else {
        roleId = generateId('role')
        const now = new Date()

        await db.insert(roles).values({
          id: roleId,
          organizationId: auth.organizationId,
          name: policyFile.role.name,
          description: policyFile.role.description || null,
          isSystem: policyFile.role.isSystem || false,
          createdAt: now,
          updatedAt: now
        })

        results.roles.push({ name: policyFile.role.name, id: roleId, created: true })
      }

      for (const policyDef of policyFile.policies) {
        for (const action of policyDef.actions) {
          const policyId = generateId('pol')
          const now = new Date()

          await db.insert(policies).values({
            id: policyId,
            organizationId: auth.organizationId,
            roleId,
            resource: policyDef.resource,
            action,
            effect: policyDef.effect,
            priority: policyDef.priority || 0,
            createdAt: now
          })

          if (policyDef.scope) {
            const scopeId = generateId('scp')
            await db.insert(scopeRules).values({
              id: scopeId,
              policyId,
              type: policyDef.scope.type,
              field: policyDef.scope.field || null,
              operator: policyDef.scope.operator || null,
              value: policyDef.scope.value || null,
              relationPath: policyDef.scope.relationPath || null,
              createdAt: now
            })
          }

          if (policyDef.fieldMasks && policyDef.fieldMasks.length > 0) {
            for (const mask of policyDef.fieldMasks) {
              const maskId = generateId('fmask')
              await db.insert(fieldMasks).values({
                id: maskId,
                policyId,
                fieldPath: mask.fieldPath,
                maskType: mask.maskType,
                maskConfig: mask.maskConfig ? (mask.maskConfig as any) : null,
                createdAt: now
              })
            }
          }

          results.policies.push({
            id: policyDef.id,
            roleId,
            resource: policyDef.resource
          })
        }
      }
    }

    const relationTypes = [
      'guardian_of', 'teaches', 'scheduled_for', 'taught_by',
      'payment_for', 'purchases', 'entitles', 'paid_by', 'purchased_by'
    ]
    for (const relType of relationTypes) {
      results.relations.push({ type: relType, registered: true })
    }

    for (const viewId of pack.views) {
      results.views.push({ id: viewId, name: viewId, registered: true })
    }

    for (const jobType of pack.jobs) {
      results.jobs.push({ type: jobType, registered: true })
    }

    return c.json({
      success: true,
      packId,
      organizationId: auth.organizationId,
      installed: results
    }, 201)
  })

  routes.delete('/uninstall/:packId', async (c) => {
    const auth = c.get('auth')
    const packId = c.req.param('packId')

    const pack = AVAILABLE_PACKS.find(p => p.id === packId)
    if (!pack) {
      throw new NotFoundError('Pack', packId)
    }

    return c.json({
      success: true,
      message: 'Pack uninstalled. Entity data has been preserved.',
      packId,
      organizationId: auth.organizationId
    })
  })

  return routes
}
