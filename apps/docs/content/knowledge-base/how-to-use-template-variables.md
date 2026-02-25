---
title: "How do I use template variables in system prompts?"
description: "Inject dynamic data into agent system prompts with template variables and embedded queries"
section: "Knowledge Base"
order: 7
---

# How do I use template variables in system prompts?

## Quick Answer

Use `{{variableName}}` syntax in system prompts. Variables like `{{currentTime}}`, `{{organizationName}}`, and `{{entityTypes}}` are resolved at runtime. You can also embed live queries with `{{entity.query({"type": "customer"})}}`.

## Step by Step

### 1. Basic variables

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Support",
  slug: "support",
  systemPrompt: `You are {{agentName}}, an assistant for {{organizationName}}.
Current time: {{currentTime}}
Thread: {{threadId}}`,
  model: { provider: "xai", name: "grok-4-1-fast" },
  tools: ["entity.query"],
})
```

### 2. Available variables

| Variable | Description |
|----------|-------------|
| `{{currentTime}}` | ISO 8601 timestamp |
| `{{datetime}}` | Alias for currentTime |
| `{{timestamp}}` | Unix timestamp in milliseconds |
| `{{organizationName}}` | Organization display name |
| `{{organizationId}}` | Convex organization ID |
| `{{agentName}}` | Agent display name |
| `{{agent.slug}}` | Agent slug |
| `{{userId}}` | Current user ID |
| `{{threadId}}` | Current thread ID |
| `{{message}}` | Current user message |
| `{{entityTypes}}` | JSON array of all entity types |
| `{{roles}}` | JSON array of all roles |
| `{{threadContext.channel}}` | Channel type: `widget`, `whatsapp`, `api`, or `dashboard` |
| `{{threadContext.params.X}}` | Thread context parameter X |

### 3. Embedded queries (function calls)

Inject live data into the system prompt:

```typescript
systemPrompt: `You are a scheduling agent for {{organizationName}}.

## Current Teachers
{{entity.query({"type": "teacher"})}}

## Today's Sessions
{{entity.query({"type": "session", "limit": 20})}}

Use the data above when answering questions.`
```

The query results are permission-filtered through the agent's scope rules and field masks.

### 4. Nested templates

Combine variables inside function call arguments:

```typescript
systemPrompt: `You are helping a customer.

## Customer Profile
{{entity.get({"type": "customer", "id": "{{threadContext.params.customerId}}"})}}

Greet them by name and help with their request.`
```

Resolution order: inner template `{{threadContext.params.customerId}}` resolves first, then the result is used as the argument to `entity.get`.

### 5. What happens on errors

| Situation | Output |
|-----------|--------|
| Variable not found | `[TEMPLATE_ERROR: variableName not found]` |
| Invalid JSON in function args | `[TEMPLATE_ERROR: entity.query - invalid JSON arguments]` |
| Permission denied on query | `[]` (empty array, no error) |
| Result exceeds 10 KB | Truncated with `...[truncated]` |

Permission errors return empty results so agents degrade gracefully.

## Common Mistakes

- **Using Handlebars block helpers.** `{{#each}}`, `{{#if}}`, and other block helpers are not supported. Use the raw JSON variable and let the LLM parse it.
- **Misspelling variable names.** A misspelled variable produces `[TEMPLATE_ERROR: ...]` in the system prompt. Double-check variable names against the reference.
- **Not passing thread context.** `{{threadContext.params.customerId}}` requires the thread to have the `customerId` param set via the widget URL, API `threadContext` field, or other channel. If the param does not exist, the template resolves to an error marker.
- **Oversized queries.** Results are truncated at 10 KB. Use `limit` in `entity.query` to keep results manageable.

## Related

- [System Prompt Templates](/tools/system-prompt-templates) — Full template reference
- [Define Agent](/sdk/define-agent) — Agent configuration
- [Entities](/platform/entities) — Entity data model
