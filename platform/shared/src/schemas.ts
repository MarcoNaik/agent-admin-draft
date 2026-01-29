import { z } from 'zod'

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/)
})

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100)
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum(['agent:read', 'agent:write', 'agent:execute', 'agent:deploy'])),
  expiresAt: z.string().datetime().optional()
})

export const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional()
})

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'paused']).optional()
})

export const deployAgentSchema = z.object({
  bundle: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  environment: z.enum(['development', 'production']).default('production'),
  metadata: z.object({
    modelProvider: z.string(),
    modelName: z.string(),
    toolCount: z.number(),
    bundleSize: z.number()
  })
})

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(100000),
  conversationId: z.string().optional(),
  userId: z.string().optional(),
  stream: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional()
})

export const syncMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('auth'),
    apiKey: z.string()
  }),
  z.object({
    type: z.literal('sync'),
    agentSlug: z.string(),
    bundle: z.string(),
    configHash: z.string()
  }),
  z.object({
    type: z.literal('ping')
  }),
  z.object({
    type: z.literal('unsync')
  })
])

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>
export type CreateAgentInput = z.infer<typeof createAgentSchema>
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>
export type DeployAgentInput = z.infer<typeof deployAgentSchema>
export type ChatRequestInput = z.infer<typeof chatRequestSchema>
export type SyncMessageInput = z.infer<typeof syncMessageSchema>

const entityTypeSchemaPropertySchema: z.ZodType<Record<string, unknown>> = z.object({
  type: z.string(),
  format: z.string().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  pattern: z.string().optional(),
  enum: z.array(z.string()).optional(),
  items: z.object({ type: z.string() }).optional(),
  default: z.unknown().optional(),
  description: z.string().optional(),
  properties: z.record(z.unknown()).optional()
}).passthrough()

const entityTypeSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(entityTypeSchemaPropertySchema),
  required: z.array(z.string()).optional()
})

const indexMappingSchema = z.object({
  idx_0: z.string().optional(),
  idx_1: z.string().optional(),
  idx_2: z.string().optional(),
  idx_3: z.string().optional(),
  idx_num_0: z.string().optional(),
  idx_num_1: z.string().optional(),
  idx_date_0: z.string().optional(),
  idx_date_1: z.string().optional()
}).optional()

const displayConfigSectionSchema = z.object({
  title: z.string(),
  fields: z.array(z.string())
})

const displayConfigSchema = z.object({
  titleField: z.union([z.string(), z.array(z.string())]),
  subtitleField: z.string().optional(),
  listFields: z.array(z.string()).optional(),
  detailSections: z.array(displayConfigSectionSchema).optional()
}).optional()

export const createEntityTypeSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  schema: entityTypeSchemaSchema,
  indexMapping: indexMappingSchema,
  searchFields: z.array(z.string()).optional(),
  displayConfig: displayConfigSchema
})

export const updateEntityTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  schema: entityTypeSchemaSchema.optional(),
  indexMapping: indexMappingSchema,
  searchFields: z.array(z.string()).optional(),
  displayConfig: displayConfigSchema
})

export const createEntitySchema = z.object({
  entityTypeSlug: z.string().min(1).max(50),
  status: z.string().optional(),
  data: z.record(z.unknown())
})

export const updateEntitySchema = z.object({
  status: z.string().optional(),
  data: z.record(z.unknown()).optional()
})

export const createRelationSchema = z.object({
  toEntityId: z.string(),
  relationType: z.string().min(1).max(100),
  metadata: z.record(z.unknown()).optional()
})

export const emitEventSchema = z.object({
  entityId: z.string().optional(),
  entityTypeSlug: z.string().optional(),
  eventType: z.string().min(1).max(200),
  schemaVersion: z.number().int().positive().default(1),
  payload: z.record(z.unknown())
})

export const queryEventsSchema = z.object({
  entityId: z.string().optional(),
  eventType: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0)
})

export const queryEntitiesSchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  idx_0: z.string().optional(),
  idx_1: z.string().optional(),
  idx_2: z.string().optional(),
  idx_3: z.string().optional(),
  idx_num_0: z.coerce.number().optional(),
  idx_num_1: z.coerce.number().optional(),
  idx_date_0_gte: z.string().datetime().optional(),
  idx_date_0_lte: z.string().datetime().optional(),
  idx_date_1_gte: z.string().datetime().optional(),
  idx_date_1_lte: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0)
})

export type CreateEntityTypeInput = z.infer<typeof createEntityTypeSchema>
export type UpdateEntityTypeInput = z.infer<typeof updateEntityTypeSchema>
export type CreateEntityInput = z.infer<typeof createEntitySchema>
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>
export type CreateRelationInput = z.infer<typeof createRelationSchema>
export type EmitEventInput = z.infer<typeof emitEventSchema>
export type QueryEventsInput = z.infer<typeof queryEventsSchema>
export type QueryEntitiesInput = z.infer<typeof queryEntitiesSchema>

export const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
})

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional()
})

const scopeRuleSchema = z.object({
  type: z.enum(['field', 'relation']),
  field: z.string().optional(),
  operator: z.enum(['eq', 'neq', 'in', 'nin', 'contains', 'exists', 'gt', 'gte', 'lt', 'lte']).optional(),
  value: z.string().optional(),
  relationPath: z.string().optional()
})

const fieldMaskSchema = z.object({
  fieldPath: z.string(),
  maskType: z.enum(['hide', 'redact']),
  maskConfig: z.object({
    pattern: z.string().optional(),
    replacement: z.string().optional()
  }).optional()
})

export const createPolicySchema = z.object({
  roleId: z.string(),
  resource: z.string().min(1).max(100),
  action: z.enum(['create', 'read', 'update', 'delete', 'list', '*']),
  effect: z.enum(['allow', 'deny']).default('allow'),
  priority: z.number().int().default(0),
  scopeRules: z.array(scopeRuleSchema).optional(),
  fieldMasks: z.array(fieldMaskSchema).optional()
})

export const createUserRoleSchema = z.object({
  userId: z.string(),
  roleId: z.string(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  expiresAt: z.string().datetime().optional()
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
export type CreatePolicyInput = z.infer<typeof createPolicySchema>
export type CreateUserRoleInput = z.infer<typeof createUserRoleSchema>

export const createJobSchema = z.object({
  jobType: z.string().min(1).max(100),
  entityId: z.string().optional(),
  idempotencyKey: z.string().max(255).optional(),
  priority: z.number().int().min(-100).max(100).default(0),
  payload: z.record(z.unknown()),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  scheduledFor: z.string().datetime().optional()
})

export const updateJobSchema = z.object({
  status: z.enum(['pending', 'claimed', 'running', 'completed', 'failed', 'dead']).optional(),
  result: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional()
})

export const queryJobsSchema = z.object({
  status: z.enum(['pending', 'claimed', 'running', 'completed', 'failed', 'dead']).optional(),
  jobType: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0)
})

export type CreateJobInput = z.infer<typeof createJobSchema>
export type UpdateJobInput = z.infer<typeof updateJobSchema>
export type QueryJobsInput = z.infer<typeof queryJobsSchema>
