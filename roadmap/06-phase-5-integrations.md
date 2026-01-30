# Phase 5: Integration Layer

## Document Purpose

This document details the implementation of external integrations—WhatsApp messaging, payment processing, and calendar/meeting links. These integrations connect the tutoring domain to real-world communication and payment channels.

**Status**: 📋 Planned

**Dependencies**: Phase 4 (Tutoring Domain Implementation)

**Estimated Scope**: WhatsApp (~400 lines), Payments (~300 lines), Calendar (~150 lines)

---

## Context: Why Integrations Are Essential

### The Gap Between Software and Operations

Phase 4 built the tutoring domain with entities, permissions, and workflows. But:
- Sessions exist in the database, not on real calendars
- Reminders are jobs, not actual messages
- Payments are records, not real money

Without integrations, the platform is a sophisticated data management system. With integrations, it becomes an operational system.

### The Tutoring Customer's Channels

From the case study:
- **WhatsApp** is the primary communication channel
- **Flow** is their payment provider (Chile-based)
- **Google Meet/Zoom** for video sessions

These are non-negotiable for the customer.

### The Staged Approach

We're implementing integrations in stages to manage complexity:

| Stage | WhatsApp | Payments | Calendar |
|-------|----------|----------|----------|
| 1 | Templates only | Payment links | Static links |
| 2 | Freeform in window | Webhooks | Auto-generation |
| 3 | Media, reactions | Refunds, disputes | Calendar sync |

Phase 5 implements Stage 1 + partial Stage 2.

---

## Goals

By the end of Phase 5:

1. **WhatsApp template messages work** - Reminders, confirmations, updates
2. **24-hour window tracking exists** - Know when freeform is allowed
3. **Payment links are generated** - Flow integration for pay-by-link
4. **Payment webhooks are processed** - Automatic status updates
5. **Meeting links are attached to sessions** - Basic link storage

---

## Non-Goals for This Phase

1. **Rich media WhatsApp** - Images, documents, etc. (Stage 3)
2. **Refunds and disputes** - Complex payment flows (Stage 3)
3. **Calendar sync** - Google Calendar integration (Stage 3)
4. **Multiple payment providers** - Only Flow for now

---

## WhatsApp Integration

### Overview

WhatsApp Business API requires:
1. **Approved templates** for outbound messages
2. **24-hour window** for freeform messages (after user replies)
3. **Webhook handling** for inbound messages

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Struere       │────▶│  WhatsApp API   │────▶│   User Phone    │
│   (Convex)      │     │  (Meta)         │     │                 │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     │                        │
     │ Send template          │ Webhook
     │ Check window           │ (inbound message)
     ▼                        ▼
┌─────────────────┐     ┌─────────────────┐
│ whatsappMessages│     │ Update window   │
│ (audit log)     │     │ timestamp       │
└─────────────────┘     └─────────────────┘
```

### Data Model: WhatsApp Conversation State

**New table**: `whatsappConversations`

```typescript
{
  organizationId: Id<"organizations">,
  phoneNumber: string,
  whatsappId: string,
  entityType: "guardian" | "teacher",
  entityId: Id<"entities">,
  lastInboundAt: number | null,
  lastOutboundAt: number | null,
  windowExpiresAt: number | null,
  createdAt: number,
  updatedAt: number,
}
```

**Why this structure?**

- `phoneNumber`: The actual phone number (for sending)
- `whatsappId`: WhatsApp's internal ID (from webhooks)
- `entityType`/`entityId`: Links to guardian or teacher
- `lastInboundAt`: When user last messaged us
- `windowExpiresAt`: When 24h window closes (computed: lastInboundAt + 24h)

### Data Model: WhatsApp Templates

**New table**: `whatsappTemplates`

```typescript
{
  organizationId: Id<"organizations">,
  name: string,
  language: string,
  status: "pending" | "approved" | "rejected",
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION",
  components: {
    header?: { type: "text" | "image" | "document", text?: string },
    body: { text: string, variables: string[] },
    footer?: { text: string },
    buttons?: { type: "url" | "quick_reply", text: string, url?: string }[],
  },
  metaTemplateId: string | null,
  approvedAt: number | null,
  rejectedReason: string | null,
  createdAt: number,
  updatedAt: number,
}
```

**Example templates**:

```typescript
// Session reminder
{
  name: "session_reminder",
  language: "es",
  category: "UTILITY",
  components: {
    body: {
      text: "Hola {{1}}, te recordamos que tienes una clase de {{2}} mañana a las {{3}}. Tu profesor será {{4}}. Link: {{5}}",
      variables: ["guardianName", "subject", "time", "teacherName", "meetingLink"],
    },
  },
}

