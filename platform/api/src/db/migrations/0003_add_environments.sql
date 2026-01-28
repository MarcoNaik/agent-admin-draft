UPDATE deployments SET environment = 'development' WHERE environment IN ('preview', 'staging');

ALTER TABLE agents ADD COLUMN development_version_id TEXT REFERENCES agent_versions(id);
ALTER TABLE agents ADD COLUMN production_version_id TEXT REFERENCES agent_versions(id);

UPDATE agents SET production_version_id = current_version_id WHERE current_version_id IS NOT NULL;
