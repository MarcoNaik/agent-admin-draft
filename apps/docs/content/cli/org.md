---
title: "struere org"
description: "Create and manage organizations from the CLI"
section: "CLI"
order: 3
---

# struere org

The `org` command lets you create and list organizations directly from the CLI, without needing to visit the dashboard.

## Commands

### `struere org list`

List all organizations you belong to.

```bash
npx struere org list
```

#### Options

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

#### Example Output

```
Organizations

  Acme Corp (acme-corp) - admin
  My Side Project (my-side-project) - member
```

### `struere org create`

Create a new organization.

```bash
npx struere org create "My Organization"
```

#### Arguments

| Argument | Description |
|----------|-------------|
| `[name]` | Organization name (prompted if not provided) |

#### Options

| Flag | Description |
|------|-------------|
| `--slug <slug>` | Custom URL-friendly slug (auto-generated from name if not provided) |
| `--json` | Output as JSON |

#### What It Does

1. **Authenticates** — Verifies your CLI session
2. **Creates in Clerk** — Creates the organization via the Clerk Backend API (source of truth for auth)
3. **Syncs to Convex** — Immediately syncs the organization and your admin membership to the platform database
4. **Returns details** — Displays the new organization name, slug, and your role (always `admin` for the creator)

#### Example

```bash
npx struere org create "Acme Corp" --slug acme
```

```
✓ Created organization Acme Corp (acme)

Next steps:
  • struere init - Initialize a project
```

## Integration with Init

When you run `struere init` and have no organizations, the CLI will prompt you to create one inline instead of requiring a separate step. This keeps the onboarding flow seamless:

```
Not logged in - authenticating...

✓ Logged in as jane@example.com
No organizations found. Create one now? (Y/n)
Organization name: My Company
Creating organization...
✓ Created organization My Company (my-company)
  Organization: My Company

Creating project structure...
```

## Non-Interactive Mode

In CI/CD or non-interactive environments:

- `struere org create` requires the name argument
- `struere org list --json` outputs machine-readable JSON
- `struere init` exits with an error and a helpful message if no organizations exist
