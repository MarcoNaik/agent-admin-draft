---
title: "Project Structure"
description: "Organization-centric project layout and configuration"
section: "Reference"
order: 2
---

# Project Structure

Struere uses an **organization-centric** project layout where all agents, entity types, roles, triggers, and tools are defined as code in a single project directory. The CLI watches these files and syncs them to the Convex backend.

## Directory Layout

```
my-org/
├── struere.json
├── agents/
│   ├── scheduler.ts
│   ├── support.ts
│   └── coordinator.ts
├── entity-types/
│   ├── teacher.ts
│   ├── student.ts
│   ├── guardian.ts
│   ├── session.ts
│   ├── payment.ts
│   └── entitlement.ts
├── roles/
│   ├── admin.ts
│   ├── teacher.ts
│   └── guardian.ts
├── triggers/
│   └── notify-on-session.ts
├── tools/
│   └── index.ts
├── evals/
│   └── customer-support.eval.yaml
└── fixtures/
    └── classroom-data.fixture.yaml
```

## Directory Descriptions

### agents/

Each file exports a single agent definition using `defineAgent`. The file name is conventionally the agent's slug, though the slug is determined by the `slug` field in the definition.

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Scheduler",
  slug: "scheduler",
  version: "0.1.0",
  systemPrompt: "You are a scheduling assistant for {{organizationName}}.",
  model: { provider: "anthropic", name: "claude-sonnet-4" },
  tools: ["entity.create", "entity.query", "event.emit"],
})
```

### entity-types/

Each file exports a single entity type definition using `defineEntityType`. Entity types define the schema for structured data that agents can create, query, and manage.

```typescript
import { defineEntityType } from 'struere'

export default defineEntityType({
  name: "Teacher",
  slug: "teacher",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string", format: "email" },
      subjects: { type: "array", items: { type: "string" } },
      hourlyRate: { type: "number" },
    },
    required: ["name", "email"],
  },
  searchFields: ["name", "email"],
})
```

### roles/

Each file exports a single role definition using `defineRole`. Roles include policies (allow/deny rules), scope rules (row-level security), and field masks (column-level security).

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "teacher",
  description: "Tutors who conduct sessions",
  policies: [
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
    { resource: "student", actions: ["list", "read"], effect: "allow" },
    { resource: "payment", actions: ["*"], effect: "deny" },
  ],
  scopeRules: [
    { entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" },
  ],
  fieldMasks: [
    { entityType: "session", fieldPath: "data.paymentId", maskType: "hide" },
    { entityType: "student", fieldPath: "data.guardianNotes", maskType: "hide" },
  ],
})
```

### triggers/

Each file exports a single trigger definition using `defineTrigger`. Triggers define automations that fire when entities are created, updated, or deleted.

```typescript
import { defineTrigger } from 'struere'

export default defineTrigger({
  name: "Notify on New Session",
  slug: "notify-on-session",
  on: {
    entityType: "session",
    action: "created",
    condition: { "data.status": "scheduled" },
  },
  actions: [
    {
      tool: "entity.get",
      args: { id: "{{trigger.data.teacherId}}" },
      as: "teacher",
    },
    {
      tool: "event.emit",
      args: {
        eventType: "session.notification",
        entityId: "{{trigger.entityId}}",
        payload: { teacher: "{{steps.teacher.data.name}}" },
      },
    },
  ],
})
```

### evals/

Each file defines an eval suite as a YAML file with the `.eval.yaml` extension. Eval suites specify test cases with assertions that verify agent behavior. See [Evaluations](/platform/evals) for the full YAML format.

### fixtures/

