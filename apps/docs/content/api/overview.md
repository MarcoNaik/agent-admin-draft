---
title: "API Overview"
description: "HTTP endpoints for interacting with Struere"
section: "API Reference"
order: 1
---

# API Overview

Struere exposes HTTP endpoints through its Convex backend for agent communication, webhook processing, and health monitoring. Your base URL is your Convex deployment URL (the `CONVEX_SITE_URL`).

## Authentication

Chat endpoints authenticate via **Bearer token** using API keys. API keys are created in the Struere dashboard under **API Keys** and are scoped to a specific environment (`development` or `production`).

```
Authorization: Bearer sk_dev_abc123...
```

The environment of the API key determines which environment the request operates in. A development API key accesses development agents, entities, and configurations. A production API key accesses production data. There is no way to cross environments with a single key.

API keys are validated by computing a SHA-256 hash and looking up the hashed value in the database.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | None | Health check |
| `POST` | `/v1/chat` | Bearer token | Chat with an agent by agent ID |
| `POST` | `/v1/agents/:slug/chat` | Bearer token | Chat with an agent by slug |
| `POST` | `/webhook/clerk` | None | Clerk user/organization sync webhook |
| `POST` | `/webhook/kapso/project` | HMAC signature | WhatsApp phone number connection events |
| `POST` | `/webhook/kapso/messages` | HMAC signature | WhatsApp inbound messages and status updates |
| `POST` | `/webhook/flow` | None | Flow payment status updates |
| `POST` | `/webhook/polar` | HMAC signature | Polar payment/billing events |

## GET /health

Returns the current server status and timestamp.

**Request:**

```bash
curl https://your-deployment.convex.site/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": 1710500000000
}
```

## POST /v1/chat

Send a message to an agent identified by its Convex document ID. See the [Chat API](./chat) documentation for full details.

## POST /v1/agents/:slug/chat

Send a message to an agent identified by its slug. This is the preferred endpoint for external integrations as slugs are human-readable and stable across deployments. See the [Chat API](./chat) documentation for full details.

## Webhook Endpoints

Webhook endpoints receive events from external services. See the [Webhooks](./webhooks) documentation for details on each webhook.

## Error Responses

All endpoints return JSON error responses with appropriate HTTP status codes:

**401 Unauthorized** — Missing or invalid API key:

```json
{
  "error": "Unauthorized"
}
```

**400 Bad Request** — Missing required fields:

```json
{
  "error": "agentId and message are required"
}
```

**500 Internal Server Error** — Server-side execution failure:

```json
{
  "error": "Error description"
}
```

## Rate Limiting

Rate limits are enforced at the Convex platform level. Refer to your Convex plan for specific limits on function calls and bandwidth.

## CORS

The HTTP endpoints do not set CORS headers by default. For browser-based integrations, use the Convex React client which connects over WebSocket rather than HTTP.
