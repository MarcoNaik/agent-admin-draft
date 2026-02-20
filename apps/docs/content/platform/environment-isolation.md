---
title: "Environment Isolation"
description: "Development and production data separation"
section: "Platform Concepts"
order: 6
---

# Environment Isolation

Struere enforces strict isolation between development and production environments. All data, permissions, and configurations are scoped to one of two environments, preventing accidental cross-environment data access.

## Environments

The platform defines two environments:

```typescript
type Environment = "development" | "production"
```

Every request carries an environment context that is threaded through the entire execution chain: config lookup, actor context building, data queries, event logging, and tool execution.

## Scoping Rules

Resources are either scoped per environment (isolated) or shared across environments:

### Environment-Scoped Resources

| Table | Description |
|-------|-------------|
| `entityTypes` | Schema definitions can differ between dev and prod |
| `entities` | All domain data is environment-isolated |
| `entityRelations` | Relations between entities |
| `roles` | Role definitions and their policies |
| `policies` | Access control policies |
| `scopeRules` | Row-level security rules |
| `fieldMasks` | Column-level security masks |
| `agentConfigs` | Agent configurations (system prompt, model, tools) |
| `threads` | Conversation threads |
| `messages` | Chat messages |
| `events` | Audit log events |
| `executions` | Usage tracking records |
| `triggerRuns` | Scheduled trigger execution records |
| `apiKeys` | API keys carry an environment field |
| `installedPacks` | Pack installations |

### Shared Resources

| Table | Description |
|-------|-------------|
| `agents` | Agent identity (name, slug, description) is shared |
| `users` | User records from Clerk |
| `organizations` | Organization records |
| `toolPermissions` | Tool permission configurations |

The `agents` table is intentionally shared so that the same agent can have different configurations in development and production. The `agentConfigs` table stores the environment-specific configuration, looked up via the `by_agent_env` index.

## API Key Environment

API keys carry an `environment` field that determines which environment the request operates in:

```typescript
{
  organizationId: Id<"organizations">,
  environment: "development" | "production",
  keyHash: string,
  name: string,
}
```

When a chat request arrives with a Bearer token:

1. The API key is looked up by its SHA-256 hash
2. The `environment` field is extracted from the key
3. This environment is used for the entire request chain

A development API key **cannot** access production data, and vice versa. This enforcement happens at the ActorContext level, where the environment is set once and used for all subsequent operations.

## Environment Threading

The environment value flows through every layer of a request:

```
API Key → environment: "development"
    │
    ▼
ActorContext.environment = "development"
    │
    ├─► Agent config loaded via by_agent_env index (development config)
    ├─► Thread created/retrieved with environment = "development"
    ├─► Entity queries use by_org_env_type index
    ├─► Scope rules loaded for development roles
    ├─► Field masks loaded for development roles
    ├─► Events logged with environment = "development"
    └─► Execution metrics recorded with environment = "development"
```

## CLI and Environments

The CLI commands interact with specific environments:

| Command | Environment |
|---------|-------------|
| `struere dev` | Syncs to **development** environment |
| `struere deploy` | Promotes all agents to **production** environment |

During development, `struere dev` watches files and syncs changes to the development environment only. Production data and configurations are not affected until `struere deploy` is explicitly run.

## Dashboard Environment Switching

The dashboard supports environment switching via a URL query parameter. The `EnvironmentContext` provider reads the current environment from the URL and passes it to all data-fetching hooks. This allows admins to view and manage both development and production data from the same interface.

## Pack Installation

Packs are installed per environment using the `by_org_env_pack` index. A pack can be installed in development for testing before being installed in production. Each installation tracks its own:

- Customization overrides
- Upgrade history
- Version state

## Migrations

The platform includes backfill migrations (`platform/convex/migrations/addEnvironment.ts`) that set the `environment` field on pre-existing records. Each migration batch filters for `environment === undefined`, making them naturally idempotent. Records without an environment field are treated as needing migration.

## Best Practices

**Use separate API keys for each environment.** Create a development key for testing and a production key for live traffic. Never use a development key in production systems.

**Test triggers in development first.** Since triggers fire from all mutation sources, test automated workflows in development before deploying to production.

**Review entity type schemas before deploying.** Development and production entity types can diverge. Use `struere status` to compare local definitions against remote state before deploying.
