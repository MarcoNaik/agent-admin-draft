---
title: "Flow Payments"
description: "Payment processing with Flow.cl integration"
section: "Integrations"
order: 2
---

# Flow Payments

Struere integrates with **Flow** (flow.cl) as a payment provider. AI agents can create payment links during conversations and return URLs to users. The integration supports payment link generation, HMAC-SHA256 request signing, webhook-based status updates, automatic reconciliation, and agent tools.

## Setup

### 1. Configure via Dashboard

Navigate to **Settings > Integrations > Flow.cl** and provide:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiUrl` | `string` | Yes | Flow API base URL (`https://www.flow.cl/api` or `https://sandbox.flow.cl/api` for testing) |
| `apiKey` | `string` | Yes | Your Flow API key |
| `secretKey` | `string` | Yes | Your Flow secret key for request signing |
| `returnUrl` | `string` | No | URL to redirect users after payment completion |
| `defaultCurrency` | `string` | No | Default currency code (defaults to `"CLP"`) |

The webhook URL is displayed on the settings page — set this as your confirmation URL in Flow.cl.

### 2. Configure via CLI

```bash
npx struere integration flow \
  --api-url https://www.flow.cl/api \
  --api-key YOUR_API_KEY \
  --secret-key YOUR_SECRET_KEY \
  --return-url https://yoursite.com/payment/complete \
  --test
```

### 3. Add Tools to Your Agent

```typescript
export default defineAgent({
  name: "Billing Agent",
  slug: "billing",
  version: "0.1.0",
  systemPrompt: "You help users make payments.",
  tools: ["payment.create", "payment.getStatus"],
})
```

## Agent Tools

### `payment.create`

Creates a payment entity, calls the Flow API to generate a payment link, and returns the link URL.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | `number` | Yes | Payment amount |
| `description` | `string` | Yes | Description of the payment |
| `currency` | `string` | No | Currency code (defaults to config default or `"CLP"`) |
| `customerEmail` | `string` | Yes | Customer email address (required by Flow's API) |
| `entityId` | `string` | No | Optional entity ID to link the payment to via a `payment_for` relation |

**Returns:**

```json
{
  "paymentId": "ent_abc123",
  "paymentLinkUrl": "https://www.flow.cl/app/web/pay.php?token=xyz",
  "flowOrderId": "12345"
}
```

### `payment.getStatus`

Checks the current status of a payment. Queries the Flow API for live status if a provider reference exists.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entityId` | `string` | Yes | Payment entity ID to check |

**Returns:**

```json
{
  "entityId": "ent_abc123",
  "status": "pending",
  "flowStatus": 1,
  "flowStatusMessage": "Pending payment",
  "paymentLinkUrl": "https://www.flow.cl/app/web/pay.php?token=xyz",
  "amount": 5000,
  "currency": "CLP"
}
```

## Request Signing

All requests to the Flow API are signed using HMAC-SHA256 via the Web Crypto API (`crypto.subtle`):

1. Sort the request parameters alphabetically by key
2. Concatenate them as `key1value1key2value2` (key-value pairs with no separators)
3. Compute the HMAC-SHA256 digest using `crypto.subtle.sign()` with the secret key
4. Append the hex-encoded signature as the `s` parameter

### Flow API HTTP Methods

| Endpoint | Method | Signature Delivery |
|----------|--------|--------------------|
| `payment/create` | POST | Form-encoded body |
| `payment/getStatus` | GET | Query string |
| `payment/getStatusByFlowOrder` | GET | Query string |

## Payment Status Webhook

**Endpoint:** `POST /webhook/flow`

Flow sends payment status updates as form-encoded POST data with a `token` parameter. The webhook uses a fast-path lookup by `flowToken` stored on the payment entity for direct org/environment resolution, falling back to iterating all Flow configs for legacy payments.

### Processing Flow

```
Flow sends POST /webhook/flow with token
    |
    v
Extract token from form data
    |
    v
Fast-path: look up payment entity by flowToken
  Found? -> resolve org/environment directly -> verify via Flow API
    |
    v (not found)
Fallback: query all active Flow configurations
    |
    v
For each config, try both environments:
  Verify payment status via Flow API
    |
    v
Map status code to action:
  Status 2 (Paid)      -> markAsPaid
  Status 3 (Rejected)  -> markAsFailed
  Status 4 (Cancelled) -> markAsFailed
```

### Status Codes

| Flow Status | Meaning | Action |
|-------------|---------|--------|
| `1` | Pending | No action |
| `2` | Paid | Mark payment as paid |
| `3` | Rejected | Mark payment as failed |
| `4` | Cancelled | Mark payment as failed |

## Reconciliation

A cron job runs every 5 minutes to reconcile pending payments older than 1 hour. For each pending payment with a Flow provider reference, it queries the Flow API directly to check the current status and updates the payment entity accordingly.

## Payment Entity Schema

Payments are stored as entities of type `payment`:

| Field | Type | Description |
|-------|------|-------------|
| `amount` | `number` | Payment amount |
| `currency` | `string` | Currency code (e.g., `"CLP"`) |
| `description` | `string` | Payment description |
| `status` | `string` | Payment status (`"draft"`, `"pending"`, `"paid"`, `"failed"`) |
| `providerReference` | `string` | The Flow order ID |
| `paymentLinkUrl` | `string` | The generated payment link URL |
| `flowToken` | `string` | Flow token for direct webhook lookup |
| `customerEmail` | `string` | Customer email address |
| `paidAt` | `number?` | Timestamp when payment was confirmed |
| `failureReason` | `string?` | Reason for payment failure |

## Configuration Storage

Flow credentials are stored in the `integrationConfigs` table rather than as environment variables. The configuration is loaded at runtime from the database for each organization and environment. No Convex environment variables are required specifically for Flow.
