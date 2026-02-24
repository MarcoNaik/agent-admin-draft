---
title: "Model Configuration"
description: "Available AI model providers and pricing"
section: "Reference"
order: 1
---

# Model Configuration

Struere supports multiple LLM providers for agent execution. Each agent can be configured with a specific provider, model, and inference parameters.

## Available Providers

| Provider | Notes |
|----------|-------|
| `anthropic` | Default provider |
| `openai` | Configure in Settings > Providers |
| `google` | Configure in Settings > Providers |
| `xai` | Configure in Settings > Providers |
| `custom` | Requires `apiKey` in model config. Use for self-hosted or alternative providers. |

## Anthropic Models

Anthropic is the default provider.

| Model | Input (per MTok) | Output (per MTok) | Best For |
|-------|-------------------|--------------------|----------|
| `claude-haiku-4-5` | $1 | $5 | High-volume, cost-sensitive tasks |
| `claude-sonnet-4` | $3 | $15 | **Default** — Balanced reasoning and cost |
| `claude-sonnet-4-5` | $3 | $15 | Improved coding and reasoning over Sonnet 4 |
| `claude-opus-4-5` | $15 | $75 | Deep analysis and research-grade tasks |
| `claude-sonnet-4-6` | $3 | $15 | Latest Sonnet — strongest reasoning |
| `claude-opus-4-6` | $15 | $75 | Latest Opus — most capable model |

## OpenAI Models

| Model | Input (per MTok) | Output (per MTok) | Best For |
|-------|-------------------|--------------------|----------|
| `gpt-5.2` | $1.75 | $14 | Latest GPT — most capable |
| `gpt-5.1` | $1.25 | $10 | Strong general-purpose |
| `gpt-5` | $1.25 | $10 | General-purpose, multimodal |
| `gpt-5-mini` | $0.25 | $2 | Cost-effective GPT-5 |
| `gpt-5-nano` | $0.05 | $0.40 | Ultra-low cost |
| `gpt-4.1` | $2 | $8 | Reliable general-purpose |
| `gpt-4.1-mini` | $0.40 | $1.60 | Lightweight GPT-4.1 |
| `gpt-4.1-nano` | $0.10 | $0.40 | Budget-friendly |
| `gpt-4o` | $2.50 | $10 | Multimodal |
| `gpt-4o-mini` | $0.15 | $0.60 | Fast, cost-effective |
| `o4-mini` | $1.10 | $4.40 | Latest efficient reasoning |
| `o3` | $2 | $8 | Strong reasoning |
| `o3-mini` | $1.10 | $4.40 | Efficient reasoning |
| `o3-pro` | $20 | $80 | Maximum reasoning capability |
| `o1` | $15 | $60 | Complex reasoning and analysis |
| `o1-mini` | $1.10 | $4.40 | Lightweight reasoning |

## Google Models

| Model | Input (per MTok) | Output (per MTok) | Best For |
|-------|-------------------|--------------------|----------|
| `gemini-3-pro-preview` | $2 | $12 | Latest Gemini — preview |
| `gemini-2.5-pro` | $1.25 | $10 | Most capable stable Gemini |
| `gemini-2.5-flash` | $0.30 | $2.50 | Fast with strong reasoning |
| `gemini-2.0-flash` | $0.10 | $0.40 | High-speed tasks |
| `gemini-1.5-pro` | $1.25 | $5 | Long-context analysis |
| `gemini-1.5-flash` | $0.075 | $0.30 | Budget-friendly with long context |

## xAI Models

| Model | Input (per MTok) | Output (per MTok) | Context | Best For |
|-------|-------------------|--------------------|---------|----------|
| `grok-4-1-fast-reasoning` | $0.20 | $0.50 | 2M | Frontier agentic tool calling with reasoning |
| `grok-4-1-fast-non-reasoning` | $0.20 | $0.50 | 2M | Fast responses without reasoning overhead |
| `grok-4-0709` | $3 | $15 | 256K | Most capable Grok — deep reasoning |
| `grok-3` | $3 | $15 | 131K | Strong general-purpose |
| `grok-3-mini` | $0.30 | $0.50 | 131K | Cost-effective with reasoning |
| `grok-code-fast-1` | $0.20 | $1.50 | 256K | Optimized for agentic coding |

## Choosing a Model

- **claude-sonnet-4** — The default model. Strong reasoning with balanced cost, suitable for most agent tasks including multi-step planning and nuanced decision-making.
- **claude-haiku-4-5** — Use for high-volume, cost-sensitive agents. Fast and capable enough for entity management, scheduling, and standard workflows.
- **claude-opus-4-6** — Use for agents that require the highest possible capability, such as complex analysis or research tasks.
- **gpt-4o-mini** / **gemini-2.5-flash** — Good alternatives for cost-sensitive, high-throughput workloads.
- **grok-4-1-fast-reasoning** — Best xAI option for agentic workflows with tool calling. 2M context window at low cost.
- **grok-3-mini** — Budget-friendly xAI option with reasoning capabilities.

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
| `provider` | `string` | `"anthropic"` | The LLM provider (`"anthropic"`, `"openai"`, `"google"`, `"xai"`, or `"custom"`) |
| `name` | `string` | `"claude-sonnet-4"` (full ID: `claude-sonnet-4-20250514`) | The model name |
| `temperature` | `number` | `0.7` | Controls randomness. Lower values (0.0-0.3) produce more deterministic output. Higher values (0.7-1.0) produce more creative output. |
| `maxTokens` | `number` | `4096` | Maximum number of tokens in the model's response |
| `apiKey` | `string` | — | API key override. Required for `custom` provider. For standard providers, configure keys in the dashboard under Settings > Providers. |

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

### xAI Provider

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Grok Agent",
  slug: "grok-agent",
  version: "0.1.0",
  systemPrompt: "You assist with general queries.",
  model: {
    provider: "xai",
    name: "grok-4-1-fast-reasoning",
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

## Provider Configuration

Each provider can run in one of two modes, configured in the dashboard under **Settings > Providers**:

| Mode | Description |
|------|-------------|
| **Platform** | Uses Struere's built-in credits — no API key needed. Usage is deducted from your organization's credit balance. |
| **Custom** | Bring your own API key. Enter your key in the dashboard and all LLM calls for that provider will use it directly. |

You can configure each provider independently. For example, use platform credits for Anthropic while using your own OpenAI key.

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

Each tool call within the agent's LLM loop counts toward token usage. Multi-agent conversations (via `agent.chat`) track usage independently per agent in the chain. When using platform credits, token usage is automatically deducted from your organization's credit balance.
