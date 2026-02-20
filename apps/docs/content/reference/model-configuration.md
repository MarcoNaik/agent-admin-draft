---
title: "Model Configuration"
description: "Available AI model providers and pricing"
section: "Reference"
order: 1
---

# Model Configuration

Struere supports multiple LLM providers for agent execution. Each agent can be configured with a specific provider, model, and inference parameters.

## Available Providers

| Provider | Model Names | Notes |
|----------|-------------|-------|
| `anthropic` | `claude-haiku-4-5`, `claude-sonnet-4`, `claude-opus-4-5` | Default provider |
| `openai` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo` | Requires `OPENAI_API_KEY` |
| `google` | `gemini-1.5-pro`, `gemini-1.5-flash` | Requires `GOOGLE_API_KEY` |
| `custom` | Any model name | Requires `apiKey` in model config. Use for self-hosted or alternative providers. |

## Anthropic Models

Anthropic models are the default provider and require the `ANTHROPIC_API_KEY` environment variable on your Convex deployment.

### Pricing

| Model | Input (per MTok) | Output (per MTok) | Best For |
|-------|-------------------|--------------------|----------|
| `claude-haiku-4-5` | $1 | $5 | Best cost-to-intelligence ratio for high-volume tasks |
| `claude-sonnet-4` | $3 | $15 | **Default** — Strong reasoning with balanced cost |
| `claude-opus-4-5` | $5 | $25 | Most capable, research-grade tasks requiring deep analysis |

### Choosing a Model

- **claude-haiku-4-5** — Use for high-volume, cost-sensitive agents. Fast and capable enough for entity management, scheduling, and standard workflows.
- **claude-sonnet-4** — The default model. Strong reasoning with balanced cost, suitable for most agent tasks including multi-step planning and nuanced decision-making.
- **claude-opus-4-5** — Use sparingly for agents that require the highest possible capability, such as complex analysis or research tasks.

## Configuration Options

The `model` field in an agent definition accepts the following options:

```typescript
model: {
  provider: "anthropic",
  name: "claude-sonnet-4",
  temperature?: 0.7,
  maxTokens?: 4096,
  apiKey?: "sk-...",
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `string` | `"anthropic"` | The LLM provider (`"anthropic"`, `"openai"`, `"google"`, or `"custom"`) |
| `name` | `string` | `"claude-sonnet-4"` (full ID: `claude-sonnet-4-20250514`) | The model name |
| `temperature` | `number` | `0.7` | Controls randomness. Lower values (0.0-0.3) produce more deterministic output. Higher values (0.7-1.0) produce more creative output. |
| `maxTokens` | `number` | `4096` | Maximum number of tokens in the model's response |
| `apiKey` | `string` | — | API key override. Required for `custom` provider. For standard providers, the key is read from environment variables. |

## Default Configuration

If no model is specified in the agent definition, the default configuration is used:

```typescript
{
  provider: "anthropic",
  name: "claude-sonnet-4",
  temperature: 0.7,
  maxTokens: 4096,
}
```

## Examples

### Cost-Optimized Agent

For high-volume, straightforward tasks:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Data Entry Agent",
  slug: "data-entry",
  version: "0.1.0",
  systemPrompt: "You process incoming data and create entities.",
  model: {
    provider: "anthropic",
    name: "claude-haiku-4-5",
    temperature: 0.1,
    maxTokens: 2048,
  },
  tools: ["entity.create", "entity.query"],
})
```

### High-Capability Agent

For complex reasoning and multi-step workflows:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Strategy Advisor",
  slug: "strategy",
  version: "0.1.0",
  systemPrompt: "You analyze business data and provide strategic recommendations.",
  model: {
    provider: "anthropic",
    name: "claude-sonnet-4",
    temperature: 0.5,
    maxTokens: 8192,
  },
  tools: ["entity.query", "event.query"],
})
```

### Deterministic Agent

For tasks requiring consistent, reproducible output:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Report Generator",
  slug: "reports",
  version: "0.1.0",
  systemPrompt: "You generate structured reports from entity data.",
  model: {
    provider: "anthropic",
    name: "claude-haiku-4-5",
    temperature: 0.0,
    maxTokens: 4096,
  },
  tools: ["entity.query", "event.query"],
})
```

### OpenAI Provider

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "GPT Agent",
  slug: "gpt-agent",
  version: "0.1.0",
  systemPrompt: "You assist with general queries.",
  model: {
    provider: "openai",
    name: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 4096,
  },
  tools: ["entity.query"],
})
```

### Google Provider

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Gemini Agent",
  slug: "gemini-agent",
  version: "0.1.0",
  systemPrompt: "You assist with general queries.",
  model: {
    provider: "google",
    name: "gemini-1.5-flash",
    temperature: 0.7,
    maxTokens: 4096,
  },
  tools: ["entity.query"],
})
```

## Required Environment Variables

Set the appropriate API key on your Convex deployment depending on which providers your agents use:

| Variable | Provider | Required |
|----------|----------|----------|
| `ANTHROPIC_API_KEY` | Anthropic | Yes (default provider) |
| `OPENAI_API_KEY` | OpenAI | Only if using OpenAI models |
| `GOOGLE_API_KEY` | Google | Only if using Google models |

## Token Usage

Token usage is tracked per interaction and returned in the chat API response:

```json
{
  "usage": {
    "inputTokens": 1250,
    "outputTokens": 45,
    "totalTokens": 1295
  }
}
```

Each tool call within the agent's LLM loop counts toward token usage. Multi-agent conversations (via `agent.chat`) track usage independently per agent in the chain. All usage is recorded in the `executions` table for monitoring and billing.
