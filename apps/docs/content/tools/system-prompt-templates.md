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

## Supported Tools

Any built-in tool in the agent's tool list can be used as a template function. This includes all tool categories:

| Category | Tools |
|----------|-------|
| **Entity** | `entity.create`, `entity.get`, `entity.query`, `entity.update`, `entity.delete`, `entity.link`, `entity.unlink` |
| **Event** | `event.emit`, `event.query` |
| **Calendar** | `calendar.list`, `calendar.create`, `calendar.update`, `calendar.delete`, `calendar.freeBusy` |
| **WhatsApp** | `whatsapp.send`, `whatsapp.getConversation`, `whatsapp.getStatus` |
| **Agent** | `agent.chat` |
| **Airtable** | `airtable.listBases`, `airtable.listTables`, `airtable.listRecords`, `airtable.getRecord`, `airtable.createRecords`, `airtable.updateRecords`, `airtable.deleteRecords` |
| **Email** | `email.send` |
| **Payment** | `payment.create`, `payment.getStatus` |
| **Custom** | Any custom tool with a handler defined in `tools/` |

A template function only works if the tool is registered in the agent's `tools` array. If the tool is missing, the template outputs `[TEMPLATE_ERROR: toolName - tool not found]`.

## Filtering with entity.query

`entity.query` supports `filters`, `status`, and `limit` parameters. Filters match against fields inside `data`:

```
{{entity.query({"type": "order", "filters": {"data.status": "pending"}, "limit": 20})}}
```

### Filter operators

Use operator prefixes for advanced comparisons:

| Operator | Syntax | Description |
|----------|--------|-------------|
| Equals (default) | `{"data.field": "value"}` | Exact match |
| Not equal | `{"data.field": {"_op_ne": "value"}}` | Not equal to value |
| In | `{"data.field": {"_op_in": ["a", "b"]}}` | Matches any value in array |
| Not in | `{"data.field": {"_op_nin": ["a", "b"]}}` | Does not match any value |
| Greater than | `{"data.field": {"_op_gt": 100}}` | Greater than |
| Greater or equal | `{"data.field": {"_op_gte": 100}}` | Greater than or equal |
| Less than | `{"data.field": {"_op_lt": 100}}` | Less than |
| Less or equal | `{"data.field": {"_op_lte": 100}}` | Less than or equal |

### Combining filters with nested templates

Use `{{variable}}` inside filter values to create dynamic, context-aware queries:

```
{{entity.query({"type": "prospect", "filters": {"data.prospectSlug": "{{threadContext.params.prospectSlug}}"}, "limit": 1})}}
```

## Examples

### Personalized Sales Agent

An outbound agent that loads the prospect's profile and recent interactions before responding. The `prospectSlug` is passed via the API or widget:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Sales Rep",
  slug: "sales-rep",
  version: "0.1.0",
  systemPrompt: `You are {{agentName}}, a sales representative for {{organizationName}}.
Current time: {{currentTime}}

## Prospect Profile
{{entity.query({"type": "prospect", "filters": {"data.slug": "{{threadContext.params.prospectSlug}}"}, "limit": 1})}}

## Interaction History
{{event.query({"eventType": "prospect.contacted", "entityTypeSlug": "prospect", "limit": 10})}}

Personalize your responses based on the prospect's profile and past interactions. Be consultative, not pushy.`,
  model: { provider: "xai", name: "grok-4-1-fast" },
  tools: ["entity.query", "entity.update", "event.emit", "event.query", "email.send"],
  threadContextParams: [
    { name: "prospectSlug", type: "string", required: true, description: "Prospect slug" },
  ],
})
```

### Channel-Aware Support Agent

An agent that adapts its behavior based on which channel (WhatsApp, widget, API) the conversation comes through:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Support",
  slug: "support",
  version: "0.1.0",
  systemPrompt: `You are a support agent for {{organizationName}}.
Current time: {{currentTime}}
Channel: {{threadContext.channel}}

## Customer
{{entity.get({"type": "customer", "id": "{{threadContext.params.customerId}}"})}}

## Open Tickets
{{entity.query({"type": "ticket", "filters": {"data.customerId": "{{threadContext.params.customerId}}", "data.status": {"_op_in": ["open", "pending"]}}, "limit": 5})}}

Adapt your response style to the channel:
- whatsapp: Keep replies short, use line breaks instead of markdown
- widget: Use markdown formatting, include links when helpful
- api: Return structured responses
- dashboard: Be detailed, the user is an internal team member`,
  model: { provider: "anthropic", name: "claude-sonnet-4" },
  tools: ["entity.query", "entity.get", "entity.update", "event.emit"],
  threadContextParams: [
    { name: "customerId", type: "string", required: true, description: "Customer entity ID" },
  ],
})
```

### Scheduling Agent with Live Calendar

