---
title: "struere dev"
description: "Watch files and sync to Convex on change"
section: "CLI"
order: 3
---

# struere dev

The `dev` command is your primary development workflow. It loads all resource definitions from your project, syncs them to the Convex backend in the **development** environment, and watches for file changes to re-sync automatically.

## Usage

```bash
npx struere dev
```

### Options

| Flag | Description |
|------|-------------|
| `--force` | Skip the destructive sync confirmation prompt. By default, `dev` warns you if the sync would delete remote resources not present locally. |

## How It Works

The dev command follows this flow:

1. **Auto-init** — If no `struere.json` exists, runs the initialization flow
2. **Auto-login** — If not authenticated, opens a browser for OAuth
3. **Load resources** — Reads all files from `agents/`, `entity-types/`, `roles/`, `triggers/`, and `tools/` directories
4. **Build sync payload** — Assembles all resources into a single payload via `extractSyncPayload()`
5. **Sync to Convex** — Sends the payload to the `syncOrganization` mutation
6. **Watch for changes** — Uses chokidar to monitor all resource directories
7. **Re-sync on change** — When any file is added, modified, or deleted, reloads and re-syncs

## Sync Payload

The CLI assembles all your local definitions into a single sync payload:

```typescript
{
  agents: [...],
  entityTypes: [...],
  roles: [...],
  triggers: [...]
}
```

Each resource is upserted by its slug or name, so both new resources and updates are handled transparently.

## Sync HTTP Request

Under the hood, the CLI sends the payload to Convex via an HTTP mutation:

```
POST /api/mutation
Authorization: Bearer {token}
Content-Type: application/json

{
  "path": "sync:syncOrganization",
  "args": {
    "agents": [...],
    "entityTypes": [...],
    "roles": [...],
    "triggers": [...]
  }
}
```

## Environment

The `dev` command always syncs to the **development** environment. All entity types, roles, agent configurations, and triggers are scoped to development. This ensures your changes do not affect production data or behavior.

To deploy to production, use `struere deploy`.

## File Watching

The CLI watches the following directories for changes:

- `agents/` — Agent definition files
- `entity-types/` — Entity type schema files
- `roles/` — Role definition files
- `triggers/` — Trigger definition files
- `tools/` — Custom tool definition files
- `evals/` — Eval suite definition files

When a file is added, modified, or deleted, the CLI:

1. Reloads all resources from disk
2. Builds a fresh sync payload
3. Sends the full payload to Convex

This means the sync is always a complete snapshot of your local state, not incremental changes.

## Example Workflow

```bash
npx struere dev
```

With the dev command running, open a separate terminal and create resources:

```bash
npx struere add agent scheduler
```

The dev process will detect the new file and sync it automatically. Edit the generated `agents/scheduler.ts` file and save — the changes will sync within seconds.

## Convex Sync Functions

The backend processes the sync payload through these functions:

| Function | Purpose |
|----------|---------|
| `syncOrganization` | Bulk upsert all resources (agents, entity types, roles, triggers) |
| `getSyncState` | Return current remote state for comparison |

The sync helpers upsert resources by slug, creating new records or updating existing ones as needed.

## Troubleshooting

If the sync fails, the CLI will display the error message from Convex. Common issues include:

- **Invalid schema** — Entity type schemas must be valid JSON Schema objects
- **Duplicate slugs** — Each resource type must have unique slugs within an organization
- **Authentication expired** — Re-run `struere login` to refresh your token
