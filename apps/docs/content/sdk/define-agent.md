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

## System Prompt Templates

System prompts support `{{variable}}` syntax for dynamic context injection at runtime. Common variables include `{{organizationName}}`, `{{currentTime}}`, `{{agentName}}`, and `{{entityTypes}}`.

```typescript
systemPrompt: `You are {{agentName}}, a coordinator for {{organizationName}}.
Current time: {{currentTime}}

Available entity types: {{entityTypes}}`
```

For the full variable reference and embedded query syntax, see [System Prompt Templates](../tools/system-prompt-templates).
