---
title: "struere init"
description: "Initialize an organization-centric project"
section: "CLI"
order: 2
---

# struere init

The `init` command scaffolds a new Struere project with all the directories and configuration needed to define agents, data types, roles, automations, and tools.

## Usage

```bash
npx struere init
```

### Options

| Flag | Description |
|------|-------------|
| `--org <slug>` | Specify the organization slug directly instead of selecting interactively |
| `-y, --yes` | Skip prompts and use defaults |

## What It Does

1. **Authenticates** — If you are not logged in, opens a browser for OAuth authentication
2. **Creates project structure** — Scaffolds the required directories for your resources
3. **Writes `struere.json`** — Creates the project configuration file with your organization details
4. **Generates types** — Creates `.struere/types.d.ts` type declarations for your project

## Directory Structure

After running `init`, your project will contain:

```
my-project/
├── struere.json
├── agents/
├── entity-types/
├── roles/
├── triggers/
├── tools/
│   └── index.ts
├── evals/
└── fixtures/
```

| Directory | Purpose |
|-----------|---------|
| `agents/` | Agent definitions using `defineAgent()` |
| `entity-types/` | Data type schemas using `defineEntityType()` |
| `roles/` | Role definitions with policies, scope rules, and field masks using `defineRole()` |
| `triggers/` | Automations using `defineTrigger()` |
| `tools/` | Custom tool definitions using `defineTools()` |
| `evals/` | Eval suite definitions as YAML |
| `fixtures/` | Fixture data for eval environment as YAML |

## struere.json

The configuration file links your project to a Struere organization:

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

| Field | Description |
|-------|-------------|
| `version` | Schema version for the configuration file |
| `organization.id` | Your Clerk organization ID |
| `organization.slug` | URL-friendly organization slug |
| `organization.name` | Human-readable organization name |

## Organization-Centric Architecture

Struere projects are organized around a single organization. All resources you define — agents, data types, roles, automations, and tools — belong to that organization.

This means:

- One project per organization
- All agents share the same entity types and roles
- Custom tools defined in `tools/index.ts` are available to any agent in the organization
- The CLI syncs the entire project state on every change

## Auto-Init

You do not need to run `init` explicitly. If you run `struere dev` or other commands without a `struere.json` file present, the CLI will automatically run the initialization flow first.

## Next Steps

After initializing, create your first resources:

```bash
npx struere add agent my-agent
npx struere add entity-type customer
npx struere add role support
npx struere dev
```