// Payment confirmation
{
  name: "payment_confirmed",
  language: "es",
  category: "UTILITY",
  components: {
    body: {
      text: "Hola {{1}}, hemos recibido tu pago de ${{2}}. Tu clase está confirmada para {{3}}.",
      variables: ["guardianName", "amount", "sessionTime"],
    },
  },
}
```

### Implementation: Send Template Message

**File**: `platform/convex/lib/integrations/whatsapp.ts`

```typescript
interface SendTemplateParams {
  organizationId: Id<"organizations">
  toPhoneNumber: string
  templateName: string
  languageCode: string
  variables: Record<string, string>
}

export async function sendTemplateMessage(
  ctx: MutationCtx,
  params: SendTemplateParams
): Promise<{ messageId: string }> {
  const { organizationId, toPhoneNumber, templateName, languageCode, variables } = params

  const template = await ctx.db
    .query("whatsappTemplates")
    .withIndex("by_org_name", (q) =>
      q.eq("organizationId", organizationId).eq("name", templateName)
    )
    .first()

  if (!template || template.status !== "approved") {
    throw new Error(`Template ${templateName} is not approved`)
  }

  const config = await getWhatsAppConfig(ctx, organizationId)

  const variableValues = template.components.body.variables.map(
    (varName) => variables[varName] || ""
  )

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhoneNumber,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: variableValues.map((v) => ({ type: "text", text: v })),
            },
          ],
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`WhatsApp API error: ${error}`)
  }

  const result = await response.json()

  await ctx.db.insert("whatsappMessages", {
    organizationId,
    direction: "outbound",
    phoneNumber: toPhoneNumber,
    templateName,
    messageId: result.messages[0].id,
    status: "sent",
    createdAt: Date.now(),
  })

  await updateConversationOutbound(ctx, organizationId, toPhoneNumber)

  return { messageId: result.messages[0].id }
}
```

### Implementation: Process Inbound Webhook

**File**: `platform/convex/http.ts`

```typescript
http.route({
  path: "/webhook/whatsapp",
  method: "POST",
  handler: async (ctx, request) => {
    const body = await request.json()

    if (body.object !== "whatsapp_business_account") {
      return new Response("OK", { status: 200 })
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === "messages") {
          await processWhatsAppMessages(ctx, change.value)
        }
      }
    }

    return new Response("OK", { status: 200 })
  },
})

