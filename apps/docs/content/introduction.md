---
title: "Introduction"
description: "What is Struere and why use it"
section: "Getting Started"
order: 1
---

# Introduction

Struere is an **AI agent platform** with a built-in data layer, dynamic system prompts, event-driven automation, and integrations. Define agents, data types, and automations as TypeScript code, sync them with the CLI, and talk to agents via HTTP API.

## Platform Architecture

Struere is organized as a monorepo with three main layers:

```
apps/                        packages/                   platform/
├── dashboard (Next.js)      └── struere (SDK + CLI)    ├── convex (Backend)
└── web (Marketing)                                     └── tool-executor (Sandboxed)
```

- **Dashboard** — A Next.js 14 application for managing agents, data, and integrations in real-time.
- **SDK + CLI** — The `struere` package gives you `defineAgent`, `defineData`, `defineRole`, `defineTrigger`, and other helpers to define your platform configuration as code. The CLI syncs these definitions to your backend.
- **Convex Backend** — The core backend powering real-time data, agent execution, and tool orchestration.
- **Tool Executor** — A sandboxed server that runs custom tool handlers with a restricted fetch allowlist.

## Key Capabilities

### Data Management (Data Layer)

Define structured data types with JSON schemas. Agents get full CRUD operations — `entity.create`, `entity.get`, `entity.query`, `entity.update`, `entity.delete` — plus relationships via `entity.link`/`entity.unlink`, full-text search, and audit trails.

```typescript
import { defineData } from 'struere'

export default defineData({
  name: "Customer",
  slug: "customer",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string", format: "email" },
      plan: { type: "string", enum: ["free", "pro", "enterprise"] },
    },
    required: ["name", "email"],
  },
  searchFields: ["name", "email"],
})
```

### Dynamic System Prompts

System prompts are templates evaluated at runtime. Inject live data with `{{variables}}` and embedded queries like `{{entity.query({"type": "customer", "limit": 5})}}`. Agents always have up-to-date context — organization name, current time, entity schemas, and even query results loaded directly into the prompt before the LLM is called.

```typescript
export default defineAgent({
  name: "Support Agent",
  slug: "support",
  systemPrompt: `You are {{agentName}} for {{organizationName}}.
Current time: {{currentTime}}

Available data types: {{entityTypes}}

Recent tickets: {{entity.query({"type": "ticket", "limit": 10})}}`,
  tools: ["entity.query", "entity.update"],
})
```

### Automations

Define event-driven automations that fire when data is created, updated, or deleted. Automations support scheduling, retries, conditional filters, and template variable resolution.

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
      tool: "whatsapp.send",
      args: {
        phoneNumber: "{{trigger.data.teacherPhone}}",
        message: "New session scheduled: {{trigger.data.subject}}",
      },
    },
  ],
})
```

### Multi-Agent Communication

Agents delegate tasks to other agents using `agent.chat`. Build coordinator agents that route to specialists — billing, scheduling, support. The platform enforces a depth limit of 3 and detects cycles to prevent infinite loops.

```typescript
export default defineAgent({
  name: "Coordinator",
  slug: "coordinator",
  tools: ["entity.query", "agent.chat"],
  systemPrompt: "Route billing questions to the billing-agent, scheduling to scheduler...",
})
```

### Integrations

Built-in tools for WhatsApp messaging, Google Calendar, Airtable, and Flow/Polar payments. Agents can send WhatsApp messages, manage calendar events, read/write Airtable records, and generate payment links — all without custom code.

### Custom Tools

Define arbitrary TypeScript functions your agents can call. They run on the sandboxed tool executor service and can call built-in tools via the `struere` SDK or fetch external APIs. Tools can be marked `templateOnly: true` to inject data at prompt compilation time without exposing the tool to the LLM at runtime.

```typescript
import { defineTools } from 'struere'

export default defineTools([
  {
    name: "weather.get",
    description: "Get current weather for a city",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
    handler: async (args, context, struere, fetch) => {
      const res = await fetch(`https://api.weather.com/v1/current?city=${args.city}`)
      return res.json()
    },
  },
])
```

### Security & Access Control

Role-based access control (RBAC) with row-level security (scope rules) and column-level security (field masks). Every operation is permission-checked. Define what each role can see and do — deny overrides allow.

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "teacher",
  description: "Tutors who conduct sessions",
  policies: [
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
    { resource: "payment", actions: ["*"], effect: "deny" },
  ],
  scopeRules: [
    { entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" },
  ],
})
```

### Environment Isolation

All data, roles, configurations, and permissions are fully isolated between `development`, `production`, and `eval` environments. Development API keys cannot access production data. The eval environment is purpose-built for automated testing with controlled fixture data.

## How It Works

```
Define agents, data types, automations as code
    │
    ▼
CLI syncs definitions to Convex backend (struere dev)
    │
    ▼
Agents receive messages via API: POST /v1/agents/:slug/chat
    │
    ▼
System prompt assembled with live data (template variables + embedded queries)
    │
    ▼
Agents use built-in tools to read/write entities, send messages
    │
    ▼
Automations fire on data changes, platform logs audit trail automatically
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

## Next Steps

- [Chat API](./api/chat) — Send messages to agents via HTTP
- [Getting Started](./getting-started) — Install Struere and create your first agent
- [Agent Configuration](./sdk/define-agent) — Configure models, tools, and system prompts
- [Built-in Tools](./tools/built-in-tools) — All available agent tools
- [CLI Overview](./cli/overview) — Learn the command-line interface