An agent that checks Google Calendar availability before booking sessions:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Scheduler",
  slug: "scheduler",
  version: "0.1.0",
  systemPrompt: `You are {{agentName}}, a scheduling assistant for {{organizationName}}.
Current time: {{currentTime}}

## Data Types
{{entityTypes}}

## Available Roles
{{roles}}

## Teachers
{{entity.query({"type": "teacher", "status": "active"})}}

## Students
{{entity.query({"type": "student", "status": "active"})}}

## Upcoming Sessions
{{entity.query({"type": "session", "filters": {"data.status": {"_op_in": ["scheduled", "confirmed"]}}, "limit": 30})}}

Before booking, use calendar.freeBusy to check the teacher's availability. Create sessions with entity.create and emit a session.created event.`,
  model: { provider: "xai", name: "grok-4-1-fast", temperature: 0.3 },
  tools: [
    "entity.create",
    "entity.get",
    "entity.query",
    "entity.update",
    "event.emit",
    "calendar.list",
    "calendar.create",
    "calendar.freeBusy",
  ],
})
```

### Multi-Agent Delegation

A triage agent that routes to specialized agents. The `agent.chat` tool lets this agent delegate to other agents at runtime:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Receptionist",
  slug: "receptionist",
  version: "0.1.0",
  systemPrompt: `You are {{agentName}}, the front desk receptionist for {{organizationName}}.
Current time: {{currentTime}}
Channel: {{threadContext.channel}}

## Available Data Types
{{entityTypes}}

You are a triage agent. Understand the user's request and delegate to the right specialist:
- Scheduling questions → delegate to agent "scheduler"
- Billing or payment questions → delegate to agent "billing"
- Technical support → delegate to agent "tech-support"

Use agent.chat to delegate. Always pass relevant context in the message.`,
  model: { provider: "xai", name: "grok-4-1-fast" },
  tools: ["agent.chat", "entity.query"],
})
```

### WhatsApp Outreach Agent

An agent that sends WhatsApp messages with context from the CRM:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Outreach",
  slug: "outreach",
  version: "0.1.0",
  systemPrompt: `You are {{agentName}} for {{organizationName}}.
Current time: {{currentTime}}

## WhatsApp Status
{{whatsapp.getStatus({})}}

## Contacts Pending Follow-up
{{entity.query({"type": "contact", "filters": {"data.followUpStatus": "pending"}, "limit": 10})}}

## Recent Conversations
{{event.query({"eventType": "whatsapp.sent", "limit": 20})}}

Follow up with pending contacts via WhatsApp. Check conversation history before reaching out to avoid duplicate messages. Log all outreach as events.`,
  model: { provider: "xai", name: "grok-4-1-fast" },
  tools: [
    "entity.query",
    "entity.update",
    "event.emit",
    "event.query",
    "whatsapp.send",
    "whatsapp.getConversation",
    "whatsapp.getStatus",
  ],
})
```

### Payment Collection Agent

An agent that generates payment links and tracks collection status:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Collections",
  slug: "collections",
  version: "0.1.0",
  systemPrompt: `You are a payment collection assistant for {{organizationName}}.
Current time: {{currentTime}}

## Unpaid Invoices
{{entity.query({"type": "invoice", "filters": {"data.status": "unpaid", "data.amount": {"_op_gt": 0}}, "limit": 20})}}

## Customer
{{entity.query({"type": "customer", "filters": {"data.slug": "{{threadContext.params.customerSlug}}"}, "limit": 1})}}

Generate payment links with payment.create for unpaid invoices. Send them via WhatsApp or email based on the channel. Update invoice status after successful payment.`,
  model: { provider: "xai", name: "grok-4-1-fast" },
  tools: [
    "entity.query",
    "entity.update",
    "event.emit",
    "payment.create",
    "payment.getStatus",
    "whatsapp.send",
    "email.send",
  ],
  threadContextParams: [
    { name: "customerSlug", type: "string", required: false, description: "Customer slug for targeted collection" },
  ],
})
```

### Airtable-Synced Agent

An agent that queries an external Airtable base and syncs data into entities:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Airtable Sync",
  slug: "airtable-sync",
  version: "0.1.0",
  systemPrompt: `You are a data sync assistant for {{organizationName}}.
Current time: {{currentTime}}

## Data Types
{{entityTypes}}

## Existing Records
{{entity.query({"type": "lead", "limit": 50})}}

When asked to sync, pull records from Airtable using airtable.listRecords and create or update matching entities. Use entity.query to check for duplicates before creating.`,
  model: { provider: "xai", name: "grok-4-1-fast" },
  tools: [
    "entity.create",
    "entity.query",
    "entity.update",
    "airtable.listBases",
    "airtable.listTables",
    "airtable.listRecords",
    "airtable.getRecord",
    "event.emit",
  ],
})
```

### Guardian Portal Agent

A role-scoped agent that only sees data the guardian has access to, using RBAC scope rules:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Guardian Assistant",
  slug: "guardian-assistant",
  version: "0.1.0",
  systemPrompt: `You are a parent/guardian assistant for {{organizationName}}.
Current time: {{currentTime}}

## Your Children
{{entity.query({"type": "student", "filters": {"data.guardianId": "{{threadContext.params.guardianEntityId}}"}})}}

## Upcoming Sessions
{{entity.query({"type": "session", "filters": {"data.guardianId": "{{threadContext.params.guardianEntityId}}", "data.status": "scheduled"}, "limit": 10})}}

## Recent Events
{{event.query({"entityTypeSlug": "session", "limit": 10})}}

Help the guardian view their children's schedules, check attendance, and communicate with teachers. You can only see data that belongs to this guardian (enforced by permissions).`,
  model: { provider: "xai", name: "grok-4-1-fast" },
  tools: ["entity.query", "entity.get", "event.query"],
  threadContextParams: [
    { name: "guardianEntityId", type: "string", required: true, description: "Guardian entity ID" },
  ],
})
```
