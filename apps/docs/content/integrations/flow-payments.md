---
title: "Flow Payments"
description: "Payment processing with Flow integration"
section: "Integrations"
order: 2
---

# Flow Payments

Struere integrates with **Flow** (flow.cl) as a payment provider for processing payments within the platform. This integration supports payment link generation, HMAC-SHA256 request signing, webhook-based status updates, and reconciliation for missed webhooks.

## Configuration

Flow integration is configured per organization and environment through the `integrationConfigs` table with provider `"flow"`.

The configuration requires:

| Field | Type | Description |
|-------|------|-------------|
| `apiUrl` | `string` | Flow API base URL |
| `apiKey` | `string` | Your Flow API key |
| `secretKey` | `string` | Your Flow secret key for request signing |
| `webhookBaseUrl` | `string` | Base URL for webhook callbacks |

Configure the integration through the Struere dashboard at **Settings > Integrations > Flow**.

## Payment Link Generation

To create a payment link, the platform constructs a signed request to the Flow API:

```typescript
interface CreatePaymentLinkParams {
  organizationId: Id<"organizations">
  environment: "development" | "production"
  paymentId: Id<"entities">
  amount: number
  currency: string
  description: string
  customerEmail: string
  returnUrl: string
}
```

The payment creation flow:

1. Load the Flow configuration for the organization and environment
2. Build the order data with the API key, amount, currency, email, and callback URLs
3. Sign the request using HMAC-SHA256 with the secret key
4. POST to Flow's `/payment/create` endpoint
5. Store the returned payment link URL and Flow order ID on the payment entity
6. Return the payment link URL for the customer

### Request Signing

All requests to the Flow API are signed using HMAC-SHA256:

1. Sort the request parameters alphabetically by key
2. Concatenate them as `key1=value1&key2=value2&...`
3. Compute the HMAC-SHA256 digest using the secret key
4. Append the hex-encoded signature as the `s` parameter

## Payment Status Webhook

**Endpoint:** `POST /webhook/flow`

Flow sends payment status updates as form-encoded POST data with a `token` parameter.

### Processing Flow

```
Flow sends POST /webhook/flow with token
    |
    v
Extract token from form data
    |
    v
Query all active Flow configurations
    |
    v
For each config, verify payment status via Flow API
    |
    v
Map status code to action:
  Status 2 (Paid)      -> markAsPaid
  Status 3 (Rejected)  -> markAsFailed
  Status 4 (Cancelled) -> markAsFailed
```

### Status Codes

| Flow Status | Meaning | Struere Action |
|-------------|---------|----------------|
| `1` | Pending | No action (payment still in progress) |
| `2` | Paid | Mark payment as paid with timestamp |
| `3` | Rejected | Mark payment as failed with reason |
| `4` | Cancelled | Mark payment as failed with reason |

### Verification

The token received in the webhook is verified against the Flow API by calling the `payment/getStatus` endpoint with a signed request. This confirms the payment status directly with Flow rather than trusting the webhook payload alone.

## Session Lifecycle Integration

Payments are tied to the session lifecycle in the tutoring domain:

```
pending_payment ──[payment.success]──> scheduled
                                          |
                    ┌─────────────────────┼─────────────────────┐
                    |                     |                     |
                    v                     v                     v
               cancelled            in_progress              no_show
                                          |
                                          v
                                      completed
```

### Status Transitions

1. **Session created** — Status is `pending_payment`. A payment link is generated and sent to the guardian.
2. **Payment completed** — The webhook fires, the payment entity is marked as paid, and the session transitions to `scheduled`.
3. **Session occurs** — Status moves to `in_progress` when the session starts.
4. **Session ends** — Status moves to `completed`. Credits are consumed from the guardian's entitlement.

### Credit Consumption

When a session completes:
1. The system looks up the guardian's active entitlement for the student
2. The remaining credits are decremented
3. An event is emitted recording the credit consumption

## Reconciliation

For missed webhooks or uncertain payment states, the platform supports manual reconciliation by checking payment status directly with the Flow API:

```typescript
interface FlowPaymentStatus {
  flowOrder: number
  status: string
  statusMessage: string
  amount: number
  currency: string
  payer: string
}
```

The `checkFlowOrderStatus` function queries Flow's `/payment/getStatusByFlowOrder` endpoint using the Flow order ID, allowing the system to verify and update payment status independently of webhooks.

## Payment Entity Schema

Payments are stored as entities of type `payment` with the following data fields:

| Field | Type | Description |
|-------|------|-------------|
| `guardianId` | `string` | The guardian entity ID responsible for payment |
| `amount` | `number` | Payment amount |
| `currency` | `string` | Currency code (e.g., `"CLP"`) |
| `status` | `string` | Payment status (`"pending"`, `"paid"`, `"failed"`) |
| `providerReference` | `string` | The Flow order ID |
| `paymentLinkUrl` | `string` | The generated payment link URL |
| `sessionId` | `string` | The associated session entity ID |
| `paidAt` | `number?` | Timestamp when payment was confirmed |
| `failedReason` | `string?` | Reason for payment failure |

## Required Environment Variables

Flow credentials are stored in the `integrationConfigs` table rather than as environment variables. The configuration is loaded at runtime from the database for each organization and environment.

No Convex environment variables are required specifically for Flow. All credentials are managed through the integration configuration in the dashboard.
