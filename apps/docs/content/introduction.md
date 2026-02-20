---
title: "Introduction"
description: "What is Struere and why use it"
section: "Getting Started"
order: 1
---

# Introduction

Struere is a **permission-aware AI agent platform** that lets you build, deploy, and manage intelligent agents with fine-grained access control. Every operation your agents perform is governed by role-based access control (RBAC) with row-level security (scope rules) and column-level security (field masks), ensuring that agents and users only access the data they are authorized to see.

## Platform Architecture

Struere is organized as a monorepo with three main layers:

```
apps/                        packages/                   platform/
├── dashboard (Next.js)      └── struere (SDK + CLI)    ├── convex (Backend)
└── web (Marketing)                                     └── tool-executor (Sandboxed)
```

- **Dashboard** — A Next.js 14 application providing a real-time admin interface for managing agents, entities, roles, permissions, and integrations.
- **SDK + CLI** — The `struere` package gives you `defineAgent`, `defineEntityType`, `defineRole`, `defineTrigger`, and other helpers to define your platform configuration as code. The CLI syncs these definitions to your backend.
- **Convex Backend** — The core backend powering real-time data, permission evaluation, agent execution, and tool orchestration.
- **Tool Executor** — A sandboxed server that runs custom tool handlers with a restricted fetch allowlist.

## Key Capabilities

### Role-Based Access Control (RBAC)

Define roles with granular policies that control which resources each role can access and what actions they can perform. Struere supports five action types: `create`, `read`, `update`, `delete`, and `list`.

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "teacher",
  description: "Tutors who conduct sessions",
  policies: [
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
    { resource: "payment", actions: ["*"], effect: "deny" },
  ],
})
```

### Row-Level Security (Scope Rules)

Scope rules filter data at the row level so users only see records they own or are assigned to.

```typescript
scopeRules: [
  { entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" },
]
```

### Column-Level Security (Field Masks)

Field masks use an allowlist strategy to control which fields are visible to each role. New fields are hidden by default, making the system fail-safe.

```typescript
fieldMasks: [
  { entityType: "session", fieldPath: "data.paymentId", maskType: "hide" },
]
```

### Entity Management

Define structured entity types with JSON schemas, then create, query, update, and relate entities through both the dashboard and agent tool calls.

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
      hourlyRate: { type: "number" },
    },
    required: ["name", "email"],
  },
  searchFields: ["name", "email"],
})
```

### Multi-Agent Communication

Agents can delegate tasks to other agents using the `agent.chat` built-in tool. The platform enforces a depth limit of 3 and detects cycles to prevent infinite loops.

```typescript
export default defineAgent({
  name: "Coordinator",
  slug: "coordinator",
  tools: ["entity.query", "agent.chat"],
  systemPrompt: "You coordinate between specialized agents...",
})
```

### Environment Isolation

All data, roles, configurations, and permissions are fully isolated between `development`, `production`, and `eval` environments. Development API keys cannot access production data. The CLI's `dev` command syncs to both development and eval environments, while `deploy` pushes to production. The eval environment is purpose-built for automated testing with controlled fixture data.

### Triggers and Automations

Define event-driven automations that fire when entities are created, updated, or deleted. Triggers support scheduling, retries, and template variable resolution.

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
      tool: "event.emit",
      args: {
        eventType: "session.notification",
        entityId: "{{trigger.entityId}}",
      },
    },
  ],
})
```

## Tech Stack

| Technology | Role |
|------------|------|
| **Next.js 14** | Dashboard and web applications |
| **Convex** | Real-time backend with native subscriptions |
| **Tool Executor** | Sandboxed custom tool execution |
| **Clerk** | Authentication and organization management |
| **TypeScript** | End-to-end type safety |
| **Bun** | Package management and runtime |
| **Anthropic Claude** | Default LLM provider for agents |

## How It Works

```
Define agents, roles, entity types as code
    │
    ▼
CLI syncs definitions to Convex backend
    │
    ▼
Agents receive messages via API or dashboard
    │
    ▼
Permission engine evaluates access on every operation
    │
    ▼
Agents use built-in and custom tools (permission-checked)
    │
    ▼
Results are persisted, events are logged, triggers fire
```

Every request flows through the permission engine: an `ActorContext` is built with the caller's organization, roles, and environment. Policies are evaluated with a deny-overrides-allow model. Scope rules filter query results. Field masks strip unauthorized fields from responses.

## Next Steps

- [Getting Started](./getting-started) — Install Struere and create your first agent
- [CLI Overview](./cli/overview) — Learn the command-line interface
- [Agent Configuration](./sdk/define-agent) — Deep dive into agent configuration
- [Permissions](./platform/permissions) — Understand the permission engine
