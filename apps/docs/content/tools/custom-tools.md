---
title: "Custom Tools"
description: "Build custom tool handlers executed on the tool executor service"
section: "Tools"
order: 2
---

Custom tools extend your agents' capabilities beyond the built-in data, event, and agent tools. Tool handlers are defined in your project and executed on the tool executor service with a restricted fetch allowlist.

## Defining Custom Tools

Create a `tools/index.ts` file in your project root and use `defineTools` to register your custom tools:

```typescript
import { defineTools } from 'struere'

export default defineTools([
  {
    name: "send_email",
    description: "Send an email to a recipient",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body content" },
      },
      required: ["to", "subject", "body"],
    },
    handler: async (args, context, fetch) => {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: args.to }] }],
          from: { email: "noreply@example.com" },
          subject: args.subject,
          content: [{ type: "text/plain", value: args.body }],
        }),
      })
      return { success: response.ok }
    },
  },
])
```

## Tool Definition Schema

Each custom tool requires the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique tool name. Used to reference the tool in agent definitions. |
| `description` | `string` | Yes | Human-readable description. Passed to the LLM to help it understand when to use the tool. |
| `parameters` | `object` | Yes | JSON Schema defining the tool's input parameters. |
| `handler` | `function` | Yes | Async function that executes the tool logic. |

The `parameters` field follows the JSON Schema specification:

```typescript
{
  name: "create_stripe_customer",
  description: "Create a new customer in Stripe",
  parameters: {
    type: "object",
    properties: {
      email: { type: "string", description: "Customer email" },
      name: { type: "string", description: "Customer name" },
    },
    required: ["email", "name"],
  },
  handler: async (args, context, fetch) => {
    const response = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `email=${encodeURIComponent(args.email)}&name=${encodeURIComponent(args.name)}&metadata[orgId]=${context.organizationId}`,
    })
    const customer = await response.json()
    return { customerId: customer.id, email: customer.email }
  },
}
```

## Handler Function Signature

```typescript
handler: (args: object, context: ExecutionContext, fetch: SandboxedFetch) => Promise<any>
```

### args

The parsed arguments object matching the tool's `parameters` schema. The LLM generates these based on the conversation context.

### context (ExecutionContext)

Provides information about the calling actor:

```typescript
interface ExecutionContext {
  organizationId: string
  actorId: string
  actorType: "user" | "agent" | "system"
}
```

| Field | Description |
|-------|-------------|
| `organizationId` | The Convex organization ID of the caller |
| `actorId` | The ID of the user or agent making the call |
| `actorType` | Whether the caller is a `"user"`, `"agent"`, or `"system"` |

Use the context to scope your tool's behavior to the current organization and actor:

```typescript
handler: async (args, context, fetch) => {
  const response = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `email=${args.email}&metadata[orgId]=${context.organizationId}`,
  })
  return await response.json()
}
```

### fetch (SandboxedFetch)

A restricted version of the standard `fetch` API that only allows requests to approved domains. Attempts to call domains outside the allowlist will throw an error.

## Sandboxed Fetch Allowlist

The following domains are permitted for outbound requests from custom tool handlers:

| Domain | Typical Use |
|--------|-------------|
| `api.openai.com` | OpenAI API calls |
| `api.anthropic.com` | Anthropic API calls |
| `api.stripe.com` | Payment processing |
| `api.sendgrid.com` | Email delivery |
| `api.twilio.com` | SMS and voice |
| `hooks.slack.com` | Slack webhook notifications |
| `discord.com` | Discord webhook notifications |
| `api.github.com` | GitHub API integration |

Any `fetch` call to a domain not on this list will be rejected with an error.

## Execution Environment

Custom tool handlers execute on the tool executor service at `tool-executor.struere.dev`. The execution flow is:

```
Agent LLM decides to use custom tool
    |
    v
Convex backend receives tool call
    |
    v
POST to tool-executor.struere.dev/execute
    |
    v
Handler code executes in sandbox
    |
    v
Result returned to agent LLM loop
```

The tool executor also provides a validation endpoint at `POST /validate` that checks handler code syntax before deployment.

## Using Custom Tools in Agents

Reference custom tools by name in your agent definitions alongside built-in tools:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Notification Agent",
  slug: "notifications",
  version: "0.1.0",
  systemPrompt: "You send notifications to users via email and Slack.",
  model: { provider: "anthropic", name: "claude-sonnet-4" },
  tools: [
    "entity.query",
    "event.emit",
    "send_email",
    "send_slack_notification",
  ],
})
```

## Complete Example

A `tools/index.ts` with multiple custom tools:

```typescript
import { defineTools } from 'struere'

export default defineTools([
  {
    name: "send_email",
    description: "Send an email to a recipient",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body content" },
      },
      required: ["to", "subject", "body"],
    },
    handler: async (args, context, fetch) => {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: args.to }] }],
          from: { email: "noreply@example.com" },
          subject: args.subject,
          content: [{ type: "text/plain", value: args.body }],
        }),
      })
      return { success: response.ok }
    },
  },
  {
    name: "send_slack_notification",
    description: "Post a message to a Slack channel via webhook",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message text to post" },
        channel: { type: "string", description: "Slack channel name" },
      },
      required: ["message"],
    },
    handler: async (args, context, fetch) => {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: args.message,
          channel: args.channel,
        }),
      })
      return { success: response.ok }
    },
  },
  {
    name: "create_stripe_customer",
    description: "Create a new customer in Stripe",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string", description: "Customer email" },
        name: { type: "string", description: "Customer name" },
      },
      required: ["email", "name"],
    },
    handler: async (args, context, fetch) => {
      const response = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `email=${encodeURIComponent(args.email)}&name=${encodeURIComponent(args.name)}&metadata[orgId]=${context.organizationId}`,
      })
      const customer = await response.json()
      return { customerId: customer.id, email: customer.email }
    },
  },
])
```
