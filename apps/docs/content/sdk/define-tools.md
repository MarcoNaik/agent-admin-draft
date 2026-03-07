---
title: "defineTools"
description: "Create custom tool handlers for agents"
section: "SDK"
order: 6
---

# defineTools

The `defineTools` function creates and validates custom tool handlers that agents can use alongside built-in tools. Custom tools are defined in `tools/index.ts` and are available to any agent in the organization.

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
    handler: async (args, context, struere, fetch) => {
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

## Tool Definition

Each tool in the array requires the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique tool identifier, referenced in agent `tools` arrays |
| `description` | `string` | Yes | Description shown to the LLM for tool selection |
| `parameters` | `ToolParameters` | Yes | JSON Schema defining the tool's input parameters |
| `handler` | `function` | Yes | Async function that executes when the tool is called |

### Validation

`defineTools` throws errors if any tool is missing `name`, `description`, `parameters`, or `handler`.

## Handler Function

The handler function receives four arguments:

```typescript
handler: async (args, context, struere, fetch) => {
  return { result: "value" }
}
```

| Argument | Type | Description |
|----------|------|-------------|
| `args` | `Record<string, unknown>` | Parsed arguments matching the `parameters` schema |
| `context` | `ExecutionContext` | Actor and organization context |
| `struere` | `StruereSDK` | SDK object providing access to all built-in tools |
| `fetch` | `function` | Fetch function restricted to allowed domains |

The handler must return a JSON-serializable value. This value is passed back to the LLM as the tool result.

### ExecutionContext

```typescript
interface ExecutionContext {
  organizationId: string
  actorId: string
  actorType: "user" | "agent" | "system"
}
```

### StruereSDK

The `struere` parameter gives custom tool handlers access to all built-in tools. This enables custom tools to compose platform operations without making raw API calls.

```typescript
import type { StruereSDK } from 'struere'
```

Available namespaces:

| Namespace | Methods |
|-----------|---------|
| `struere.entity` | `create`, `get`, `query`, `update`, `delete`, `link`, `unlink` |
| `struere.event` | `emit`, `query` |
| `struere.agent` | `chat` |

Example using `struere` to create an entity inside a custom tool handler:

```typescript
export default defineTools([
  {
    name: "onboard_student",
    description: "Register a new student and emit an onboarding event",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
      },
      required: ["name", "email"],
    },
    handler: async (args, context, struere) => {
      const student = await struere.entity.create({
        type: "student",
        data: { name: args.name, email: args.email },
      })
      await struere.event.emit({
        eventType: "student.onboarded",
        entityId: student.id,
      })
      return { studentId: student.id }
    },
  },
])
```

## Using Custom Tools in Agents

Reference custom tools by their `name` in any agent's `tools` array:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Support Agent",
  slug: "support",
  version: "1.0.0",
  systemPrompt: "You are a customer support agent.",
  tools: [
    "entity.query",
    "entity.update",
    "event.emit",
    "send_email",
  ],
})
```

Custom tool names and built-in tool names share the same namespace. Avoid naming conflicts by not using the `entity.`, `event.`, or `agent.` prefixes for custom tools.

For the sandboxed fetch allowlist, execution environment details, and more examples, see [Custom Tools](../tools/custom-tools).
