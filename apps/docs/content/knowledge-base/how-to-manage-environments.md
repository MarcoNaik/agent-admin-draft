---
title: "How do I manage dev vs production environments?"
description: "Understand environment isolation and the workflow for promoting changes from development to production"
section: "Knowledge Base"
order: 8
---

# How do I manage dev vs production environments?

## Quick Answer

Struere has three environments: `development`, `production`, and `eval`. Use `struere dev` to sync to development and eval, then `struere deploy` to promote to production. API keys determine which environment a request operates in. All data, roles, and configurations are fully isolated between environments.

## Step by Step

### 1. Development workflow

```bash
npx struere dev
```

This syncs your local definitions (agents, data types, roles, automations) to the **development** environment and eval suites/fixtures to the **eval** environment. It watches for file changes and re-syncs automatically.

### 2. Test with development API keys

Create a development API key in the dashboard under **Settings > API Keys**. Development keys are prefixed `sk_dev_`:

```bash
curl -X POST https://api.struere.dev/v1/agents/my-agent/chat \
  -H "Authorization: Bearer sk_dev_abc123" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

This request accesses development agent configurations, development data, and development threads.

### 3. Deploy to production

When ready to go live:

```bash
npx struere deploy
```

This promotes all agent configurations to the production environment.

### 4. Use production API keys

Production keys are prefixed `sk_prod_`:

```bash
curl -X POST https://api.struere.dev/v1/agents/my-agent/chat \
  -H "Authorization: Bearer sk_prod_xyz789" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

A production API key **cannot** access development data, and vice versa.

### 5. What is isolated

| Isolated per environment | Shared across environments |
|--------------------------|---------------------------|
| Data types, data, relations | Agent identity (name, slug) |
| Roles, policies, scope rules, field masks | Users, organizations |
| Agent configurations (prompt, model, tools) | Tool permission configs |
| Threads, messages | |
| Events, executions, automation runs | |
| API keys, integration configs | |

The `agents` table is shared so the same agent can have different configurations per environment. The `agentConfigs` table stores the environment-specific config.

### 6. Compare environments

Use `struere status` to compare your local definitions against what is deployed:

```bash
npx struere status
```

This shows which agents, types, roles, and automations differ between your local files and the remote environment.

### 7. Dashboard environment switching

The dashboard lets admins switch between environments to view and manage data. The current environment is set via the UI and passed to all data-fetching hooks.

## Common Mistakes

- **Using a dev API key in production.** Always verify the key prefix matches the intended environment.
- **Forgetting to deploy.** Changes from `struere dev` only affect development. Run `struere deploy` to push to production.
- **Expecting shared data.** Data created in development does not exist in production. Each environment has its own data.
- **Mixing up eval and development.** The eval environment is for automated testing with fixture data. It receives eval suites and fixtures but not automations.

## Related

- [Environment Isolation](/platform/environment-isolation) — Full isolation reference
- [CLI deploy](/cli/deploy) — Deploy command details
- [CLI dev](/cli/dev) — Development sync workflow
