---
title: "struere add"
description: "Scaffold new agents, entity types, roles, and triggers"
section: "CLI"
order: 4
---

# struere add

The `add` command scaffolds a new resource file with a starter template in the appropriate directory.

## Usage

```bash
npx struere add <type> <name>
```

## Resource Types

| Type | Directory | Definition Function |
|------|-----------|-------------------|
| `agent` | `agents/` | `defineAgent()` |
| `entity-type` | `entity-types/` | `defineEntityType()` |
| `role` | `roles/` | `defineRole()` |
| `trigger` | `triggers/` | `defineTrigger()` |
| `eval` / `suite` | `evals/` | `defineEvalSuite()` |

## Examples

### Scaffold an Agent

```bash
npx struere add agent scheduler
```

Creates `agents/scheduler.ts`:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Scheduler",
  slug: "scheduler",
  version: "0.1.0",
  systemPrompt: "You are a scheduling assistant...",
  model: {
    provider: "anthropic",
    name: "claude-sonnet-4",
  },
  tools: ["entity.query", "event.emit"],
})
```

### Scaffold an Entity Type

```bash
npx struere add entity-type customer
```

Creates `entity-types/customer.ts`:

```typescript
import { defineEntityType } from 'struere'

export default defineEntityType({
  name: "Customer",
  slug: "customer",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string", format: "email" },
    },
    required: ["name", "email"],
  },
  searchFields: ["name", "email"],
})
```

### Scaffold a Role

```bash
npx struere add role support
```

Creates `roles/support.ts`:

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "support",
  description: "Support team role",
  policies: [
    { resource: "customer", actions: ["list", "read"], effect: "allow" },
  ],
})
```

### Scaffold a Trigger

```bash
npx struere add trigger notify-on-signup
```

Creates `triggers/notify-on-signup.ts`:

```typescript
import { defineTrigger } from 'struere'

export default defineTrigger({
  name: "Notify on Signup",
  slug: "notify-on-signup",
  on: {
    entityType: "customer",
    action: "created",
  },
  actions: [
    {
      tool: "event.emit",
      args: {
        eventType: "customer.signup",
        entityId: "{{trigger.entityId}}",
      },
    },
  ],
})
```

## With Dev Running

If you have `struere dev` running in another terminal, newly scaffolded files will be detected and synced to Convex automatically. You can immediately edit the generated file and see your changes reflected in the development environment.

## Naming Conventions

The `<name>` argument is used to generate both the filename and the resource slug:

- Filename: `<name>.ts` (e.g., `scheduler.ts`, `notify-on-signup.ts`)
- Slug: derived from the name (e.g., `scheduler`, `notify-on-signup`)
- Display name: derived from the name with capitalization (e.g., `Scheduler`, `Notify on Signup`)
