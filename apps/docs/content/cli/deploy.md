---
title: "struere deploy"
description: "Deploy all agents to production"
section: "CLI"
order: 7
---

# struere deploy

The `deploy` command promotes all agent configurations to the **production** environment.

## Usage

```bash
npx struere deploy
```

## What It Does

The deploy command calls the `deployAllAgents` function on the Convex backend. This takes all agent configurations currently in the development environment and copies them to production, making them accessible via production API keys.

## Development vs Production

Struere enforces full environment isolation between development and production:

| Aspect | `struere dev` | `struere deploy` |
|--------|---------------|------------------|
| Target environment | `development` | `production` |
| Data isolation | Development entities, threads, events | Production entities, threads, events |
| API keys | Development keys only | Production keys only |
| Agent configs | Stored as development configs | Promoted to production configs |
| Role resolution | Development roles | Production roles |

When you run `struere dev`, all synced resources are created in the development environment. Your development API keys interact with development data, and your agents use development configurations.

When you run `struere deploy`, agent configurations are promoted to production. Production API keys will now use the deployed configurations. Production data remains completely separate from development data.

## Deployment Flow

```
Local files ──[struere dev]──► Development environment
                                       │
                               [struere deploy]
                                       │
                                       ▼
                              Production environment
```

## Environment Scoping

The following resources are scoped per environment:

- Agent configurations (model, system prompt, tools)
- Entity types and entities
- Roles, policies, scope rules, and field masks
- Threads and messages
- Events and executions
- Trigger runs
- API keys
- Installed packs

Agents themselves (name, slug, description) are shared across environments — only their configurations are environment-specific.

## API Key Environments

API keys carry an `environment` field. When an API request arrives, the environment is extracted from the API key and threaded through the entire request:

- Config lookup uses the key's environment
- Threads are created in that environment
- Actor context carries the environment
- Tool execution respects environment boundaries
- Events are logged with the environment

A development API key cannot access production data, and vice versa.

## Production Checklist

Before deploying, verify:

1. **Test in development** — Use `struere dev` and development API keys to test your agents thoroughly
2. **Review with `struere status`** — Compare your local definitions against the remote state
3. **Check permissions** — Ensure roles and policies are correctly configured for production use
4. **Verify API keys** — Create production API keys in the dashboard for your applications
