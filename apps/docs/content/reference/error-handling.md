---
title: "Error Handling"
description: "How errors propagate through the platform and how to handle them"
section: "Reference"
order: 6
---

# Error Handling

Errors in Struere propagate through three distinct layers: the HTTP API layer, the permission engine, and the application layer (tool calls, authentication, billing). Each layer has its own error format and recovery path. Understanding how errors flow through these layers is essential for building resilient agents and reliable API integrations.

## Error Layers Overview

```
HTTP Request
    |
    v
┌──────────────────────────────────┐
│  HTTP API Layer                  │
│  JSON responses with status codes│
│  Returned to the API caller      │
└──────────────┬───────────────────┘
               |
               v
┌──────────────────────────────────┐
│  Permission Engine Layer         │
│  PermissionError class           │
│  Deny-overrides-allow evaluation │
└──────────────┬───────────────────┘
               |
               v
┌──────────────────────────────────┐
│  Application Layer               │
│  Tool call results, auth errors, │
│  billing checks, rate limits     │
└──────────────────────────────────┘
```

## HTTP API Errors

All HTTP endpoints return errors as JSON objects with an `error` field:

```json
{ "error": "Error description" }
```

### Status Codes

| Status | Meaning | When It Occurs |
|--------|---------|----------------|
| `400` | Bad Request | Missing required fields in the request body |
| `401` | Unauthorized | Missing or invalid Bearer token, expired API key |
| `402` | Payment Required | Insufficient credits when using platform credits |
| `404` | Not Found | Agent or resource does not exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unhandled exceptions during request processing |

### Rate Limiting

When a request exceeds the rate limit, the API returns a `429` response with a `Retry-After` header indicating how many seconds to wait:

