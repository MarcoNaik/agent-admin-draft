-- Business Layer Tables Migration

-- Entity Types
CREATE TABLE IF NOT EXISTS entity_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  schema TEXT NOT NULL,
  index_mapping TEXT,
  search_fields TEXT,
  display_config TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_types_org_slug_idx ON entity_types(organization_id, slug);
CREATE INDEX IF NOT EXISTS entity_types_org_idx ON entity_types(organization_id);

-- Entities
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  entity_type_id TEXT NOT NULL REFERENCES entity_types(id),
  status TEXT NOT NULL DEFAULT 'active',
  data TEXT NOT NULL,
  search_text TEXT,
  idx_0 TEXT,
  idx_1 TEXT,
  idx_2 TEXT,
  idx_3 TEXT,
  idx_num_0 INTEGER,
  idx_num_1 INTEGER,
  idx_date_0 INTEGER,
  idx_date_1 INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS entities_org_idx ON entities(organization_id);
CREATE INDEX IF NOT EXISTS entities_type_idx ON entities(entity_type_id);
CREATE INDEX IF NOT EXISTS entities_org_type_idx ON entities(organization_id, entity_type_id);
CREATE INDEX IF NOT EXISTS entities_status_idx ON entities(status);
CREATE INDEX IF NOT EXISTS entities_org_type_status_idx ON entities(organization_id, entity_type_id, status);
CREATE INDEX IF NOT EXISTS entities_idx0_idx ON entities(idx_0);
CREATE INDEX IF NOT EXISTS entities_idx1_idx ON entities(idx_1);
CREATE INDEX IF NOT EXISTS entities_idx2_idx ON entities(idx_2);
CREATE INDEX IF NOT EXISTS entities_idx3_idx ON entities(idx_3);
CREATE INDEX IF NOT EXISTS entities_idx_num0_idx ON entities(idx_num_0);
CREATE INDEX IF NOT EXISTS entities_idx_num1_idx ON entities(idx_num_1);
CREATE INDEX IF NOT EXISTS entities_idx_date0_idx ON entities(idx_date_0);
CREATE INDEX IF NOT EXISTS entities_idx_date1_idx ON entities(idx_date_1);
CREATE INDEX IF NOT EXISTS entities_search_idx ON entities(search_text);

-- Entity Relations
CREATE TABLE IF NOT EXISTS entity_relations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  from_entity_id TEXT NOT NULL REFERENCES entities(id),
  to_entity_id TEXT NOT NULL REFERENCES entities(id),
  relation_type TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS relations_from_idx ON entity_relations(from_entity_id);
CREATE INDEX IF NOT EXISTS relations_to_idx ON entity_relations(to_entity_id);
CREATE INDEX IF NOT EXISTS relations_type_idx ON entity_relations(relation_type);
CREATE INDEX IF NOT EXISTS relations_from_type_idx ON entity_relations(from_entity_id, relation_type);
CREATE INDEX IF NOT EXISTS relations_to_type_idx ON entity_relations(to_entity_id, relation_type);
CREATE UNIQUE INDEX IF NOT EXISTS relations_unique_idx ON entity_relations(from_entity_id, to_entity_id, relation_type);

-- Events (Audit Log)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  entity_id TEXT REFERENCES entities(id),
  entity_type_slug TEXT,
  event_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  actor_id TEXT,
  actor_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS events_org_idx ON events(organization_id);
CREATE INDEX IF NOT EXISTS events_entity_idx ON events(entity_id);
CREATE INDEX IF NOT EXISTS events_type_idx ON events(event_type);
CREATE INDEX IF NOT EXISTS events_timestamp_idx ON events(timestamp);
CREATE INDEX IF NOT EXISTS events_org_timestamp_idx ON events(organization_id, timestamp);
CREATE INDEX IF NOT EXISTS events_entity_type_timestamp_idx ON events(entity_id, event_type, timestamp);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_org_name_idx ON roles(organization_id, name);

-- Policies
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  effect TEXT NOT NULL DEFAULT 'allow',
  priority INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS policies_role_idx ON policies(role_id);
CREATE INDEX IF NOT EXISTS policies_resource_action_idx ON policies(resource, action);

-- Scope Rules
CREATE TABLE IF NOT EXISTS scope_rules (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES policies(id),
  type TEXT NOT NULL,
  field TEXT,
  operator TEXT,
  value TEXT,
  relation_path TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS scope_rules_policy_idx ON scope_rules(policy_id);

-- Field Masks
CREATE TABLE IF NOT EXISTS field_masks (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES policies(id),
  field_path TEXT NOT NULL,
  mask_type TEXT NOT NULL,
  mask_config TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS field_masks_policy_idx ON field_masks(policy_id);

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  resource_type TEXT,
  resource_id TEXT,
  granted_by TEXT REFERENCES users(id),
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS user_roles_user_idx ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles(role_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique_idx ON user_roles(user_id, role_id, resource_type, resource_id);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  entity_id TEXT REFERENCES entities(id),
  job_type TEXT NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  result TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  claimed_by TEXT,
  claimed_at INTEGER,
  scheduled_for INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS jobs_org_idx ON jobs(organization_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_type_idx ON jobs(job_type);
CREATE INDEX IF NOT EXISTS jobs_scheduled_idx ON jobs(scheduled_for);
CREATE INDEX IF NOT EXISTS jobs_pending_idx ON jobs(status, scheduled_for, priority);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_idempotency_idx ON jobs(organization_id, idempotency_key);
CREATE INDEX IF NOT EXISTS jobs_entity_idx ON jobs(entity_id);

-- Tool Permissions
CREATE TABLE IF NOT EXISTS tool_permissions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  tool_name TEXT NOT NULL,
  identity_mode TEXT NOT NULL DEFAULT 'inherit',
  configured_role_id TEXT REFERENCES roles(id),
  allowed_actions TEXT,
  denied_fields TEXT,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS tool_permissions_agent_tool_idx ON tool_permissions(agent_id, tool_name);
CREATE INDEX IF NOT EXISTS tool_permissions_agent_idx ON tool_permissions(agent_id);
