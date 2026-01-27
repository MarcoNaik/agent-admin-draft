ALTER TABLE organizations ADD COLUMN clerk_id TEXT;
ALTER TABLE users ADD COLUMN clerk_id TEXT;
ALTER TABLE users ADD COLUMN deleted_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS orgs_clerk_idx ON organizations(clerk_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_idx ON users(clerk_id);
