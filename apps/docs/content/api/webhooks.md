---
title: "Webhooks"
description: "Inbound webhook endpoints for external integrations"
section: "API Reference"
order: 3
---

# Webhooks

Struere provides webhook endpoints for receiving events from external services. These endpoints are registered in the Convex HTTP router and process incoming events to keep your platform synchronized with third-party systems.

## Clerk Webhook

**Endpoint:** `POST /webhook/clerk`

Receives user, organization, and membership events from Clerk to keep the Struere database in sync with your authentication provider.

### Supported Event Types

| Event Type | Action |
|------------|--------|
| `user.created` | Creates or updates the user record in Struere |
| `user.updated` | Updates the user's email and name |
| `organization.created` | Creates the organization in Struere |
| `organization.updated` | Updates the organization's name and slug |
| `organization.deleted` | Marks the organization as deleted |
| `organizationMembership.created` | Links a user to an organization with their role |
| `organizationMembership.updated` | Updates the user's role within the organization |
| `organizationMembership.deleted` | Removes a user's membership from the organization |

### Role Mapping

Clerk roles are mapped to Struere roles:

| Clerk Role | Struere Role |
|------------|--------------|
| `org:admin` | `admin` |
| `org:owner` | `admin` |
| All other roles | `member` |

### Setup

Configure the Clerk webhook in your Clerk Dashboard:

1. Navigate to **Webhooks** in the Clerk Dashboard
2. Create a new endpoint pointing to `https://your-deployment.convex.site/webhook/clerk`
3. Select the event types listed above
4. Save the endpoint

### Payload Example

```json
{
  "type": "user.created",
  "data": {
    "id": "user_2abc123",
    "email_addresses": [
      {
        "id": "idn_2def456",
        "email_address": "alice@example.com"
      }
    ],
    "first_name": "Alice",
    "last_name": "Smith",
    "created_at": 1700000000000,
    "updated_at": 1700000000000
  }
}
```

### Response

Returns `200` with `{"received": true}` on success, or `500` if processing fails.

## WhatsApp Webhooks (Kapso)

WhatsApp integration uses the Kapso service as an intermediary. Two webhook endpoints handle different aspects of the WhatsApp connection.

### Project Webhook

**Endpoint:** `POST /webhook/kapso/project`

Receives phone number connection events when a WhatsApp number is linked through the Kapso setup flow.

**Authentication:** HMAC-SHA256 signature verification via the `X-Kapso-Signature` header. The signature is computed over the raw request body using the `KAPSO_WEBHOOK_SECRET` environment variable.

**Event Types:**

| Event Type | Action |
|------------|--------|
| `whatsapp.phone_number.created` | Updates the WhatsApp connection status to `connected` and registers the message webhook |

When a phone number is connected, the system:
1. Finds the matching WhatsApp connection by Kapso customer ID
2. Stores the Kapso phone number ID and phone number
3. Sets the connection status to `connected`
4. Registers the messages webhook URL with Kapso for that phone number

### Messages Webhook

**Endpoint:** `POST /webhook/kapso/messages`

Receives inbound WhatsApp messages and message status updates.

**Authentication:** HMAC-SHA256 signature verification via the `X-Kapso-Signature` header.

**Event Types:**

| Event Type | Action |
|------------|--------|
| `whatsapp.message.received` | Processes and stores the inbound message, routes to assigned agent |
| `whatsapp.message.status_update` | Updates the delivery status of an outbound message |

#### Inbound Message Payload (V2)

```json
{
  "event": "whatsapp.message.received",
  "payload_version": "v2",
  "phone_number_id": "pn_abc123",
  "message": {
    "id": "wamid.HBgNNTUxMjM0NTY3ODkwFQIAERgSMDVBMkJFQkU2QUE0RTYxMjdBAA==",
    "timestamp": 1700000000,
    "type": "text",
    "text": "Hello, I need help with my booking",
    "kapso": {
      "content": "Hello, I need help with my booking",
      "transcript": null,
      "media_url": null
    }
  },
  "conversation": {
    "phone_number": "+15551234567",
    "kapso": {
      "contact_name": "Alice Smith"
    }
  }
}
```

