CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  entity_id TEXT REFERENCES entities(id),
  job_type TEXT NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'running', 'completed', 'failed', 'dead')),
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

CREATE INDEX jobs_pending_idx ON jobs(status, scheduled_for, priority);
CREATE UNIQUE INDEX jobs_idempotency_idx ON jobs(organization_id, idempotency_key);
CREATE INDEX jobs_org_idx ON jobs(organization_id);
CREATE INDEX jobs_entity_idx ON jobs(entity_id);
CREATE INDEX jobs_type_idx ON jobs(job_type);
