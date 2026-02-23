---
title: "Error Codes"
description: "HTTP error codes and error response formats across all endpoints"
section: "Reference"
order: 4
---

# Error Codes

All Struere HTTP endpoints return errors as JSON objects with an `error` field:

```json
{ "error": "Error description" }
```

## Chat API Errors

### POST /v1/chat

| Status | Error | Cause |
|--------|-------|-------|
| `401` | `"Unauthorized"` | Missing or invalid Bearer token |
| `400` | `"agentId and message are required"` | Request body missing `agentId` or `message` |
| `500` | `"Agent not found"` | No agent exists with the given ID |
| `500` | `"No active config found for agent in environment"` | Agent exists but has no configuration for the API key's environment |

### POST /v1/agents/:slug/chat

| Status | Error | Cause |
|--------|-------|-------|
| `401` | `"Unauthorized"` | Missing or invalid Bearer token |
| `400` | `"message is required"` | Request body missing `message` |
| `500` | `"Agent not found"` | No agent matches the slug |
| `500` | `"No active config found for agent \"slug\" in environment"` | Agent has no config for the API key's environment |

## Webhook Errors

### POST /webhook/clerk

| Status | Cause |
|--------|-------|
| `200` | Success (`{"received": true}`) |
| `500` | Processing failure |

### POST /webhook/kapso/project

| Status | Cause |
|--------|-------|
| `200` | Success |
| `400` | HMAC signature verification failed |
| `500` | Processing failure |

### POST /webhook/kapso/messages

| Status | Cause |
|--------|-------|
| `200` | Success |
| `400` | HMAC signature verification failed |
| `500` | Processing failure (e.g., phone number not found) |

### POST /webhook/flow

| Status | Cause |
|--------|-------|
| `200` | Always returns 200 to acknowledge receipt |

### POST /webhook/polar

| Status | Cause |
|--------|-------|
| `200` | Success |
| `400` | Signature verification failed or timestamp too old (>5 minutes) |

## Permission Engine Errors

Permission errors are not returned as HTTP errors. They are returned as tool call results to the agent:

| Error | Cause |
|-------|-------|
| `"Permission denied: cannot perform 'action' on 'resource'"` | Role lacks an allow policy for the resource and action |
| `"Permission denied: denied by policy"` | A deny policy overrides the allow |
| `"Tool not available: toolName"` | Tool is not in the agent's tools list |

## Tool Executor Errors

### POST /execute

| Status | Error | Cause |
|--------|-------|-------|
| `200` | `{ "error": "message" }` | Handler code threw an exception |
| `400` | Validation error | Missing required fields in request |
| `500` | Execution timeout | Handler exceeded execution time |

### POST /validate

| Status | Error | Cause |
|--------|-------|-------|
| `200` | `{ "valid": false, "error": "message" }` | Syntax error in handler code |
| `200` | `{ "valid": true }` | Handler code is syntactically valid |

## Common Patterns

### API Key Issues

If you receive `401 Unauthorized`:
1. Verify the API key is included in the `Authorization` header as `Bearer YOUR_KEY`
2. Verify the key has not been revoked in the dashboard
3. Verify you are using the correct environment key (`sk_dev_` vs `sk_prod_`)

### Agent Not Found

If you receive `"Agent not found"` or `"No active config found"`:
1. Verify the agent slug or ID is correct
2. Verify the agent has been synced (`struere dev`) or deployed (`struere deploy`)
3. Verify the API key's environment matches the agent config's environment