async function processWhatsAppMessages(
  ctx: ActionCtx,
  value: WhatsAppWebhookValue
): Promise<void> {
  const phoneNumberId = value.metadata.phone_number_id

  const org = await ctx.runQuery(internal.organizations.getByWhatsAppPhone, {
    phoneNumberId,
  })

  if (!org) {
    console.warn("Unknown WhatsApp phone number:", phoneNumberId)
    return
  }

  for (const message of value.messages || []) {
    await ctx.runMutation(internal.whatsapp.processInboundMessage, {
      organizationId: org._id,
      from: message.from,
      messageId: message.id,
      timestamp: parseInt(message.timestamp) * 1000,
      type: message.type,
      text: message.text?.body,
    })
  }
}
```

### Implementation: Update 24-Hour Window

**File**: `platform/convex/whatsapp.ts`

```typescript
export const processInboundMessage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    from: v.string(),
    messageId: v.string(),
    timestamp: v.number(),
    type: v.string(),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("whatsappConversations")
      .withIndex("by_org_phone", (q) =>
        q.eq("organizationId", args.organizationId).eq("phoneNumber", args.from)
      )
      .first()

    const now = args.timestamp
    const windowExpiry = now + 24 * 60 * 60 * 1000

    if (conversation) {
      await ctx.db.patch(conversation._id, {
        lastInboundAt: now,
        windowExpiresAt: windowExpiry,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert("whatsappConversations", {
        organizationId: args.organizationId,
        phoneNumber: args.from,
        whatsappId: args.from,
        entityType: null,
        entityId: null,
        lastInboundAt: now,
        lastOutboundAt: null,
        windowExpiresAt: windowExpiry,
        createdAt: now,
        updatedAt: now,
      })
    }

    await ctx.db.insert("whatsappMessages", {
      organizationId: args.organizationId,
      direction: "inbound",
      phoneNumber: args.from,
      messageId: args.messageId,
      type: args.type,
      text: args.text,
      status: "received",
      createdAt: now,
    })
  },
})
```

### Implementation: Check Window for Freeform

```typescript
export async function canSendFreeform(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  phoneNumber: string
): Promise<boolean> {
  const conversation = await ctx.db
    .query("whatsappConversations")
    .withIndex("by_org_phone", (q) =>
      q.eq("organizationId", organizationId).eq("phoneNumber", phoneNumber)
    )
    .first()

  if (!conversation || !conversation.windowExpiresAt) {
    return false
  }

  return conversation.windowExpiresAt > Date.now()
}
```

---

## Payment Integration (Flow)

### Overview

Flow is a Chilean payment provider. The integration supports:
1. **Payment link generation** - Create a link, user pays
2. **Webhook notifications** - Flow notifies us of payment status

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Struere       │────▶│   Flow API      │────▶│   User Browser  │
│   (Convex)      │     │                 │     │   (Payment)     │
│                 │◀────│                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     │                        │
     │ Create link            │ Webhook
     │ Verify status          │ (payment.success)
     ▼                        ▼
┌─────────────────┐     ┌─────────────────┐
│ Update payment  │     │ Update session  │
│ record          │     │ to scheduled    │
└─────────────────┘     └─────────────────┘
```

### Implementation: Create Payment Link

**File**: `platform/convex/lib/integrations/flow.ts`

```typescript
interface CreatePaymentLinkParams {
  organizationId: Id<"organizations">
  paymentId: Id<"entities">
  amount: number
  currency: string
  description: string
  customerEmail: string
  returnUrl: string
}

export async function createPaymentLink(
  ctx: MutationCtx,
  params: CreatePaymentLinkParams
): Promise<{ paymentLinkUrl: string; flowOrderId: string }> {
  const config = await getFlowConfig(ctx, params.organizationId)

  const orderData = {
    commerceOrder: params.paymentId,
    subject: params.description,
    currency: params.currency,
    amount: params.amount,
    email: params.customerEmail,
    urlConfirmation: `${config.webhookBaseUrl}/webhook/flow`,
    urlReturn: params.returnUrl,
  }

  const signature = signFlowRequest(orderData, config.secretKey)

  const response = await fetch(`${config.apiUrl}/payment/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      ...orderData,
      s: signature,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Flow API error: ${error}`)
  }

  const result = await response.json()

  await ctx.db.patch(params.paymentId, {
    data: {
      ...(await ctx.db.get(params.paymentId))?.data,
      paymentLinkUrl: result.url + "?token=" + result.token,
      providerReference: result.flowOrder.toString(),
      status: "pending",
    },
    updatedAt: Date.now(),
  })

  return {
    paymentLinkUrl: result.url + "?token=" + result.token,
    flowOrderId: result.flowOrder.toString(),
  }
}

function signFlowRequest(
  data: Record<string, unknown>,
  secretKey: string
): string {
  const sortedKeys = Object.keys(data).sort()
  const signString = sortedKeys.map((k) => `${k}=${data[k]}`).join("&")
  return crypto.createHmac("sha256", secretKey).update(signString).digest("hex")
}
```

### Implementation: Process Payment Webhook

**File**: `platform/convex/http.ts`

