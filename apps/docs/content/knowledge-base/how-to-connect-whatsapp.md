---
title: "How do I connect WhatsApp to my agent?"
description: "Set up WhatsApp messaging through Kapso so your agent can receive and respond to messages"
section: "Knowledge Base"
order: 3
---

# How do I connect WhatsApp to my agent?

## Quick Answer

Struere integrates WhatsApp through the Kapso service. Create a WhatsApp connection in the dashboard, complete the Kapso setup flow to link your phone number, then assign an agent to handle inbound messages.

## Step by Step

### 1. Create a WhatsApp connection

In the dashboard, navigate to **Integrations > WhatsApp** and click **Connect WhatsApp**. This generates a Kapso setup link.

### 2. Complete the Kapso setup flow

Follow the setup link to connect your WhatsApp Business account through Kapso. When the phone number is successfully linked, Kapso sends a webhook to your Convex deployment at `POST /webhook/kapso/project`, which:

1. Stores the Kapso phone number ID
2. Sets the connection status to `connected`
3. Registers the message webhook URL with Kapso

### 3. Assign an agent

In the dashboard, select the WhatsApp connection and assign an agent to handle inbound messages. The agent must have the WhatsApp tools in its configuration:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "WhatsApp Support",
  slug: "whatsapp-support",
  tools: [
    "entity.query",
    "entity.update",
    "whatsapp.send",
    "whatsapp.getConversation",
    "whatsapp.getStatus",
  ],
  systemPrompt: `You are a support agent for {{organizationName}}.
You are chatting with a customer on WhatsApp. Be concise and helpful.`,
  model: { provider: "xai", name: "grok-4-1-fast" },
})
```

### 4. Message flow

When a WhatsApp message arrives:

```
Inbound message → Kapso → POST /webhook/kapso/messages
    → Store message in whatsappMessages table
    → scheduleAgentRouting → routeInboundToAgent
    → Agent processes via chatAuthenticated (system actor)
    → Agent response sent back via Kapso API
```

Threads are created with `externalId` set to `whatsapp:{phoneNumber}`, so conversations with the same phone number continue in the same thread.

### 5. Sending messages proactively

Agents can send messages using the `whatsapp.send` tool:

```typescript
// In a tool call from the agent
{
  tool: "whatsapp.send",
  args: {
    phoneNumber: "+1234567890",
    message: "Your session has been confirmed for tomorrow at 3 PM."
  }
}
```

### 6. Required environment variables

Set these in your Convex deployment:

| Variable | Description |
|----------|-------------|
| `KAPSO_WEBHOOK_SECRET` | Shared secret for HMAC signature verification |

## Common Mistakes

- **Not setting the webhook secret.** Without `KAPSO_WEBHOOK_SECRET`, inbound message webhooks will fail signature verification.
- **Forgetting WhatsApp tools.** The agent needs `whatsapp.send`, `whatsapp.getConversation`, and/or `whatsapp.getStatus` in its tools list.
- **Testing with production keys.** WhatsApp connections are environment-scoped. Connect in development first, then set up a separate connection for production.

## Related

- [WhatsApp Integration](/integrations/whatsapp) — Full integration reference
- [Webhooks](/api/webhooks) — Webhook endpoint details
- [How do I manage environments?](/knowledge-base/how-to-manage-environments) — Environment scoping
