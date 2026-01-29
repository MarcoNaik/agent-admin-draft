import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  clerkId: text('clerk_id').unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan', { enum: ['free', 'pro', 'enterprise'] }).notNull().default('free'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  clerkId: text('clerk_id').unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
  clerkIdx: uniqueIndex('users_clerk_idx').on(table.clerkId),
  orgIdx: index('users_org_idx').on(table.organizationId)
}))

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  permissions: text('permissions', { mode: 'json' }).$type<string[]>().notNull(),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  keyHashIdx: uniqueIndex('api_keys_hash_idx').on(table.keyHash),
  orgIdx: index('api_keys_org_idx').on(table.organizationId)
}))

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  developmentVersionId: text('development_version_id'),
  productionVersionId: text('production_version_id'),
  status: text('status', { enum: ['active', 'paused', 'deleted'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  orgSlugIdx: uniqueIndex('agents_org_slug_idx').on(table.organizationId, table.slug),
  orgIdx: index('agents_org_idx').on(table.organizationId)
}))

export const agentVersions = sqliteTable('agent_versions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id),
  version: text('version').notNull(),
  bundleKey: text('bundle_key').notNull(),
  configHash: text('config_hash').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<{
    modelProvider: string
    modelName: string
    toolCount: number
    bundleSize: number
  }>().notNull(),
  status: text('status', { enum: ['deploying', 'active', 'failed', 'rolled_back'] }).notNull().default('deploying'),
  deployedAt: integer('deployed_at', { mode: 'timestamp' }).notNull(),
  deployedBy: text('deployed_by').notNull()
}, (table) => ({
  agentIdx: index('versions_agent_idx').on(table.agentId),
  agentVersionIdx: uniqueIndex('versions_agent_version_idx').on(table.agentId, table.version)
}))

export const deployments = sqliteTable('deployments', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id),
  versionId: text('version_id').notNull().references(() => agentVersions.id),
  environment: text('environment', { enum: ['development', 'production'] }).notNull(),
  url: text('url').notNull(),
  status: text('status', { enum: ['pending', 'active', 'failed', 'terminated'] }).notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  agentIdx: index('deployments_agent_idx').on(table.agentId),
  agentEnvIdx: index('deployments_agent_env_idx').on(table.agentId, table.environment)
}))

export const executions = sqliteTable('executions', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  agentId: text('agent_id').notNull().references(() => agents.id),
  versionId: text('version_id').notNull(),
  conversationId: text('conversation_id').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  durationMs: integer('duration_ms').notNull(),
  status: text('status', { enum: ['success', 'error', 'timeout'] }).notNull(),
  errorMessage: text('error_message'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull()
}, (table) => ({
  orgIdx: index('executions_org_idx').on(table.organizationId),
  agentIdx: index('executions_agent_idx').on(table.agentId),
  timestampIdx: index('executions_timestamp_idx').on(table.timestamp)
}))

export const devSessions = sqliteTable('dev_sessions', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  agentId: text('agent_id').notNull().references(() => agents.id),
  userId: text('user_id').notNull().references(() => users.id),
  bundleKey: text('bundle_key'),
  configHash: text('config_hash'),
  status: text('status', { enum: ['connected', 'disconnected'] }).notNull().default('connected'),
  previewUrl: text('preview_url').notNull(),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  agentIdx: index('dev_sessions_agent_idx').on(table.agentId),
  userIdx: index('dev_sessions_user_idx').on(table.userId)
}))

export const entityTypes = sqliteTable('entity_types', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  schema: text('schema', { mode: 'json' }).$type<EntityTypeSchemaJson>().notNull(),
  indexMapping: text('index_mapping', { mode: 'json' }).$type<IndexMappingJson>(),
  searchFields: text('search_fields', { mode: 'json' }).$type<string[]>(),
  displayConfig: text('display_config', { mode: 'json' }).$type<DisplayConfigJson>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  orgSlugIdx: uniqueIndex('entity_types_org_slug_idx').on(table.organizationId, table.slug)
}))

export const entities = sqliteTable('entities', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  entityTypeId: text('entity_type_id').notNull().references(() => entityTypes.id),
  status: text('status').notNull().default('active'),
  data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  searchText: text('search_text'),
  idx0: text('idx_0'),
  idx1: text('idx_1'),
  idx2: text('idx_2'),
  idx3: text('idx_3'),
  idxNum0: integer('idx_num_0'),
  idxNum1: integer('idx_num_1'),
  idxDate0: integer('idx_date_0', { mode: 'timestamp' }),
  idxDate1: integer('idx_date_1', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' })
}, (table) => ({
  orgTypeStatusIdx: index('entities_org_type_status_idx').on(table.organizationId, table.entityTypeId, table.status),
  idx0Idx: index('entities_idx0_idx').on(table.idx0),
  idx1Idx: index('entities_idx1_idx').on(table.idx1),
  idxDate0Idx: index('entities_idx_date0_idx').on(table.idxDate0),
  searchIdx: index('entities_search_idx').on(table.searchText)
}))

