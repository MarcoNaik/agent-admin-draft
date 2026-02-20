---
title: "Chat API"
description: "Send messages to agents via HTTP"
section: "API Reference"
order: 2
---

# Chat API

The Chat API allows you to send messages to agents and receive responses over HTTP. There are two endpoints: one that identifies agents by their Convex document ID, and one that uses human-readable slugs.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/chat` | Chat by agent ID |
| `POST` | `/v1/agents/:slug/chat` | Chat by agent slug |

Both endpoints require a Bearer token (API key) for authentication. The API key determines which **environment** (development or production) the request operates in.

## POST /v1/chat

Send a message to an agent by its Convex document ID.

### Request

**Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer YOUR_API_KEY` |
| `Content-Type` | `application/json` |

**Body:**

```json
{
  "agentId": "abc123def456",
  "message": "Hello, can you help me schedule a session?",
  "threadId": "thread_xyz789",
  "externalThreadId": "my-app:user-123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `string` | Yes | The Convex document ID of the agent |
| `message` | `string` | Yes | The user's message to the agent |
| `threadId` | `string` | No | An existing thread ID to continue a conversation |
| `externalThreadId` | `string` | No | An external identifier for thread reuse (e.g., `"whatsapp:+1234567890"`) |

### Response

```json
{
  "threadId": "thread_xyz789",
  "message": "I'd be happy to help you schedule a session. What subject and time works best?",
  "usage": {
    "inputTokens": 1250,
    "outputTokens": 45,
    "totalTokens": 1295
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `threadId` | `string` | The thread ID for this conversation |
| `message` | `string` | The agent's response text |
| `usage` | `object` | Token usage for this interaction |
| `usage.inputTokens` | `number` | Number of input tokens consumed |
| `usage.outputTokens` | `number` | Number of output tokens generated |
| `usage.totalTokens` | `number` | Total tokens used |

### Example

```bash
curl -X POST https://your-deployment.convex.site/v1/chat \
  -H "Authorization: Bearer sk_dev_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "jd72k3m4n5p6q7r8",
    "message": "What sessions are scheduled for tomorrow?"
  }'
```

## POST /v1/agents/:slug/chat

Send a message to an agent by its slug. This is the preferred endpoint for integrations as slugs are stable and human-readable.

### Request

**Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer YOUR_API_KEY` |
| `Content-Type` | `application/json` |

**Body:**

```json
{
  "message": "Hello, can you help me schedule a session?",
  "threadId": "thread_xyz789",
  "externalThreadId": "my-app:user-123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | The user's message to the agent |
| `threadId` | `string` | No | An existing thread ID to continue a conversation |
| `externalThreadId` | `string` | No | An external identifier for thread reuse |

Note that `agentId` is **not** needed since the agent is identified by the `:slug` URL parameter.

### Response

The response format is identical to the `/v1/chat` endpoint.

### Example

```bash
curl -X POST https://your-deployment.convex.site/v1/agents/scheduler/chat \
  -H "Authorization: Bearer sk_prod_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Book a math session with Mr. Smith for Tuesday at 3 PM"
  }'
```

## Thread Management

### Creating New Threads

If neither `threadId` nor `externalThreadId` is provided, a new thread is created automatically. The response includes the `threadId` which you should store for subsequent messages.

### Continuing Conversations

Pass the `threadId` from a previous response to continue the conversation. The agent receives the full message history from the thread, maintaining context across messages.

```bash
curl -X POST https://your-deployment.convex.site/v1/agents/support/chat \
  -H "Authorization: Bearer sk_dev_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Actually, make that Thursday instead",
    "threadId": "jd72k3m4n5p6q7r8"
  }'
```

### External Thread IDs

The `externalThreadId` field allows you to map external identifiers to Struere threads. If a thread with the given `externalThreadId` already exists, it is reused. Otherwise, a new thread is created.

This is useful for integrations where you want to maintain a single conversation thread per external user or channel:

```json
{
  "message": "What is my account balance?",
  "externalThreadId": "slack:U12345678"
}
```

Common patterns:
- `whatsapp:+1234567890` for WhatsApp conversations
- `slack:U12345678` for Slack user threads
- `app:user-abc123` for your application's user IDs

## Environment Scoping

The API key determines the environment for the entire request:

- **Development API keys** (`sk_dev_...`) access development agent configurations, development entities, and development threads
- **Production API keys** (`sk_prod_...`) access production agent configurations, production entities, and production threads

There is no way to specify the environment in the request body. It is always derived from the API key.

## Execution Flow

When a chat request arrives:

1. The API key is validated and the environment is extracted
2. The agent and its configuration are loaded for the matching environment
3. A thread is retrieved or created
4. The system prompt is processed (template variables and function calls resolved)
5. The LLM is called in a loop (up to 10 iterations) to handle tool calls
6. Each tool call is permission-checked against the actor context
7. The final response, thread ID, and usage stats are returned

## Error Responses

**401 Unauthorized:**

```json
{ "error": "Unauthorized" }
```

**400 Bad Request:**

```json
{ "error": "agentId and message are required" }
```

```json
{ "error": "message is required" }
```

**500 Internal Server Error:**

```json
{ "error": "Agent not found" }
```

```json
{ "error": "No active config found for agent \"scheduler\" in production" }
```
