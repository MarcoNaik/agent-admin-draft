---
title: "Billing and Credits"
description: "How credit-based billing works, pricing, and managing costs"
section: "Platform Concepts"
order: 10
---

# Billing and Credits

Struere uses a credit-based billing system. Credits are consumed when no direct provider key or OpenRouter key is configured — the platform routes LLM calls through its own OpenRouter key and meters usage per-token at provider rates with a 10% markup. Organizations that bring their own API keys (direct provider keys or an OpenRouter key) bypass platform billing entirely.

## Credit System

Credits are stored as **microdollars** (1 USD = 1,000,000 microdollars). This integer-based representation avoids floating-point precision issues across all balance calculations and transaction records.

Each organization has a single `creditBalances` record tracking the current balance, plus a `creditTransactions` ledger that records every credit movement:

| Transaction Type | Description |
|------------------|-------------|
| `purchase` | Credits added via Polar checkout |
| `addition` | Manual credit addition by an org admin |
| `deduction` | Automated deduction after an LLM call or billable action |
| `adjustment` | Manual balance correction by an org admin |

## Purchasing Credits

Credits are purchased through Polar checkout. The minimum purchase is **$1.00**.

1. Navigate to **Settings > Billing** in the dashboard
2. Enter the amount and click **Add Credits**
3. Complete checkout on Polar
4. Credits are added to your organization balance automatically via webhook

Polar sends an `order.updated` webhook when a payment completes. The platform converts the Polar amount (cents) to microdollars and creates a `purchase` transaction. Duplicate orders are detected by `polarOrderId` to prevent double-crediting.

## Pricing

All prices reflect provider base rates with a **10% platform markup**. Prices are per 1 million tokens.

### Anthropic

| Model | Input / 1M tokens | Output / 1M tokens |
|-------|--------------------|---------------------|
| `claude-haiku-4-5` | $1.10 | $5.50 |
| `claude-sonnet-4` | $3.30 | $16.50 |
| `claude-sonnet-4-5` | $3.30 | $16.50 |
| `claude-sonnet-4-6` | $3.30 | $16.50 |
| `claude-opus-4` | $16.50 | $82.50 |
| `claude-opus-4-5` | $5.50 | $27.50 |
| `claude-opus-4-6` | $5.50 | $27.50 |

### OpenAI

| Model | Input / 1M tokens | Output / 1M tokens |
|-------|--------------------|---------------------|
| `gpt-4o-mini` | $0.165 | $0.66 |
| `gpt-4o` | $2.75 | $11.00 |
| `gpt-4.1-nano` | $0.11 | $0.44 |
| `gpt-4.1-mini` | $0.44 | $1.76 |
| `gpt-4.1` | $2.20 | $8.80 |
| `gpt-5-nano` | $0.055 | $0.44 |
| `gpt-5-mini` | $0.275 | $2.20 |
| `gpt-5` | $1.375 | $11.00 |
| `gpt-5.1` | $1.375 | $11.00 |
| `gpt-5.2` | $1.925 | $15.40 |
| `o1` | $16.50 | $66.00 |
| `o1-mini` | $1.21 | $4.84 |
| `o1-pro` | $165.00 | $660.00 |
| `o3` | $2.20 | $8.80 |
| `o3-mini` | $1.21 | $4.84 |
| `o3-pro` | $22.00 | $88.00 |
| `o4-mini` | $1.21 | $4.84 |

### Google

| Model | Input / 1M tokens | Output / 1M tokens |
|-------|--------------------|---------------------|
| `gemini-2.0-flash` | $0.11 | $0.44 |
| `gemini-2.5-flash` | $0.33 | $2.75 |
| `gemini-2.5-pro` | $1.375 | $11.00 |

### xAI

| Model | Input / 1M tokens | Output / 1M tokens |
|-------|--------------------|---------------------|
| `grok-3` | $3.30 | $16.50 |
| `grok-3-mini` | $0.33 | $0.55 |
| `grok-4-0709` | $3.30 | $16.50 |
| `grok-4-1-fast` | $0.22 | $0.55 |
| `grok-4-1-fast-reasoning` | $0.22 | $0.55 |
| `grok-4-1-fast-non-reasoning` | $0.22 | $0.55 |
| `grok-4-fast-reasoning` | $0.22 | $0.55 |
| `grok-4-fast-non-reasoning` | $0.22 | $0.55 |
| `grok-code-fast-1` | $0.22 | $1.65 |

The default model is `grok-4-1-fast` at $0.22 input / $0.55 output per million tokens. Models not in the pricing table fall back to the default model pricing.

See [Model Configuration](/reference/model-configuration) for provider setup and model selection details.

## Credit Reservation Flow

Credit billing uses an atomic reservation system that prevents concurrent requests from overdrawing an organization's balance. Every LLM call goes through a four-phase process:

