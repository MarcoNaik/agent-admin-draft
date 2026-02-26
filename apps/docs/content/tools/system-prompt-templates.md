---
title: "System Prompt Templates"
description: "Dynamic variables and embedded queries in system prompts"
section: "Tools"
order: 3
---

# System Prompt Templates

System prompts support a template syntax that injects dynamic data at runtime. This allows agents to receive up-to-date context about the organization, current time, available data types, and even live query results directly in their system prompt.

## Template Syntax

Templates use double curly braces: `{{variableName}}`. Variables are resolved when the agent processes a message, before the system prompt is sent to the LLM.

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Support Agent",
  slug: "support",
  version: "0.1.0",
  systemPrompt: `You are {{agentName}}, an assistant for {{organizationName}}.
Current time: {{currentTime}}

Available data types: {{entityTypes}}

Use entity.query to search for records by type.`,
  model: { provider: "anthropic", name: "claude-sonnet-4" },
  tools: ["entity.query", "entity.get", "event.emit"],
})
```

## Available Variables

| Variable | Type | Description |
|----------|------|-------------|
| `{{currentTime}}` | `string` | ISO 8601 timestamp (e.g., `"2025-03-15T14:30:00.000Z"`) |
| `{{datetime}}` | `string` | ISO 8601 timestamp (alias for `currentTime`) |
| `{{timestamp}}` | `number` | Unix timestamp in milliseconds |
| `{{organizationName}}` | `string` | The organization's display name |
| `{{organizationId}}` | `string` | The Convex organization ID |
| `{{agentName}}` | `string` | The agent's display name |
| `{{agent.name}}` | `string` | The agent's display name (dotted access) |
| `{{agent.slug}}` | `string` | The agent's slug identifier |
| `{{userId}}` | `string` | The current user's ID (if applicable) |
| `{{threadId}}` | `string` | The current conversation thread ID |
| `{{message}}` | `string` | The current user message being processed |
| `{{threadContext.channel}}` | `string` | The channel the conversation came through: `widget`, `whatsapp`, `api`, or `dashboard` |
| `{{threadContext.params.X}}` | `any` | Access thread context parameter `X` (replace `X` with the param name) |
| `{{entityTypes}}` | `array` | JSON array of all data types in the current environment |
| `{{roles}}` | `array` | JSON array of all roles in the current environment |

### Variable Resolution

Variables support dot notation for nested access. The template engine walks the context object following each dot-separated segment:

- `{{agent.name}}` resolves to `context.agent.name`
- `{{threadContext.params.customerId}}` resolves to `context.threadContext.params.customerId`

If a variable resolves to an object or array, it is serialized as JSON. If a variable cannot be resolved, the template outputs `[TEMPLATE_ERROR: variableName not found]`.

### entityTypes Structure

The `{{entityTypes}}` variable resolves to a JSON array of data type objects:

```json
[
  {
    "name": "Teacher",
    "slug": "teacher",
    "description": "Tutors who conduct sessions",
    "schema": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "hourlyRate": { "type": "number" }
      }
    },
    "searchFields": ["name", "email"]
  },
  {
    "name": "Student",
    "slug": "student",
    "schema": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "grade": { "type": "string" }
      }
    },
    "searchFields": ["name"]
  }
]
```

This gives agents full awareness of the data types so they can construct valid `entity.query` and `entity.create` calls.

## Function Calls (Embedded Queries)

Templates can embed live queries that execute at prompt-resolution time. Function calls use the same double curly brace syntax with parentheses:

```
{{functionName({"key": "value"})}}
```

### entity.query

Queries records by type and injects the results into the system prompt:

```
{{entity.query({"type": "teacher", "limit": 5})}}
```

This resolves to a JSON array of record objects, filtered through the agent's permissions (scope rules and field masks apply).

### entity.get

Retrieves a single record by type and ID:

```
{{entity.get({"type": "customer", "id": "ent_abc123"})}}
```

### Nested Templates

Function arguments can contain template variables, enabling dynamic queries based on thread context:

```
{{entity.get({"type": "customer", "id": "{{threadContext.params.customerId}}"})}}
```

In this example:
1. `{{threadContext.params.customerId}}` is resolved first to the actual customer ID
2. The resolved ID is then used as the argument to `entity.get`
3. The entity data is fetched and injected into the system prompt

This is particularly useful for agents that need context about a specific record associated with the current conversation thread.

## Unsupported Syntax

Handlebars block helpers are **not supported**. The following will not work:

```
{{#each entityTypes}}
  - {{this.name}}
{{/each}}
```

```
{{#if userId}}
  User is logged in.
{{/if}}
```

Instead, use the raw variable which returns the JSON representation:

```
Available data types: {{entityTypes}}
```

The LLM can parse the JSON array directly.

## Result Truncation

Function call results are truncated to **10 KB** to prevent excessively large system prompts. If a result exceeds this limit, it is cut off with a `...[truncated]` suffix.

## Error Handling

If a function call fails, the template engine replaces it with an error marker:

| Error | Output |
|-------|--------|
| Invalid JSON arguments | `[TEMPLATE_ERROR: entity.query - invalid JSON arguments]` |
| Permission denied | `[]` (empty array) |
| Tool not found | `[TEMPLATE_ERROR: toolName - tool not found]` |
| Execution failure | `[TEMPLATE_ERROR: toolName - error message]` |

Permission errors produce empty results rather than error messages, so agents gracefully degrade when they lack access to certain data.

## Full Example

A scheduling agent with rich context injection:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Scheduler",
  slug: "scheduler",
  version: "0.1.0",
  systemPrompt: `You are {{agentName}}, a scheduling assistant for {{organizationName}}.

Current time: {{currentTime}}

## Available Data Types
{{entityTypes}}

## Current Teachers
{{entity.query({"type": "teacher"})}}

## Current Students
{{entity.query({"type": "student"})}}

## Instructions
- Use the data types above to understand the schema
- Query sessions with entity.query to check for conflicts
- Create new sessions with entity.create
- Always verify teacher availability before booking
- Sessions must be booked at least 24 hours in advance`,
  model: {
    provider: "anthropic",
    name: "claude-sonnet-4",
    temperature: 0.3,
  },
  tools: [
    "entity.create",
    "entity.get",
    "entity.query",
    "entity.update",
    "event.emit",
  ],
})
```

A customer-support agent that loads the customer's profile from thread context. The `customerId` is passed as a URL parameter on the widget script tag or via the `threadContext` field in the API request body:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Customer Support",
  slug: "customer-support",
  version: "0.1.0",
  systemPrompt: `You are a support agent for {{organizationName}}.

Channel: {{threadContext.channel}}

## Customer Profile
{{entity.get({"type": "customer", "id": "{{threadContext.params.customerId}}"})}}

## Recent Tickets
{{entity.query({"type": "ticket", "filters": {"customerId": "{{threadContext.params.customerId}}"}, "limit": 10})}}

Help the customer with their request. You have their profile and recent tickets loaded above.`,
  model: { provider: "anthropic", name: "claude-sonnet-4" },
  tools: ["entity.query", "entity.update", "event.emit"],
  threadContextParams: [
    { name: "customerId", type: "string", required: true, description: "Customer entity ID" },
  ],
})
```