#### Status Update Payload

```json
{
  "event": "whatsapp.message.status_update",
  "payload_version": "v2",
  "phone_number_id": "pn_abc123",
  "message": {
    "id": "wamid.HBgNNTUxMjM0NTY3ODkwFQIAERgSMDVBMkJFQkU2QUE0RTYxMjdBAA==",
    "status": "delivered",
    "timestamp": 1700000005
  }
}
```

#### Inbound Message Flow

When an inbound message arrives:

1. The phone number ID is used to look up the WhatsApp connection and determine the organization
2. The message is stored in the `whatsappMessages` table with deduplication by `messageId`
3. If the message is new and contains text, `scheduleAgentRouting` is called
4. The agent routing mutation finds the connected agent and schedules `routeInboundToAgent`
5. The routing action creates or reuses a thread with `externalId` set to `whatsapp:{phoneNumber}`
6. The agent processes the message via `chatAuthenticated` using a system actor context
7. The agent's response is sent back via the Kapso API

#### Status Updates

Status updates (`sent`, `delivered`, `read`, `failed`) are applied to the matching outbound message record.

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `KAPSO_WEBHOOK_SECRET` | Shared secret for HMAC signature verification |

## Flow Payment Webhook

**Endpoint:** `POST /webhook/flow`

Receives payment status updates from the Flow payment provider via form-encoded POST data.

### Request Format

The webhook receives a `token` parameter via `application/x-www-form-urlencoded` form data. This token is used to verify the payment status with the Flow API.

### Processing Flow

1. Extract the `token` from the form data
2. Query all active Flow integration configurations
3. For each configuration, call Flow's payment verification API with the token
4. Based on the returned status:

| Flow Status | Action |
|-------------|--------|
| `2` (Paid) | Mark the payment entity as paid with the current timestamp |
| `3` (Rejected) | Mark the payment entity as failed with the status message |
| `4` (Cancelled) | Mark the payment entity as failed with the status message |

### Response

Always returns `200 OK` to acknowledge receipt of the webhook.

## Polar Webhook

**Endpoint:** `POST /webhook/polar`

Receives payment events from the Polar billing platform.

**Authentication:** Standard Webhook Signature verification using `webhook-id`, `webhook-timestamp`, and `webhook-signature` headers. The signature is verified against the `POLAR_WEBHOOK_SECRET` environment variable. Timestamps older than 5 minutes are rejected.

**Event Types:**

| Event Type | Action |
|------------|--------|
| `order.paid` | Adds credits to the organization's account based on the order subtotal amount |

### Payload Example

```json
{
  "type": "order.paid",
  "data": {
    "id": "ord_abc123",
    "amount": 5000,
    "currency": "usd",
    "subtotal_amount": 5000,
    "customer": {
      "id": "cust_xyz789",
      "email": "admin@acme.com"
    },
    "product": {
      "id": "prod_def456",
      "name": "500 Credits"
    },
    "created_at": "2025-03-15T14:30:00Z"
  }
}
```

The `subtotal_amount` (in cents) determines how many credits are added to the organization's balance.

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `POLAR_WEBHOOK_SECRET` | Secret key for webhook signature verification |

## Webhook Security

All webhooks that handle sensitive operations use signature verification:

| Webhook | Verification Method |
|---------|-------------------|
| Clerk | Configured in Clerk Dashboard (Svix signatures) |
| Kapso (WhatsApp) | HMAC-SHA256 via `X-Kapso-Signature` header |
| Flow | Token-based verification via Flow API callback |
| Polar | Standard Webhook Signature (HMAC-SHA256 with base64) |