export const entityRelations = sqliteTable('entity_relations', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  fromEntityId: text('from_entity_id').notNull().references(() => entities.id),
  toEntityId: text('to_entity_id').notNull().references(() => entities.id),
  relationType: text('relation_type').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  fromTypeIdx: index('relations_from_type_idx').on(table.fromEntityId, table.relationType),
  toTypeIdx: index('relations_to_type_idx').on(table.toEntityId, table.relationType),
  uniqueRelation: uniqueIndex('relations_unique_idx').on(table.fromEntityId, table.toEntityId, table.relationType)
}))

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  entityId: text('entity_id').references(() => entities.id),
  entityTypeSlug: text('entity_type_slug'),
  eventType: text('event_type').notNull(),
  schemaVersion: integer('schema_version').notNull().default(1),
  actorId: text('actor_id'),
  actorType: text('actor_type', { enum: ['user', 'agent', 'system', 'webhook'] }).notNull(),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull()
}, (table) => ({
  entityTimestampIdx: index('events_entity_timestamp_idx').on(table.entityId, table.timestamp),
  orgTypeTimestampIdx: index('events_org_type_timestamp_idx').on(table.organizationId, table.eventType, table.timestamp)
}))

export interface EntityTypeSchemaJson {
  type: 'object'
  properties: Record<string, {
    type: string
    format?: string
    minLength?: number
    maxLength?: number
    minimum?: number
    maximum?: number
    pattern?: string
    enum?: string[]
    items?: { type: string }
    default?: unknown
    description?: string
    properties?: Record<string, unknown>
  }>
  required?: string[]
}

export interface IndexMappingJson {
  idx_0?: string
  idx_1?: string
  idx_2?: string
  idx_3?: string
  idx_num_0?: string
  idx_num_1?: string
  idx_date_0?: string
  idx_date_1?: string
}

export interface DisplayConfigJson {
  titleField: string | string[]
  subtitleField?: string
  listFields?: string[]
  detailSections?: Array<{
    title: string
    fields: string[]
  }>
}

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  isSystem: integer('is_system', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  orgNameIdx: uniqueIndex('roles_org_name_idx').on(table.organizationId, table.name)
}))

export const policies = sqliteTable('policies', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  roleId: text('role_id').notNull().references(() => roles.id),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  effect: text('effect', { enum: ['allow', 'deny'] }).notNull().default('allow'),
  priority: integer('priority').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  roleIdx: index('policies_role_idx').on(table.roleId),
  orgResourceIdx: index('policies_org_resource_idx').on(table.organizationId, table.resource)
}))

export const scopeRules = sqliteTable('scope_rules', {
  id: text('id').primaryKey(),
  policyId: text('policy_id').notNull().references(() => policies.id),
  type: text('type', { enum: ['field', 'relation'] }).notNull(),
  field: text('field'),
  operator: text('operator'),
  value: text('value'),
  relationPath: text('relation_path'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  policyIdx: index('scope_rules_policy_idx').on(table.policyId)
}))

export const fieldMasks = sqliteTable('field_masks', {
  id: text('id').primaryKey(),
  policyId: text('policy_id').notNull().references(() => policies.id),
  fieldPath: text('field_path').notNull(),
  maskType: text('mask_type', { enum: ['hide', 'redact'] }).notNull(),
  maskConfig: text('mask_config', { mode: 'json' }).$type<FieldMaskConfigJson>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  policyIdx: index('field_masks_policy_idx').on(table.policyId)
}))

export const userRoles = sqliteTable('user_roles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  roleId: text('role_id').notNull().references(() => roles.id),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  grantedBy: text('granted_by').references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  userIdx: index('user_roles_user_idx').on(table.userId),
  roleIdx: index('user_roles_role_idx').on(table.roleId),
  userRoleResourceIdx: uniqueIndex('user_roles_user_role_resource_idx').on(table.userId, table.roleId, table.resourceType, table.resourceId)
}))

export interface FieldMaskConfigJson {
  pattern?: string
  replacement?: string
}

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  entityId: text('entity_id').references(() => entities.id),
  jobType: text('job_type').notNull(),
  idempotencyKey: text('idempotency_key'),
  status: text('status', {
    enum: ['pending', 'claimed', 'running', 'completed', 'failed', 'dead']
  }).notNull().default('pending'),
  priority: integer('priority').notNull().default(0),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  result: text('result', { mode: 'json' }).$type<Record<string, unknown>>(),
  errorMessage: text('error_message'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  claimedBy: text('claimed_by'),
  claimedAt: integer('claimed_at', { mode: 'timestamp' }),
  scheduledFor: integer('scheduled_for', { mode: 'timestamp' }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  pendingIdx: index('jobs_pending_idx').on(table.status, table.scheduledFor, table.priority),
  idempotencyIdx: uniqueIndex('jobs_idempotency_idx').on(table.organizationId, table.idempotencyKey),
  orgIdx: index('jobs_org_idx').on(table.organizationId),
  entityIdx: index('jobs_entity_idx').on(table.entityId),
  typeIdx: index('jobs_type_idx').on(table.jobType)
}))

export const toolPermissions = sqliteTable('tool_permissions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id),
  toolName: text('tool_name').notNull(),
  identityMode: text('identity_mode', { enum: ['inherit', 'system', 'configured'] }).notNull().default('inherit'),
  configuredRoleId: text('configured_role_id').references(() => roles.id),
  allowedActions: text('allowed_actions', { mode: 'json' }).$type<string[]>(),
  deniedFields: text('denied_fields', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  agentToolIdx: uniqueIndex('tool_permissions_agent_tool_idx').on(table.agentId, table.toolName),
  agentIdx: index('tool_permissions_agent_idx').on(table.agentId)
}))
