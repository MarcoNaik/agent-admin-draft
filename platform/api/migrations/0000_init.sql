CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_org_idx ON users(organization_id);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  permissions TEXT NOT NULL,
  last_used_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX api_keys_hash_idx ON api_keys(key_hash);
CREATE INDEX api_keys_org_idx ON api_keys(organization_id);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  current_version_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deleted')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX agents_org_slug_idx ON agents(organization_id, slug);
CREATE INDEX agents_org_idx ON agents(organization_id);

CREATE TABLE agent_versions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  version TEXT NOT NULL,
  bundle_key TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  metadata TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'deploying' CHECK (status IN ('deploying', 'active', 'failed', 'rolled_back')),
  deployed_at INTEGER NOT NULL,
  deployed_by TEXT NOT NULL
);

CREATE INDEX versions_agent_idx ON agent_versions(agent_id);
CREATE UNIQUE INDEX versions_agent_version_idx ON agent_versions(agent_id, version);

CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  version_id TEXT NOT NULL REFERENCES agent_versions(id),
  environment TEXT NOT NULL CHECK (environment IN ('preview', 'staging', 'production')),
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed', 'terminated')),
  created_at INTEGER NOT NULL
);

CREATE INDEX deployments_agent_idx ON deployments(agent_id);
CREATE INDEX deployments_agent_env_idx ON deployments(agent_id, environment);

CREATE TABLE executions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  version_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX executions_org_idx ON executions(organization_id);
CREATE INDEX executions_agent_idx ON executions(agent_id);
CREATE INDEX executions_timestamp_idx ON executions(timestamp);

CREATE TABLE dev_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  bundle_key TEXT,
  config_hash TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected')),
  preview_url TEXT NOT NULL,
  last_sync_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX dev_sessions_agent_idx ON dev_sessions(agent_id);
CREATE INDEX dev_sessions_user_idx ON dev_sessions(user_id);
