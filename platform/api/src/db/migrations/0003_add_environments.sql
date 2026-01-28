ALTER TABLE agents ADD COLUMN development_version_id TEXT REFERENCES agent_versions(id);
ALTER TABLE agents ADD COLUMN production_version_id TEXT REFERENCES agent_versions(id);

UPDATE agents SET production_version_id = current_version_id WHERE current_version_id IS NOT NULL;

CREATE TABLE deployments_new (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  version_id TEXT NOT NULL REFERENCES agent_versions(id),
  environment TEXT NOT NULL CHECK(environment IN ('development', 'production')),
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'failed', 'terminated')),
  created_at INTEGER NOT NULL
);

INSERT INTO deployments_new (id, agent_id, version_id, environment, url, status, created_at)
SELECT id, agent_id, version_id,
  CASE WHEN environment IN ('preview', 'staging') THEN 'development' ELSE environment END,
  url, status, created_at
FROM deployments;

DROP TABLE deployments;

ALTER TABLE deployments_new RENAME TO deployments;

CREATE INDEX deployments_agent_idx ON deployments(agent_id);
CREATE INDEX deployments_agent_env_idx ON deployments(agent_id, environment);