```
Phase 1: Reserve credits (atomic Convex mutation)
    │
    │  Before calling the LLM, estimate the worst-case cost
    │  for the full execution (up to 10 LLM iterations).
    │  Atomically increment reservedCredits on the
    │  creditBalances record. If the effective balance
    │  (balance - reservedCredits) is below the estimated
    │  cost, reject with "Insufficient credits."
    │
    ▼
Phase 2: LLM execution
    │
    │  Run the agent's LLM loop (up to 10 iterations
    │  of tool calls). The reserved amount is held
    │  for the entire duration.
    │
    ▼
Phase 3a: Consume reservation (on success)
    │
    │  After the LLM returns, calculate the actual cost
    │  from real token counts. Subtract the reserved
    │  amount from reservedCredits. Insert a deduction
    │  transaction for the actual cost (balanceAfter is
    │  left undefined — it is a "pending" transaction).
    │
    ── OR ──
    │
Phase 3b: Release reservation (on failure)
    │
    │  If the LLM call fails, subtract the reserved
    │  amount from reservedCredits. No deduction
    │  transaction is created.
    │
    ▼
Phase 4: Reconciliation (every 5 seconds)
    │
    │  A cron job processes up to 200 pending transactions
    │  per run. For each organization with pending
    │  transactions, it applies them in order and updates
    │  the cached balance on the creditBalances record.
    │
    ▼
Balance is up to date
```

### Why Reservations Matter

Without reservations, two concurrent requests could each pass a balance pre-check and both proceed, overdrawing the account. Because `reserveCredits` is an atomic Convex mutation, concurrent calls are serialized at the database level. The second request sees the first request's reservation reflected in `reservedCredits` and will be rejected if the remaining effective balance is insufficient.

### Cost Estimation

The `estimateMaxCost` function calculates the worst-case cost for a single chat request. It assumes 10,000 input tokens and 40,960 output tokens per iteration, multiplied by 10 iterations (the maximum LLM loop count). This deliberately overestimates to ensure the reservation covers the full execution. The difference between the reserved amount and the actual cost is released when the reservation is consumed.

### Effective Balance

The effective balance shown to users accounts for both reservations and pending deductions that have not yet been reconciled:

```
effective balance = balance - reservedCredits - sum of pending deductions
```

This means balance checks are always accurate even when multiple requests are in-flight or between reconciliation cycles.

## What Consumes Credits

### Agent Chat (API, Webhook, Widget)

Every agent chat request that uses platform credits (no direct or OpenRouter key configured) is billed. The cost is calculated from actual token usage:

```
cost = (inputTokens * inputRate + outputTokens * outputRate) / 1,000,000
```

The result is stored in microdollars on the execution record and deducted from the organization balance.

### Studio Sessions

[Studio](/platform/studio) sessions deduct credits per message when using platform credits. Each message's token usage is tracked on the session and deducted via the same billing pipeline. Sessions using a direct provider key or OpenRouter key track token usage for analytics but skip credit deduction.

### Eval Runs

[Evaluations](/platform/evals) consume credits in two ways:

- **Agent tokens** from running each eval case through the agent
- **Judge tokens** from the LLM judge evaluating assertions

Both agent and judge token costs are calculated and deducted through the standard billing pipeline.

### WhatsApp Messages

Outbound WhatsApp messages sent through the platform incur per-message costs based on the Meta pricing category. Credits are deducted when the message status transitions to `sent`.

### Email

Outbound emails sent through the platform incur a per-message credit deduction.

## Bring Your Own Keys

Organizations can configure their own API keys to bypass platform billing entirely.

### How It Works

1. Navigate to **Settings > Providers** in the dashboard
2. Add a **direct provider key** (e.g., Anthropic, OpenAI, Google, xAI) or an **OpenRouter key**
3. Click **Test Connection** to verify the key works

When an agent runs, the platform resolves the API key using a 3-tier fallback:

1. **Direct provider key** -- If a key is configured for the model's provider, that key is used. No credits consumed.
2. **OpenRouter key** -- If an OpenRouter key is configured, all LLM calls are routed through OpenRouter. No credits consumed.
3. **Platform credits** -- If no keys are found, the platform uses its own OpenRouter key and deducts credits.

Token usage is always tracked on the execution record regardless of which key is used.

Keys are stored encrypted in the `providerConfigs` table. The API never returns the full key — only a masked version (first 4 and last 4 characters).

## Manual Credit Management

Organization admins can manage credits directly from the dashboard:

### Add Credits

Add a specific amount of credits to the organization balance. Creates an `addition` transaction with the admin's user ID recorded as `createdBy`.

### Adjust Balance

Set the balance to an exact value. The platform calculates the difference and creates an `adjustment` transaction. This is useful for corrections or promotional credits.

Both operations require organization admin privileges and are recorded in the transaction ledger with full audit trail.

## Database Schema

### creditBalances

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | ID | One balance record per organization |
| `balance` | number | Current balance in microdollars |
| `reservedCredits` | number (optional) | Sum of all active reservations in microdollars |
| `updatedAt` | number | Last reconciliation timestamp |

### creditTransactions

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | ID | Owning organization |
| `type` | enum | `purchase`, `addition`, `deduction`, `adjustment` |
| `amount` | number | Transaction amount in microdollars |
| `balanceAfter` | number (optional) | Balance after reconciliation (undefined while pending) |
| `description` | string | Human-readable description |
| `executionId` | ID (optional) | Linked execution for deductions |
| `createdBy` | ID (optional) | User who initiated manual transactions |
| `metadata` | object (optional) | Additional data (e.g., `polarOrderId`) |
| `createdAt` | number | Transaction timestamp |
