---
title: "struere pull"
description: "Pull remote resources to local files"
section: "CLI"
order: 6
---

# struere pull

The `pull` command downloads the current remote state from Convex and writes it to local files, creating or updating resource definitions in your project directories.

## Usage

```bash
npx struere pull
```

## What It Does

The `pull` command:

1. Fetches the current state of all resources from your Convex backend
2. Generates local definition files for each resource
3. Writes the files to the appropriate directories (`agents/`, `entity-types/`, `roles/`, `triggers/`)

## When to Use Pull

The `pull` command is useful when:

- **Resources were created via the dashboard** — If you or a team member created agents, data types, roles, or automations through the web dashboard, `pull` brings those definitions into your local project so they can be managed as code.

- **Onboarding to an existing project** — When joining a team that already has resources configured in Convex, `pull` gives you the local files to start working with.

- **Recovering local files** — If local files were accidentally deleted or corrupted, `pull` restores them from the remote state.

- **Switching machines** — When setting up a new development environment, `pull` populates your project with the current remote definitions.

## Example Workflow

A common scenario is creating resources in the dashboard and then pulling them locally for version control:

```bash
npx struere pull

git add agents/ entity-types/ roles/ triggers/
git commit -m "Pull remote resources to local definitions"
```

After pulling, you can modify the local files and use `struere dev` to sync changes back.

## Relationship with Dev and Status

| Command | Direction | Purpose |
|---------|-----------|---------|
| `struere pull` | Remote to local | Download remote state as local files |
| `struere dev` | Local to remote | Sync local files to remote |
| `struere status` | Comparison | Show differences without changing anything |

A typical workflow might be:

1. `struere pull` — Get the latest remote state
2. Edit local files — Make your changes
3. `struere status` — Review what will change
4. `struere dev` — Sync changes to the development environment