Each file defines fixture data as a YAML file with the `.fixture.yaml` extension. Fixtures create controlled test entities and relations in the eval environment. See [Evaluations — Fixtures](/platform/evals#fixtures--test-data-for-evals) for the full YAML format.

### tools/

Contains a single `index.ts` file that exports all custom tool definitions using `defineTools`. These tools are shared across all agents in the organization.

```typescript
import { defineTools } from 'struere'

export default defineTools([
  {
    name: "send_email",
    description: "Send an email to a recipient",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
    handler: async (args, context, fetch) => {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: args.to }] }],
          from: { email: "noreply@example.com" },
          subject: args.subject,
          content: [{ type: "text/plain", value: args.body }],
        }),
      })
      return { success: response.ok }
    },
  },
])
```

## struere.json

The root configuration file identifies the organization and project version. Created automatically by `struere init`.

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

| Field | Type | Description |
|-------|------|-------------|
| `version` | `string` | Configuration schema version. Currently `"2.0"`. |
| `organization.id` | `string` | The Clerk organization ID |
| `organization.slug` | `string` | The organization's URL slug |
| `organization.name` | `string` | The organization's display name |

## Credentials File

Authentication credentials are stored at `~/.struere/credentials.json` after running `struere login`. This file is user-specific and should not be committed to version control.

```json
{
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "...",
  "expiresAt": 1710500000000
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `STRUERE_CONVEX_URL` | `your-deployment.convex.cloud` | Convex deployment URL for API calls |
| `STRUERE_API_KEY` | — | API key for production deployments |
| `STRUERE_AUTH_URL` | `app.struere.dev` | Authentication callback URL |

## Database Schema Overview

The Convex backend stores all platform data across the following table categories:

| Category | Tables | Description |
|----------|--------|-------------|
| **User & Org** | `organizations`, `users`, `userOrganizations`, `apiKeys` | User accounts, organizations, memberships, and API keys (env-scoped) |
| **Agents** | `agents`, `agentConfigs` | Agent definitions (shared) and environment-specific configurations |
| **Conversation** | `threads`, `messages` | Conversation threads and message history |
| **Business Data** | `entityTypes`, `entities`, `entityRelations` | Structured data types, instances, and relations (all env-scoped) |
| **Events & Audit** | `events`, `executions` | Event log and agent execution tracking (env-scoped) |
| **Triggers** | `triggers`, `triggerRuns` | Automation rules and execution records (env-scoped) |
| **RBAC** | `roles`, `policies`, `scopeRules`, `fieldMasks`, `toolPermissions`, `userRoles`, `pendingRoleAssignments` | Access control definitions (roles are env-scoped) |
| **Integrations** | `integrationConfigs`, `whatsappConnections`, `whatsappMessages`, `providerConfigs`, `calendarConnections` | External service configurations and integration data |
| **Billing** | `creditBalances`, `creditTransactions` | Organization credit balances and transaction history |
| **Evals** | `evalSuites`, `evalCases`, `evalRuns`, `evalResults` | Agent evaluation and testing |

### Environment-Scoped vs Shared Tables

Most tables are scoped by environment, meaning development, production, and eval data is fully isolated:

**Environment-scoped:** `entityTypes`, `entities`, `entityRelations`, `roles`, `agentConfigs`, `threads`, `messages`, `events`, `executions`, `triggerRuns`, `apiKeys`, `evalSuites`, `evalRuns`, `integrationConfigs`, `whatsappConnections`

**Shared across environments:** `agents`, `users`, `organizations`, `userOrganizations`, `toolPermissions`

The `agents` table stores the agent name, slug, and description which are shared. The environment-specific configuration (system prompt, model, tools) lives in `agentConfigs`, looked up via the `by_agent_env` index on `agentId` and `environment`.

## CLI Sync Mechanism

When you run `struere dev`, the CLI performs a **dual sync**:

1. Loads all resource files from `agents/`, `entity-types/`, `roles/`, `triggers/`, `tools/`, `evals/`, and `fixtures/`
2. Builds a sync payload containing all definitions
3. Syncs to the **development** environment (agents, entity types, roles, triggers)
4. Syncs to the **eval** environment (agents, entity types, roles, eval suites, fixtures — triggers excluded)
5. Watches all directories with chokidar for file changes
6. Re-syncs on any file change (add, modify, or delete)

The development sync payload:

```typescript
{
  agents: AgentConfig[]
  entityTypes: EntityTypeConfig[]
  roles: RoleConfig[]
  triggers: TriggerConfig[]
}
```

The eval sync payload:

```typescript
{
  agents: AgentConfig[]
  entityTypes: EntityTypeConfig[]
  roles: RoleConfig[]
  evalSuites: EvalSuiteConfig[]
  fixtures: FixtureDefinition[]
}
```

Resources are upserted by slug or name, so renaming a slug creates a new resource rather than updating the existing one. Fixture sync deletes all existing entities and relations in the eval environment and recreates them from YAML, ensuring a clean state on every sync. Use `struere deploy` to promote to **production**.
