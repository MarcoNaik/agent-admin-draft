---
title: "WhatsApp Integration"
description: "WhatsApp messaging integration via Kapso"
section: "Integrations"
order: 1
---

# WhatsApp Integration

Struere integrates with WhatsApp through the **Kapso** service, which manages the WhatsApp Business API connection. This allows agents to receive and respond to WhatsApp messages, with conversations persisted and routed through the platform's standard agent execution pipeline.

## Architecture

```
WhatsApp User
    |
    v
WhatsApp Business API
    |
    v
Kapso Service (manages phone numbers, message routing)
    |
    v
Convex Webhooks (/webhook/kapso/project, /webhook/kapso/messages)
    |
    v
Struere Backend (message storage, agent routing)
    |
    v
Agent LLM Execution
    |
    v
Kapso API (outbound message delivery)
    |
    v
WhatsApp User receives response
```

## Database Tables

### whatsappConnections

Stores the connection state between an organization and a WhatsApp phone number. Scoped by environment.

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | `Id<"organizations">` | The owning organization |
| `environment` | `"development" \| "production"` | Environment scope |
| `status` | `"disconnected" \| "pending_setup" \| "connected"` | Current connection state |
| `phoneNumber` | `string?` | The connected phone number |
| `kapsoCustomerId` | `string?` | Kapso customer identifier |
| `kapsoPhoneNumberId` | `string?` | Kapso phone number identifier |
| `agentId` | `Id<"agents">?` | The agent assigned to handle inbound messages |
| `setupLinkUrl` | `string?` | URL for the phone number setup flow |
| `lastConnectedAt` | `number?` | Timestamp of last successful connection |
| `lastDisconnectedAt` | `number?` | Timestamp of last disconnection |

### whatsappMessages

Stores all inbound and outbound messages with delivery status tracking.

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | `Id<"organizations">` | The owning organization |
| `direction` | `"inbound" \| "outbound"` | Message direction |
| `phoneNumber` | `string` | The external phone number |
| `messageId` | `string` | Unique message identifier from Kapso/WhatsApp |
| `type` | `string` | Message type (e.g., `"text"`) |
| `text` | `string?` | Message text content |
| `threadId` | `Id<"threads">?` | Linked conversation thread |
| `status` | `string` | Delivery status (`"received"`, `"sent"`, `"delivered"`, `"read"`, `"failed"`) |
| `createdAt` | `number` | Message timestamp |

## Setup Flow

### 1. Enable the Integration

Enable WhatsApp for your organization and environment through the dashboard or API:

```typescript
await whatsapp.enableWhatsApp({ environment: "development" })
```

This creates an integration config entry with provider `"whatsapp"` and status `"active"`.

### 2. Start Phone Setup

Initiate the WhatsApp phone number connection:

```typescript
await whatsapp.setupWhatsApp({ environment: "development" })
```

This triggers an asynchronous flow:
1. A Kapso customer is created for your organization
2. A setup link URL is generated
3. The connection status moves to `"pending_setup"`
4. The setup link is stored on the connection record

### 3. Complete Phone Connection

The user follows the setup link to connect their WhatsApp Business phone number through Kapso's interface. Once complete, the `whatsapp.phone_number.created` webhook fires and:

1. The connection status updates to `"connected"`
2. The Kapso phone number ID and phone number are stored
3. A message webhook is registered with Kapso pointing to `/webhook/kapso/messages`

### 4. Assign an Agent

Assign an agent to handle inbound messages:

```typescript
await whatsapp.setWhatsAppAgent({
  agentId: "agent_id_here",
  environment: "development",
})
```

## Inbound Message Routing

When a WhatsApp message arrives, the following sequence executes:

```
POST /webhook/kapso/messages
    |
    v
Verify HMAC-SHA256 signature
    |
    v
Look up connection by kapsoPhoneNumberId
    |
    v
processInboundMessage (store message, deduplicate by messageId)
    |
    v
scheduleAgentRouting (mutation, schedules action via ctx.scheduler)
    |
    v
routeInboundToAgent (action)
    |
    v
threads.getOrCreate with externalId = "whatsapp:{phoneNumber}"
    |
    v
agent.chatAuthenticated (system actor, no user)
    |
    v
Send response via Kapso sendTextMessage API
    |
    v
storeOutboundMessage (persist response in whatsappMessages)
```

### Thread Reuse

Conversations with a given phone number are grouped into a single thread using the `externalId` pattern `whatsapp:{phoneNumber}`. The `threads.getOrCreate` mutation looks up existing threads by this external ID, ensuring all messages from the same WhatsApp number flow through the same conversation context.

### System Actor Context

Inbound WhatsApp messages are processed using a **system actor context** because there is no authenticated Clerk user for the incoming message. The system actor has `isOrgAdmin: true` and operates with full permissions within the organization's environment.

## Outbound Messages

Agents send responses back to WhatsApp users through the Kapso API. When the agent's LLM loop completes:

1. The response text is extracted from the agent's reply
2. The `sendTextMessage` function calls the Kapso API with the phone number and text
3. The outbound message is stored in `whatsappMessages` with its Kapso message ID
4. Delivery status updates arrive via the status update webhook

## Message Status Tracking

Outbound message status progresses through these states:

```
sent -> delivered -> read
  \
   -> failed
```

Status updates are received via the `whatsapp.message.status_update` event type on the messages webhook and applied to the corresponding message record.

## WhatsApp Tools

Agents can also interact with WhatsApp programmatically through built-in WhatsApp tools:

### whatsapp.send

Send a text message to a phone number:

```typescript
{
  to: "+1234567890",
  text: "Your session is confirmed for tomorrow at 3 PM."
}
```

### whatsapp.getConversation

Retrieve message history for a phone number:

```typescript
{
  phoneNumber: "+1234567890",
  limit: 20
}
```

### whatsapp.getStatus

Check the current WhatsApp connection status for the organization.

## Template Messages

For sending structured WhatsApp templates (pre-approved message formats), use the `sendTemplate` action:

```typescript
await whatsapp.sendTemplate({
  threadId: "thread_id",
  templateName: "session_reminder",
  language: "en",
  components: [
    {
      type: "body",
      parameters: [
        { type: "text", text: "Tuesday, March 15" },
        { type: "text", text: "3:00 PM" },
      ],
    },
  ],
})
```

Template messages are stored with the text `[Template: templateName]` in the message history.

## Disconnecting

To disconnect WhatsApp from an environment:

```typescript
await whatsapp.disconnectWhatsApp({ environment: "development" })
```

This sets the connection status to `"disconnected"` and clears the phone number and setup link fields. The Kapso customer record is retained for potential reconnection.

## Required Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `KAPSO_API_KEY` | Convex | API key for the Kapso service |
| `KAPSO_WEBHOOK_SECRET` | Convex | Shared secret for webhook signature verification |
| `CONVEX_SITE_URL` | Convex | Your Convex site URL (used to construct webhook callback URLs) |
