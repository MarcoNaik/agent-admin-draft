---
title: "Resend"
description: "Send transactional emails from your agents via Resend"
section: "Integrations"
order: 6
---

# Resend

Struere integrates with [Resend](https://resend.com) to give agents the ability to send transactional emails. The integration is **platform-managed** — Struere holds the Resend API key, so organizations only need to optionally configure sender identity (from address, name, reply-to). Delivery status is tracked automatically via webhooks.

## Architecture

```
Agent calls email.send tool
    |
    v
Struere Backend (resolve org from-config, call Resend API)
    |
    v
Resend API (sends email, returns resendId)
    |
    v
emailMessages record created (status: "sent", credits deducted)
    |
    v
Resend Webhook (/webhook/resend)
    |
    v
Status updated: sent → delivered / bounced / complained
```

## Setup

### 1. Configure sender identity (optional)

You can configure sender identity from the **CLI** or the **dashboard**.

**CLI:**

```bash
npx struere integration resend \
  --from-email noreply@yourapp.com \
  --from-name "Your App" \
  --reply-to support@yourapp.com \
  --test
```

**Dashboard:** Navigate to **Settings > Integrations > Resend**.

Both methods configure the same three optional fields:

| Field | Default | CLI Flag | Description |
|-------|---------|----------|-------------|
| From Email | `noreply@mail.struere.dev` | `--from-email` | The sender email address |
| From Name | None | `--from-name` | Display name shown to recipients |
| Reply-To | None | `--reply-to` | Where replies are directed |

If you skip this step, emails are sent from `noreply@mail.struere.dev` with no reply-to.

See [`struere integration`](/cli/integration) for all CLI options.

### 2. Add the email tool to your agent

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Notifications Agent",
  slug: "notifications",
  tools: [
    "email.send",
  ],
  systemPrompt: `You send email notifications for {{organizationName}}.

When asked to notify someone, compose a clear email and send it using the email.send tool.
Always confirm the recipient and subject before sending.`,
  model: { provider: "xai", name: "grok-4-1-fast" },
})
```

## Available Tools

### email.send

Sends a transactional email via Resend.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | `string` | Yes | Recipient email address |
| `subject` | `string` | Yes | Email subject line |
| `html` | `string` | No | HTML body content |
| `text` | `string` | No | Plain text body content |
| `replyTo` | `string` | No | Override the reply-to address for this email |

At least one of `html` or `text` must be provided. If both are provided, Resend sends a multipart email.

**Returns:**

```typescript
{
  resendId: string
  to: string
  subject: string
  status: "sent"
}
```

**Example call:**

```json
{
  "to": "parent@example.com",
  "subject": "Session Reminder",
  "html": "<p>Your child's session is tomorrow at 3pm.</p>",
  "replyTo": "support@school.com"
}
```

## Delivery Tracking

Every outbound email is stored in the `emailMessages` table with full lifecycle tracking:

| Field | Description |
|-------|-------------|
| `organizationId` | Owning organization |
| `environment` | `development` or `production` |
| `to` | Recipient address |
| `from` | Sender address (resolved from org config or default) |
| `subject` | Email subject |
| `resendId` | Resend's unique email ID |
| `status` | Current delivery status |
| `creditsConsumed` | Cost in microdollars |

### Status Flow

```
sent → delivered
sent → bounced
sent → complained
```

Status updates arrive via Resend's webhook system. The `/webhook/resend` endpoint verifies Svix signatures and updates the `emailMessages` record automatically.

## Pricing

Email sends are charged at a flat rate per email:

| Metric | Value |
|--------|-------|
| Base cost | $0.90 per 1,000 emails ($0.0009 per email) |
| Platform markup | 1.1x |
| Effective cost | **990 microdollars per email** (~$0.00099) |

Credits are deducted immediately when the email is sent. The `creditsConsumed` field on the `emailMessages` record tracks the exact amount charged.

## Common Patterns

### Sending notifications from triggers

Combine with triggers to send emails when entities change:

```typescript
import { defineTrigger } from 'struere'

export default defineTrigger({
  name: "New Order Email",
  slug: "new-order-email",
  on: {
    entityType: "order",
    action: "created",
  },
  actions: [
    {
      tool: "email.send",
      args: {
        to: "{{entity.data.customerEmail}}",
        subject: "Order Confirmed: #{{entity.data.orderNumber}}",
        html: "<p>Your order has been confirmed. We'll notify you when it ships.</p>",
      },
    },
  ],
})
```

### HTML emails with dynamic content

Agents can compose HTML emails dynamically based on conversation context:

```
User: "Send Alice a summary of today's sessions"

Agent flow:
1. entity.query — get today's session entities
2. Compose HTML table with session details
3. email.send — send formatted email to Alice
```

### Plain text fallback

For simple notifications, use `text` instead of `html`:

```json
{
  "to": "team@example.com",
  "subject": "Daily Report Ready",
  "text": "The daily report for 2025-01-15 has been generated. Log in to view it."
}
```

## Environment Scoping

The Resend integration configuration is environment-scoped. You can configure different sender identities for development and production. In development, you might use a test from-address to avoid accidentally emailing real users.

## Webhook Configuration

To enable delivery tracking, configure a webhook in your [Resend dashboard](https://resend.com/webhooks):

| Setting | Value |
|---------|-------|
| Endpoint URL | `https://<your-convex-url>/webhook/resend` |
| Events | `email.sent`, `email.delivered`, `email.bounced`, `email.complained` |

The webhook uses Svix signature verification. Set the `RESEND_WEBHOOK_SECRET` environment variable in your Convex dashboard to the signing secret from Resend (format: `whsec_...`).
