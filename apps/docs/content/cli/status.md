---
title: "struere status"
description: "Compare local vs remote state"
section: "CLI"
order: 5
---

# struere status

The `status` command compares your local file definitions against the current remote state in Convex, showing what would change on the next sync.

## Usage

```bash
npx struere status
```

## What It Does

The `status` command:

1. Loads all resource definitions from your local directories (`agents/`, `entity-types/`, `roles/`, `triggers/`)
2. Fetches the current remote state via the `getSyncState` Convex function
3. Compares each resource and displays the differences

## Output

The status output categorizes resources into:

- **New** — Resources that exist locally but not remotely (will be created on sync)
- **Modified** — Resources that exist in both places but have differences (will be updated on sync)
- **Deleted** — Resources that exist remotely but not locally (will be removed on sync)
- **Unchanged** — Resources that are identical locally and remotely

## Example Output

```
Agents:
  + scheduler          (new)
  ~ support-agent      (modified)
  = onboarding-agent   (unchanged)

Entity Types:
  + invoice            (new)
  = customer           (unchanged)
  = teacher            (unchanged)

Roles:
  = admin              (unchanged)
  ~ teacher            (modified)
  - legacy-role        (deleted)

Triggers:
  + notify-on-signup   (new)
```

## When to Use Status

- **Before deploying** — Review what will change before running `struere deploy`
- **After pulling** — Verify that your local state matches remote after a `pull`
- **Debugging sync issues** — Identify resources that are out of sync
- **Code review** — See at a glance what a set of file changes will do to the remote state

## Workflow Integration

A safe deployment workflow using `status`:

```bash
npx struere status

npx struere dev

npx struere status

npx struere deploy
```

1. Check what will change
2. Sync to development and test
3. Verify the state is clean
4. Deploy to production

## Relationship with Other Commands

| Command | What it does |
|---------|-------------|
| `struere status` | Read-only comparison, changes nothing |
| `struere dev` | Syncs local to remote (development environment) |
| `struere pull` | Syncs remote to local (overwrites local files) |
| `struere deploy` | Promotes development to production |