```typescript
http.route({
  path: "/webhook/flow",
  method: "POST",
  handler: async (ctx, request) => {
    const body = await request.formData()
    const token = body.get("token") as string

    const result = await ctx.runAction(internal.flow.verifyPayment, { token })

    if (result.status === "2") {
      await ctx.runMutation(internal.payments.markAsPaid, {
        providerReference: result.flowOrder.toString(),
        paidAt: Date.now(),
      })
    } else if (result.status === "3" || result.status === "4") {
      await ctx.runMutation(internal.payments.markAsFailed, {
        providerReference: result.flowOrder.toString(),
        reason: result.statusMessage,
      })
    }

    return new Response("OK", { status: 200 })
  },
})
```

### Implementation: Mark Payment as Paid

**File**: `platform/convex/payments.ts`

```typescript
export const markAsPaid = internalMutation({
  args: {
    providerReference: v.string(),
    paidAt: v.number(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("entities")
      .filter((q) =>
        q.eq(q.field("data.providerReference"), args.providerReference)
      )
      .first()

    if (!payment) {
      console.warn("Payment not found:", args.providerReference)
      return
    }

    if (payment.data.status === "paid") {
      return
    }

    await ctx.db.patch(payment._id, {
      data: {
        ...payment.data,
        status: "paid",
        paidAt: args.paidAt,
      },
      updatedAt: Date.now(),
    })

    if (payment.data.sessionId) {
      await ctx.db.patch(payment.data.sessionId, {
        data: {
          ...(await ctx.db.get(payment.data.sessionId))?.data,
          status: "scheduled",
        },
        updatedAt: Date.now(),
      })

      await ctx.db.insert("events", {
        organizationId: payment.organizationId,
        entityId: payment.data.sessionId,
        eventType: "session.confirmed",
        payload: { paymentId: payment._id },
        actorId: "system",
        actorType: "webhook",
        timestamp: Date.now(),
      })
    }
  },
})
```

### Reconciliation Job

Webhooks can fail. We need a reconciliation job:

```typescript
export const reconcilePayments = internalMutation({
  handler: async (ctx) => {
    const pendingPayments = await ctx.db
      .query("entities")
      .filter((q) =>
        q.and(
          q.eq(q.field("data.status"), "pending"),
          q.lt(q.field("createdAt"), Date.now() - 60 * 60 * 1000)
        )
      )
      .collect()

    for (const payment of pendingPayments) {
      if (!payment.data.providerReference) continue

      const flowStatus = await checkFlowStatus(ctx, payment.data.providerReference)

      if (flowStatus.status === "2") {
        await markAsPaid(ctx, {
          providerReference: payment.data.providerReference,
          paidAt: Date.now(),
        })
      }
    }
  },
})
```

**Schedule**: Run every 15 minutes via Convex cron.

---

## Calendar/Meeting Links

### Stage 1: Static Links

For Stage 1, meeting links are manually configured per teacher or generated per session.

**Simple approach**:
```typescript
async function generateMeetingLink(
  ctx: MutationCtx,
  sessionId: Id<"entities">
): Promise<string> {
  const session = await ctx.db.get(sessionId)
  const teacher = await ctx.db.get(session.data.teacherId)

  if (teacher?.data.defaultMeetingLink) {
    return teacher.data.defaultMeetingLink
  }

  return `https://meet.struere.dev/${sessionId}`
}
```

### Stage 2: Auto-Generation (Future)

Google Calendar API or Zoom API integration to create meetings automatically.

```typescript
interface CreateMeetingParams {
  title: string
  startTime: number
  duration: number
  attendees: string[]
}

