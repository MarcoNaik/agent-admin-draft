CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  clerk_id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO users_new SELECT id, clerk_id, email, name, password_hash, organization_id, role, deleted_at, created_at, updated_at FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX users_email_idx ON users(email);
CREATE UNIQUE INDEX users_clerk_idx ON users(clerk_id);
CREATE INDEX users_org_idx ON users(organization_id);