```json
{ "error": "Rate limit exceeded", "retryAt": 1709312400000 }
```

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 5
```

Rate limits are enforced at two levels:

| Limit | Type | Rate |
|-------|------|------|
| Per API key | Token bucket | 30 requests/minute, burst capacity 10 |
| Per organization | Token bucket | 100 requests/minute, burst capacity 30 |

### Request Validation

The API validates required fields before executing any logic. Missing fields return a `400` status:

```json
{ "error": "agentId and message are required" }
```

```json
{ "error": "message is required" }
```

```json
{ "error": "slug is required" }
```

For a complete list of per-endpoint error codes and status mappings, see [Error Codes](/reference/error-codes).

## Permission Errors

The permission engine evaluates access using a deny-overrides-allow model. Permission errors are represented by the `PermissionError` class:

```typescript
class PermissionError extends Error {
  readonly reason: string
  readonly actor: ActorContext
  readonly action: Action
  readonly resource: string
}
```

### canPerform vs assertCanPerform

The permission engine provides two evaluation functions with different error handling semantics:

| Function | Behavior | Use Case |
|----------|----------|----------|
| `canPerform()` | Returns a `PermissionResult` object with `allowed: boolean` and `reason` | Tool calls, where denial should be returned as a result |
| `assertCanPerform()` | Throws `PermissionError` if denied | Mutations, where denial should halt execution |

`canPerform()` returns a result object:

```typescript
interface PermissionResult {
  allowed: boolean
  reason?: string
  matchedPolicy?: Id<"policies">
  evaluatedPolicies?: number
}
```

`assertCanPerform()` throws on denial:

```
Permission denied: No policy grants update on payment
```

### Evaluation Order

The deny-overrides-allow evaluation follows this order:

1. **Organization admin** -- If the actor is an org admin, access is always allowed
2. **No roles** -- If the actor has no roles and is not a system actor, access is denied with `"Actor has no roles assigned"`
3. **Deny check** -- If any matching policy has `effect: "deny"`, access is denied with `"Denied by policy: <policyId>"`
4. **Allow check** -- At least one matching policy must have `effect: "allow"` for access to be granted
5. **No match** -- If no policies match, access is denied with `"No policy grants <action> on <resource>"`

All denials are logged with the actor context, action, resource, and reason for audit purposes.

### Permission Errors in Tool Calls

When an agent calls a tool that requires a permission check, the result of `canPerform()` is checked before execution. If the permission is denied, the error is returned as the tool result string rather than thrown:

```json
{ "error": "Permission denied: No policy grants update on payment" }
```

The agent sees this error in its next LLM iteration and can decide how to proceed -- inform the user, try a different approach, or skip the action.

## Authentication Errors

Authentication errors are thrown as standard `Error` instances at the start of request processing. These surface as `500` errors in HTTP responses or halt Convex function execution.

| Error Message | Cause |
|---------------|-------|
| `"Not authenticated"` | No valid Clerk identity found in the request context |
| `"User not found. Please ensure your account is provisioned."` | Clerk identity exists but no matching user record in the database |
| `"No organization found. Please create or join an organization."` | User exists but has no organization memberships |
| `"Organization not found."` | Organization reference is invalid or deleted |
| `"Access denied to organization"` | User attempted to access an organization they are not a member of |
| `"Access denied: you are not a member of this organization"` | Explicit organization access request denied |
| `"Admin access required"` | Operation requires org admin role but the user is a regular member |
| `"Authentication required"` | `requireAuth()` was called but returned no auth context |
| `"Invalid API key"` | API key hash does not match any record or the key has expired |

### API Key Authentication

API key errors in the HTTP layer return `401` responses:

```json
{ "error": "Unauthorized" }
```

This covers both missing and invalid API keys. The API does not distinguish between the two cases in the response to avoid information leakage.

## Tool Call Errors

When a tool call fails during agent execution, the error is caught and returned as the tool result. The agent continues its LLM loop with the error visible in its context.

```typescript
try {
  // execute tool
} catch (error) {
  return { error: error instanceof Error ? error.message : "Tool execution failed" }
}
```

### Built-in Tool Errors

| Error | Cause |
|-------|-------|
| `"Permission denied: <reason>"` | Actor's role lacks the required policy for the action |
| `"Entity not found"` | Invalid entity ID passed to `entity.get` or `entity.update` |
| `"Tool not available: <toolName>"` | Tool is not in the agent's configured tools list |
| `"Tool has no handler"` | Tool exists in configuration but has no handler code |
| `"Tool execution failed"` | Generic fallback for unexpected errors |

### Custom Tool Errors

Custom tool handlers execute on the tool executor service. Any exception thrown in the handler is caught and returned to the agent as a tool result:

```typescript
handler: async (args, context, struere, fetch) => {
  const response = await fetch("https://api.stripe.com/v1/charges", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.STRIPE_KEY}` },
    body: `amount=${args.amount}`,
  })
  if (!response.ok) {
    throw new Error(`Stripe charge failed: ${response.status} ${response.statusText}`)
  }
  return await response.json()
}
```

The error message from the `throw` is passed directly to the agent. Descriptive errors give the agent context to recover or inform the user.

### Sandboxed Fetch Errors

Custom tool handlers use a restricted `fetch` that only allows requests to approved domains. Attempts to call unauthorized domains throw:

```
Fetch to api.example.com is not allowed. Allowed domains: api.openai.com, api.anthropic.com, api.stripe.com, api.sendgrid.com, api.twilio.com, hooks.slack.com, discord.com, api.github.com
```

## Credit and Billing Errors

When an organization uses platform credits (no direct provider key or OpenRouter key configured), credit balance is checked before execution. If the balance is insufficient, the request fails:

```
Insufficient credits. Please add credits to your account.
```

This error propagates through the agent execution action and surfaces as a `500` in the HTTP API response. The check runs before the LLM call is made, so no tokens are consumed on insufficient balance.

To avoid billing errors:
- Monitor credit balance in the dashboard under **Billing**
- Configure a provider key or OpenRouter key in **Settings > Providers** to bypass credit checks
- Purchase credits via the dashboard checkout flow

## Agent Execution Errors

Errors during the agent's LLM loop are handled at different stages:

| Stage | Error Handling |
|-------|---------------|
| API key validation | Returns `401` HTTP response |
| Rate limit check | Returns `429` HTTP response with `Retry-After` |
| Agent lookup | Throws `"Agent not found"` |
| Config lookup | Throws `"No active config found"` |
| Credit check | Throws `"Insufficient credits"` |
| LLM call | Retries up to 2 times, then throws |
| Tool call | Caught and returned as tool result |
| Response persistence | Throws on database errors |

Tool call errors are the only errors that do not halt execution. All other errors propagate to the HTTP layer and return a `500` response.

## Thread Context Validation Errors

When agents define thread context parameter schemas, incoming parameters are validated before execution:

| Error | Cause |
|-------|-------|
| `"Missing required thread context param: <name>"` | A required parameter was not provided |
| `"Thread context param "<name>" must be a string"` | Parameter type does not match the schema |
| `"Thread context param "<name>" must be a number"` | Parameter type does not match the schema |
| `"Thread context param "<name>" must be a boolean"` | Parameter type does not match the schema |

## Best Practices

### Design System Prompts for Error Recovery

Agents that encounter tool errors continue their LLM loop with the error visible. Include instructions in your system prompt for how the agent should respond:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Resilient Agent",
  slug: "resilient",
  systemPrompt: `You are an assistant for {{organizationName}}.

## Error Handling Rules
- If a tool call returns a permission error, tell the user you cannot perform that action and suggest they contact an administrator.
- If entity.create fails with a validation error, review the entity type schema and correct the data before retrying.
- If entity.query returns empty results, consider whether scope rules may be filtering results and inform the user.
- Never retry the exact same tool call with the same arguments more than once.`,
  model: { model: "xai/grok-4-1-fast" },
  tools: ["entity.query", "entity.create", "entity.update"],
})
```

### Throw Descriptive Errors in Custom Tools

The error message from a custom tool handler is the only context the agent has for recovery. Include what failed and why:

```typescript
// Bad - agent has no context
throw new Error("failed")

// Good - agent can inform the user
throw new Error(`Payment processing failed for amount ${args.amount}: card declined`)
```

### Handle Rate Limits with Retry-After

API clients should read the `Retry-After` header from `429` responses and wait before retrying:

```typescript
const response = await fetch("https://your-deployment.convex.site/v1/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_dev_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ agentId: "...", message: "Hello" }),
})

if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get("Retry-After") ?? "5")
  await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
  // retry the request
}
```

### Distinguish Empty Results from Errors

An `entity.query` that returns an empty array is not an error. It means no records matched the filters, potentially because scope rules restrict the actor's visibility. Do not treat empty results as failures in your system prompt or client code.

## Related

- [Error Codes](/reference/error-codes) -- Per-endpoint HTTP status codes and error messages
- [Permissions](/platform/permissions) -- Permission engine architecture and evaluation rules
- [How do I handle tool call errors?](/knowledge-base/how-to-handle-tool-errors) -- Agent-side error recovery guide
- [How do I debug permission denied?](/knowledge-base/how-to-debug-permission-denied) -- Permission troubleshooting steps
- [Limits and Quotas](/reference/limits) -- Platform limits that can trigger errors
- [Custom Tools](/tools/custom-tools) -- Custom tool handler reference