async function createGoogleMeet(params: CreateMeetingParams): Promise<string> {
  // Google Calendar API call
  // Returns meeting link
}
```

This is out of scope for Phase 5 but noted for future phases.

---

## Integration Configuration

### Data Model: Integration Configs

**New table**: `integrationConfigs`

```typescript
{
  organizationId: Id<"organizations">,
  provider: "whatsapp" | "flow" | "google" | "zoom",
  config: {
    // WhatsApp
    phoneNumberId?: string,
    accessToken?: string,  // Encrypted
    businessAccountId?: string,

    // Flow
    apiUrl?: string,
    apiKey?: string,  // Encrypted
    secretKey?: string,  // Encrypted
    webhookBaseUrl?: string,

    // Google
    clientId?: string,
    clientSecret?: string,  // Encrypted
    refreshToken?: string,  // Encrypted
  },
  status: "active" | "inactive" | "error",
  lastVerifiedAt: number | null,
  createdAt: number,
  updatedAt: number,
}
```

**Why encrypt secrets?**

API keys and tokens must be encrypted at rest. Use Convex's environment variables for encryption keys.

### Configuration UI (Phase 6 Scope)

The dashboard will have an integrations settings page where admins can:
- Enter API credentials
- Test connections
- View integration status

---

## Error Handling Strategy

### WhatsApp Errors

| Error | Handling |
|-------|----------|
| Template not approved | Throw, log, alert admin |
| Rate limited | Retry with exponential backoff |
| Invalid phone number | Mark conversation as invalid |
| API timeout | Retry 3 times, then fail |

### Payment Errors

| Error | Handling |
|-------|----------|
| Link creation failed | Throw, user sees error |
| Webhook verification failed | Log, don't update payment |
| Payment declined | Update payment status, notify user |
| Duplicate webhook | Idempotent handling (no-op) |

### Retry Strategy

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
```

---

## Testing Strategy

### WhatsApp Tests

1. **Template message sends**
   - Mock WhatsApp API
   - Call sendTemplateMessage
   - Assert correct API payload

2. **Window tracking updates**
   - Process inbound webhook
   - Assert windowExpiresAt = timestamp + 24h

3. **Freeform check works**
   - Set windowExpiresAt in future
   - Assert canSendFreeform = true
   - Set windowExpiresAt in past
   - Assert canSendFreeform = false

### Payment Tests

1. **Payment link creation**
   - Mock Flow API
   - Call createPaymentLink
   - Assert correct API call and DB update

2. **Webhook processing**
   - Simulate webhook with success status
   - Assert payment marked as paid
   - Assert session status changed to scheduled

3. **Idempotent webhook handling**
   - Process same webhook twice
   - Assert payment only updated once

4. **Reconciliation catches missed webhooks**
   - Create pending payment
   - Mock Flow API to return paid
   - Run reconciliation
   - Assert payment marked as paid

---

## Success Criteria

Phase 5 is complete when:

1. ✅ WhatsApp templates can be sent
2. ✅ Inbound WhatsApp messages update window state
3. ✅ canSendFreeform correctly reflects window status
4. ✅ Payment links are created via Flow
5. ✅ Payment webhooks update payment and session status
6. ✅ Reconciliation job catches missed webhooks
7. ✅ Meeting links are attached to sessions
8. ✅ Integration configs are stored securely
9. ✅ All tests pass

---

## Files Created/Modified

| Path | Changes |
|------|---------|
| `platform/convex/schema.ts` | Add whatsappConversations, whatsappTemplates, whatsappMessages, integrationConfigs |
| `platform/convex/lib/integrations/whatsapp.ts` | NEW: WhatsApp API client |
| `platform/convex/lib/integrations/flow.ts` | NEW: Flow API client |
| `platform/convex/whatsapp.ts` | NEW: WhatsApp mutations |
| `platform/convex/payments.ts` | Add markAsPaid, reconciliation |
| `platform/convex/http.ts` | Add webhook routes |

---

## Security Considerations

1. **Webhook verification**: Always verify webhook signatures
2. **Token encryption**: Store API tokens encrypted
3. **Rate limiting**: Respect API rate limits
4. **Audit logging**: Log all external API calls
5. **Secret rotation**: Support credential rotation without downtime

---

## What's Next: Phase 6

Phase 6 builds dashboard role modules:

- Teacher dashboard view
- Admin dashboard view
- Guardian self-service portal (if needed)
- Integration configuration UI

See [07-phase-6-dashboard-roles.md](./07-phase-6-dashboard-roles.md) for details.
