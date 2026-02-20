---
title: "SDK Overview"
description: "TypeScript SDK for defining agents, entities, roles, and triggers"
section: "SDK"
order: 1
---

# SDK Overview

The Struere SDK provides a set of TypeScript definition functions for building permission-aware AI agent platforms. It follows an **organization-centric architecture** where all agents, entity types, roles, triggers, and tools are managed from a single project and synced to the Struere platform.

## Installation

```bash
npm install struere
```

Initialize a new project:

```bash
npx struere init
```

This scaffolds the following project structure:

```
my-org/
├── struere.json
├── agents/
│   └── scheduler.ts
├── entity-types/
│   └── teacher.ts
├── roles/
│   └── admin.ts
├── triggers/
│   └── notify-on-session.ts
└── tools/
    └── index.ts
```

The `struere.json` file stores organization metadata:

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

## SDK Exports

The SDK exports six definition functions, each responsible for a specific resource type:

```typescript
import {
  defineAgent,
  defineTools,
  defineConfig,
  defineEntityType,
  defineRole,
  defineTrigger
} from 'struere'
```

| Function | Purpose | File Location |
|----------|---------|---------------|
| `defineAgent` | Create and configure AI agent definitions | `agents/*.ts` |
| `defineEntityType` | Define domain data schemas | `entity-types/*.ts` |
| `defineRole` | Create roles with policies, scope rules, and field masks | `roles/*.ts` |
| `defineTrigger` | Define event-driven automation rules | `triggers/*.ts` |
| `defineTools` | Create custom tool handlers | `tools/index.ts` |
| `defineConfig` | Create framework configuration with defaults | Project root |

Each definition file exports a default using its corresponding function:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Scheduler",
  slug: "scheduler",
  version: "0.1.0",
  systemPrompt: "You are a scheduling assistant.",
  tools: ["entity.create", "entity.query", "event.emit"],
})
```

## Type Exports

The SDK also exports all TypeScript types for use in your project:

```typescript
import type {
  AgentConfig,
  ModelConfig,
  EntityTypeConfig,
  JSONSchema,
  JSONSchemaProperty,
  RoleConfig,
  PolicyConfig,
  ScopeRuleConfig,
  FieldMaskConfig,
  TriggerConfig,
  TriggerAction,
  ToolReference,
  ToolParameters,
  ParameterDefinition,
  ToolHandler,
  ToolContext,
  FrameworkConfig,
  StruereProject,
  SyncPayload,
  SyncState,
} from 'struere'
```

## Organization-Centric Architecture

Struere uses a single-project approach where one repository defines the entire organization's AI infrastructure:

- **Agents** share entity types, roles, and tools across the organization
- **Entity types** define the domain schema once and are available to all agents
- **Roles** enforce access control consistently across all agents and API access
- **Triggers** automate workflows that fire from any mutation source (dashboard, agents, or API)
- **Tools** can be referenced by any agent by name

The `struere dev` command watches all directories and syncs changes to the Convex backend in real time. The `struere deploy` command pushes all agents to production.

## Sync Workflow

During development, all resources are synced as a single payload:

```typescript
{
  agents: [...],
  entityTypes: [...],
  roles: [...],
  triggers: [...]
}
```

Resources are upserted by their `slug` (agents, entity types, triggers) or `name` (roles), so renaming a slug creates a new resource rather than updating the existing one.
