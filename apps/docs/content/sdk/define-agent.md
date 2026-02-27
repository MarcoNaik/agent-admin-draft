---
title: "defineAgent"
description: "Create and configure AI agent definitions"
section: "SDK"
order: 4
---

# defineAgent

The `defineAgent` function creates and validates an AI agent configuration. Each agent is defined in its own file under the `agents/` directory.

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Scheduler",
  slug: "scheduler",
  version: "0.1.0",
  systemPrompt: "You are a scheduling assistant for {{organizationName}}.",
  model: {
    provider: "anthropic",
    name: "claude-sonnet-4",
  },
  tools: [
    "entity.create",
    "entity.query",
    "entity.update",
    "event.emit",
    "agent.chat",
  ],
})
```

## AgentConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Display name for the agent |
| `slug` | `string` | Yes | URL-safe identifier, used for API routing (`/v1/agents/:slug/chat`) |
| `version` | `string` | Yes | Semantic version string (e.g., `"0.1.0"`) |
| `systemPrompt` | `string \| (() => string \| Promise<string>)` | Yes | System prompt with template variable support |
| `description` | `string` | No | Human-readable description |
| `model` | `ModelConfig` | No | LLM provider and model settings |
| `tools` | `string[]` | No | Array of tool names (built-in and custom) |
| `firstMessageSuggestions` | `string[]` | No | Clickable suggestion chips shown in the chat empty state |
| `threadContextParams` | `ThreadContextParam[]` | No | Schema for expected thread context parameters (see below) |

### Validation

`defineAgent` throws an error if `name`, `version`, or `systemPrompt` is missing.

## Model Configuration

The `model` field configures which LLM provider and model the agent uses. If omitted, defaults to `anthropic/claude-sonnet-4` with temperature `0.7` and maxTokens `4096`.

```typescript
interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'custom'
  name: string
  temperature?: number
  maxTokens?: number
  apiKey?: string
}
```

```typescript
export default defineAgent({
  name: "Analyst",
  slug: "analyst",
  version: "1.0.0",
  systemPrompt: "You are a precise data analyst.",
  model: {
    provider: "anthropic",
    name: "claude-sonnet-4",
    temperature: 0.3,
    maxTokens: 8192,
  },
  tools: ["entity.query", "event.query"],
})
```

For the full list of providers, models, and pricing, see [Model Configuration](../reference/model-configuration).

## Tools

The `tools` field is an array of tool name strings referencing both [built-in tools](../tools/built-in-tools) and [custom tools](../tools/custom-tools) defined via `defineTools`.

```typescript
tools: [
  "entity.create",
  "entity.query",
  "event.emit",
  "send_email",
]
```

## First Message Suggestions

The `firstMessageSuggestions` field provides an array of strings displayed as clickable chips in the chat empty state. When a user clicks a suggestion, it sends that text as their first message.

```typescript
export default defineAgent({
  name: "Support",
  slug: "support",
  version: "0.1.0",
  systemPrompt: "You are a support agent for {{organizationName}}.",
  model: { provider: "xai", name: "grok-4-1-fast" },
  tools: ["entity.query"],
  firstMessageSuggestions: [
    "What can you help me with?",
    "Show me recent activity",
    "Create a new record",
  ],
})
```

Suggestions appear in all chat surfaces: the dashboard dev chat, public chat, embedded widget, and the chat sidebar on the agent detail page. Agents without suggestions show the default "Start a conversation" empty state.

## Thread Context Parameters

The `threadContextParams` field declares what context parameters your agent expects from callers. When defined, the backend validates incoming params — checking required fields, enforcing types, and dropping unknown params.

```typescript
interface ThreadContextParam {
  name: string
  type: 'string' | 'number' | 'boolean'
  required?: boolean
  description?: string
}
```

```typescript
export default defineAgent({
  name: "Support",
  slug: "support",
  version: "0.1.0",
  systemPrompt: `You are a support agent for {{organizationName}}.
Customer: {{threadContext.params.email}}
Plan: {{threadContext.params.plan}}`,
  model: { provider: "xai", name: "grok-4-1-fast" },
  tools: ["entity.query"],
  threadContextParams: [
    { name: "email", type: "string", required: true, description: "Customer email" },
    { name: "plan", type: "string", description: "Subscription plan" },
  ],
})
```

These parameters are passed differently depending on the channel:

| Channel | How params are passed |
|---------|----------------------|
| **Widget** | URL parameters on the `<script>` tag (e.g., `?email=jane@example.com&plan=pro`) |
| **API** | `threadContext.params` in the JSON request body |
| **WhatsApp** | Automatically populated from the inbound message (phone number, contact name) |
| **Dashboard** | Editable in the system prompt compile panel (auto-detected from `{{threadContext.params.*}}` references if not explicitly declared) |

The channel itself is always available via `{{threadContext.channel}}`.

## System Prompt Templates

System prompts support `{{variable}}` syntax for dynamic context injection at runtime. Common variables include `{{organizationName}}`, `{{currentTime}}`, `{{agentName}}`, and `{{entityTypes}}`.

```typescript
systemPrompt: `You are {{agentName}}, a coordinator for {{organizationName}}.
Current time: {{currentTime}}

Available entity types: {{entityTypes}}`
```

For the full variable reference and embedded query syntax, see [System Prompt Templates](../tools/system-prompt-templates).
