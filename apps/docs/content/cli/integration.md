---
title: "struere integration"
description: "Configure and manage integrations from the command line"
section: "CLI"
order: 10
---

# struere integration

The `integration` command configures third-party integrations directly from the CLI. Currently supports **Airtable** and **Resend** providers. These are the same integrations available in the dashboard Settings page, but configurable without leaving the terminal.

## Usage

```bash
# List all configured integrations
npx struere integration

# Show current config for a provider
npx struere integration airtable

# Save Airtable config
npx struere integration airtable --token pat123abc

# Save and verify connection
npx struere integration airtable --token pat123abc --test

# Remove an integration
npx struere integration airtable --remove

# Save Resend config
npx struere integration resend --from-email noreply@example.com --from-name "My App"
```

## Listing Integrations

Running `struere integration` with no arguments lists all configured integrations for the current environment.

```bash
npx struere integration [options]
```

| Flag | Description |
|------|-------------|
| `--env <environment>` | Environment (`development` or `production`). Default: `development` |
| `--json` | Output raw JSON |

**Output:**

```
✓ Found 2 integrations

  Provider          Status        Last Verified
  ────────────────  ────────────  ──────────────────────
  airtable          active        2/26/2026, 10:30:00 AM
  resend            inactive      never
```

## Viewing a Provider

Pass a provider name with no config flags to see the current configuration. Sensitive values (tokens, keys) are masked automatically by the server.

```bash
npx struere integration <provider> [options]
```

| Flag | Description |
|------|-------------|
| `--env <environment>` | Environment. Default: `development` |
| `--json` | Output raw JSON |

**Output:**

```
✓ airtable config loaded

  airtable
  ────────────────────────────────────────────────────
  Status:        active
  Environment:   development
  Last Verified: 2/26/2026, 10:30:00 AM
  Updated:       2/26/2026, 10:28:00 AM

  Config
  ────────────────────────────────────────────────────
  personalAccessToken  pat1...xyz9
  defaultBaseId        appABC123
```

## Configuring Airtable

```bash
npx struere integration airtable [options]
```

| Flag | Description |
|------|-------------|
| `--token <pat>` | Airtable Personal Access Token |
| `--base-id <id>` | Default Airtable base ID |
| `--test` | Test connection after saving |
| `--env <environment>` | Environment. Default: `development` |

The `--token` flag is required for initial setup. The `--base-id` is optional and sets a default base for queries. Both flags can be used independently to update individual values — the server merges updates into the existing config.

**Example:**

```bash
# Initial setup with verification
npx struere integration airtable --token patXXX.YYYY --base-id appZZZ --test

# Update just the base ID later
npx struere integration airtable --base-id appNEW
```

## Configuring Resend

```bash
npx struere integration resend [options]
```

| Flag | Description |
|------|-------------|
| `--from-email <email>` | Default sender email address |
| `--from-name <name>` | Default sender display name |
| `--reply-to <email>` | Default reply-to address |
| `--test` | Test connection after saving |
| `--env <environment>` | Environment. Default: `development` |

All flags are optional individually, but at least one is required when saving. The Resend API key itself is configured as a Convex environment variable (`RESEND_API_KEY`), not through this command.

**Example:**

```bash
npx struere integration resend \
  --from-email noreply@example.com \
  --from-name "My App" \
  --reply-to support@example.com \
  --test
```

## Testing a Connection

Use `--test` to verify that the integration is working. This calls the backend's `testConnection` action, which validates credentials against the provider's API.

```bash
# Test after saving config
npx struere integration airtable --token patXXX --test

# Test existing config without changing anything
npx struere integration airtable --test
```

**Output (success):**

```
✓ airtable config saved
✓ Airtable connection verified
```

**Output (failure):**

```
✓ airtable config saved
✗ Airtable Personal Access Token is invalid or unreachable
```

## Enabling and Disabling

Toggle an integration between `active` and `inactive` without removing its configuration.

```bash
npx struere integration airtable --disable
npx struere integration airtable --enable
```

## Removing an Integration

Permanently deletes the integration configuration. Prompts for confirmation unless `--yes` is passed.

```bash
npx struere integration airtable --remove
npx struere integration airtable --remove --yes
```

## Supported Providers

| Provider | Required Flags | Optional Flags |
|----------|----------------|----------------|
| `airtable` | `--token` | `--base-id` |
| `resend` | At least one of `--from-email`, `--from-name`, `--reply-to` | — |

## Example Workflow

```bash
# Set up Airtable with verification
npx struere integration airtable --token patXXX.YYYY --test

# Confirm it shows up in the list
npx struere integration

# Later, disable it temporarily
npx struere integration airtable --disable

# Re-enable and verify
npx struere integration airtable --enable
npx struere integration airtable --test

# Remove when no longer needed
npx struere integration airtable --remove --yes
```
