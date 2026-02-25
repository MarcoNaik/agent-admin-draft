---
title: "Agents"
description: "AI agent configuration and execution"
section: "Platform Concepts"
order: 2
---

# Agents

Agents are the core execution units of the Struere platform. Each agent is an AI-powered entity with a system prompt, model configuration, and a set of tools it can use to interact with your domain data.

## Architecture

Agent data is split across two tables with different scoping rules:

### agents Table (Shared)

The `agents` table stores identity information that is shared across environments:

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | ID | Organization that owns this agent |
| `name` | string | Display name |
| `slug` | string | URL-safe identifier for API routing |
| `description` | string | Human-readable description |
| `status` | enum | `"active"`, `"paused"`, or `"deleted"` |

The `slug` is used for API access via `/v1/agents/:slug/chat`.

### agentConfigs Table (Environment-Scoped)

The `agentConfigs` table stores the actual configuration and is scoped per environment using the `by_agent_env` index:

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | ID | Reference to the agents table |
| `environment` | enum | `"development"` or `"production"` |
| `version` | string | Semantic version |
| `name` | string | Config display name |
| `systemPrompt` | string | Compiled system prompt |
| `model` | object | Provider, model name, temperature, maxTokens |
| `tools` | array | Tool definitions with name, description, parameters, handlerCode, isBuiltin |
| `deployedBy` | ID | User who deployed this config |

This split means an agent can have different configurations in development and production. The `struere dev` command syncs to the development config, and `struere deploy` promotes configs to production.

## Execution Flow

When a chat request arrives, the agent executes through this pipeline:

```
POST /v1/chat  or  POST /v1/agents/:slug/chat
         │
         ▼
┌─────────────────────────────┐
│ 1. Authentication           │
│    Extract Bearer token     │
│    Validate API key         │
│    (SHA-256 hash lookup)    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 2. Load Agent               │
│    Resolve agent by ID/slug │
│    Load config via          │
│    by_agent_env index       │
│    (env from API key)       │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 3. Build ActorContext       │
│    organizationId           │
│    actorType (user/agent)   │
│    environment              │
│    roleIds (resolved)       │
│    isOrgAdmin               │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 4. Prepare Thread           │
│    Get or create thread     │
│    (env-scoped)             │
│    Load message history     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 5. Process System Prompt    │
│    Resolve {{variables}}    │
│    Execute embedded queries │
│    (permission-aware)       │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 6. LLM Loop (max 10 iter)  │
│    Call LLM API             │
│    ├─ Text response → done  │
│    └─ Tool calls:           │
│       Check permission      │
│       Execute tool          │
│       Add result to context │
│       Continue loop         │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 7. Persist & Respond        │
│    Append messages to thread│
│    Record execution metrics │
│    Return response          │
└─────────────────────────────┘
```

### LLM Loop

The agent runs an iterative loop with a maximum of 10 iterations. Each iteration:

1. Sends the full message history (system prompt + conversation + tool results) to the LLM
2. If the LLM responds with text only, the loop exits
3. If the LLM makes tool calls, each tool is:
   - Permission-checked via `canUseTool`
   - Executed (built-in tools run as Convex mutations; custom tools run on the tool executor service)
   - Results are appended to the message history
4. The loop continues with the updated history

### Tool Execution

**Built-in tools** run as Convex mutations with full permission checking:

| Tool | Convex Function | Description |
|------|-----------------|-------------|
| `entity.create` | `tools.entities.entityCreate` | Create entity + emit event |
| `entity.get` | `tools.entities.entityGet` | Get entity (field-masked) |
| `entity.query` | `tools.entities.entityQuery` | Query with scope filters |
| `entity.update` | `tools.entities.entityUpdate` | Update + emit event |
| `entity.delete` | `tools.entities.entityDelete` | Soft delete + emit event |
| `entity.link` | `tools.entities.entityLink` | Create relation |
| `entity.unlink` | `tools.entities.entityUnlink` | Remove relation |
| `event.emit` | `tools.events.eventEmit` | Emit custom event |
| `event.query` | `tools.events.eventQuery` | Query events (visibility filtered) |
| `agent.chat` | `tools.agents.agentChat` | Delegate to another agent |

**Custom tools** are sent to the tool executor service at `tool-executor.struere.dev` for sandboxed execution with actor context.

## Multi-Agent Communication

The `agent.chat` tool enables agents to delegate work to other agents within the same organization and environment.

```
Caller Agent
    │
    ├─ tool_call: agent.chat({ agent: "analyst", message: "..." })
    │
    ▼
Target Agent Resolution
    │
    ├─ Find agent by slug
    ├─ Create child thread (shared conversationId)
    │
    ▼
Target Agent Execution
    │
    ├─ Full LLM loop with target's own config/tools/permissions
    │
    ▼
Response returned as tool result to Caller Agent
```

### Safety Mechanisms

| Mechanism | Description |
|-----------|-------------|
| Depth limit | Maximum chain depth of 3 (`MAX_AGENT_DEPTH`) |
| Cycle detection | Target slug checked against caller slug |
| Iteration cap | Each agent limited to 10 LLM iterations independently |
| Action timeout | Convex built-in timeout prevents infinite execution |

### Thread Linking

All threads in a multi-agent conversation share the same `conversationId`. Child threads store a `parentThreadId` linking back to the parent. Thread metadata includes:

```typescript
{
  conversationId: string,
  parentAgentSlug: string,
  depth: number,
  parentContext: object,
}
```

## Model Pricing

See [Model Configuration](../reference/model-configuration) for the full list of supported models, pricing, and configuration options.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat` | POST | Chat by agent ID (Bearer token with API key) |
| `/v1/agents/:slug/chat` | POST | Chat by agent slug (Bearer token with API key) |

Both endpoints require a valid API key passed as a Bearer token. The environment is determined by the API key's environment field.

### Response Format

```typescript
{
  threadId: string,
  message: string,
  usage: {
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    durationMs: number,
  }
}
```

