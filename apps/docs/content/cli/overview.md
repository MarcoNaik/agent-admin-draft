---
title: "CLI Overview"
description: "Command-line interface for managing Struere agents"
section: "CLI"
order: 1
---

# CLI Overview

The Struere CLI is your primary interface for defining, syncing, and deploying agents and platform resources. It is built with Commander.js and ships as part of the `struere` npm package.

## Available Commands

| Command | Purpose |
|---------|---------|
| `struere init` | Initialize an organization-centric project, scaffold directories |
| `struere dev` | Watch all files, sync everything to Convex on change |
| `struere deploy` | Deploy all agents to production |
| `struere add <type> <name>` | Scaffold a new agent, entity-type, role, trigger, eval, or fixture |
| `struere entities` | Browse and manage entities interactively |
| `struere status` | Compare local file definitions vs remote state |
| `struere pull` | Pull remote resources to local files |
| `struere eval run <suite>` | Run an eval suite and generate Markdown reports |
| `struere templates list` | List WhatsApp message templates |
| `struere templates create <name>` | Create a new message template |
| `struere templates delete <name>` | Delete a message template |
| `struere templates status <name>` | Check template approval status |
| `struere login` | Browser-based OAuth authentication |
| `struere logout` | Clear stored credentials |
| `struere whoami` | Display the current logged-in user and organization |

## Quick Start

```bash
npm install struere
npx struere init
npx struere dev
```

## Auto-Run Behavior

The CLI automatically handles prerequisites so you never need to run setup commands manually:

- **No `struere.json`?** — Automatically runs `init` before proceeding
- **Not logged in?** — Automatically runs `login` before proceeding

This means running `npx struere dev` in an empty directory will walk you through project initialization and authentication before starting the development sync.

## Configuration

### Project Configuration (`struere.json`)

Located at the root of your project, this file identifies your organization:

```json
{
  "version": "2.0",
  "organization": {
    "id": "org_abc123",
    "slug": "acme-corp",
    "name": "Acme Corp"
  }
}
```

### Credentials (`~/.struere/credentials.json`)

Authentication tokens are stored locally in your home directory. These are managed automatically by `struere login` and `struere logout`.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `STRUERE_CONVEX_URL` | `your-deployment.convex.cloud` | Convex deployment URL |
| `STRUERE_API_KEY` | — | API key for production deployments |
| `STRUERE_AUTH_URL` | `app.struere.dev` | Auth callback URL for OAuth flow |

## Architecture

The CLI is organized into command files and utility modules:

```
src/cli/
├── index.ts              # Entry point, Commander.js setup, version check
├── commands/
│   ├── init.ts           # Project initialization
│   ├── dev.ts            # File watching and sync
│   ├── deploy.ts         # Production deployment
│   ├── add.ts            # Resource scaffolding
│   ├── status.ts         # Local vs remote comparison
│   ├── pull.ts           # Pull remote to local
│   ├── eval.ts           # Eval suite runner
│   ├── templates.ts      # WhatsApp template management
│   ├── login.ts          # Browser-based OAuth
│   ├── logout.ts         # Clear credentials
│   └── whoami.ts         # Current user info
└── utils/
    ├── loader.ts          # Load resources from directories
    ├── extractor.ts       # Build sync payload
    ├── project.ts         # Load/save struere.json
    ├── convex.ts          # API calls to Convex
    ├── evals.ts           # Eval API helpers
    ├── whatsapp.ts        # WhatsApp template API helpers
    ├── scaffold.ts        # File templates for new resources
    └── credentials.ts     # Auth token management
```

### Startup

On every invocation, the CLI performs a version check against npm with a 2-second timeout. If a newer version is available, it displays an update notice.

## Sync Mechanism

The CLI syncs your local definitions to the Convex backend. The sync flow is:

1. **Load** — Read all files from `agents/`, `entity-types/`, `roles/`, `triggers/`, `tools/`, `evals/`, and `fixtures/` directories
2. **Extract** — Build a sync payload using `extractSyncPayload()`
3. **Sync to development** — Send agents, entity types, roles, and triggers to `syncOrganization`
4. **Sync to eval** — Send agents, entity types, roles, eval suites, and fixtures to `syncOrganization` (triggers excluded)
5. **Watch** (dev mode) — Monitor files with chokidar and re-sync on any change

Resources are upserted by slug or name, meaning the CLI handles both creation and updates transparently. Fixture sync resets the eval environment on every sync (deletes all entities/relations, then recreates from YAML).

## Organization-Centric Design

Struere uses an organization-centric architecture. A single project defines all resources for one organization:

- All agents in `agents/`
- All entity types in `entity-types/`
- All roles in `roles/`
- All triggers in `triggers/`
- Shared custom tools in `tools/`
- Eval suites in `evals/`
- Fixture data in `fixtures/`

This means you manage your entire platform configuration from a single codebase, with the CLI handling synchronization to the backend.
