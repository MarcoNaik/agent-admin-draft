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
