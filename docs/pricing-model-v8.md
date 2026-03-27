# Struere Pricing Model v14

## Overview

Struere uses a builder-centric pricing model. Builders (technical users/agencies) pay Struere for platform access and AI credits. Builders charge their end clients (SMBs) separately — Struere does not interact with end clients in Phase 1.

Subscription is required for ALL tiers, including BYOK (bring-your-own-key) users. The subscription covers platform features (RBAC, entities, triggers, integrations, multi-agent orchestration). Credits are for LLM and tool execution costs only.

## Plans

| | Free | Starter $49/mo | Pro $129/mo | Enterprise |
|---|---|---|---|---|
| Annual price | — | $39/mo (20% off) | $97/mo (25% off) | Custom |
| Agents | 3 | 15 | Unlimited | Custom |
| Models | Efficient only | Efficient + Standard | All | All + fine-tuned |
| Monthly credits | $2 | $15 | $75 | Custom |
| Signup bonus | None | $10 (no expiry) | $15 (no expiry) | — |
| Environments | Dev only | Dev + Prod | Dev + Prod | Dev + Prod + Staging |
| Monthly conversations | 200 (20/day max) | 5,000 | 50,000 | Custom |
| Eval runs/mo | 10 (3/day) | 100 (10/day) | Unlimited (50/day) | Custom |
| Rolled credit cap | $4 | $30 | $150 | Custom |
| Per-request cost cap | $0.50 | $2 | $10 | Custom |
| File storage | 1 GB | 10 GB | 100 GB | Custom |
| Concurrent sandbox sessions | 1 | 3 | 10 | Custom |
| Dev rate limit | 10 req/min | 10 req/min | 10 req/min | Custom |
| Prod rate limit | — | 60 req/min | 300 req/min | Custom |
| Uptime SLA | — | — | 99.9% | 99.95% |
| Support | Community | Email (48h) | Priority (8h) | Dedicated + Slack |
| Trial | N/A | 14-day ($5 trial credits) | N/A | POC |

## BYOK (Bring Your Own Key)

Builders can configure their own LLM provider API keys. When using BYOK:

- Builder still pays the Struere subscription ($49/$129/mo) for platform access
- No Struere credits consumed for LLM calls routed through BYOK keys
- Tool execution costs (WhatsApp, email, custom tools) still deducted from wallet
- All plan limits still apply (agents, conversations, rate limits, model tier restrictions)
- Model access gated by subscription tier, not API key tier
- 3-tier key resolution remains: direct provider key → org OpenRouter key → platform credits

## Model Tiers

| Tier | Multiplier | Available on | Examples |
|---|---|---|---|
| Efficient | 1x | All plans | gpt-5-mini, claude-haiku |
| Standard | 2.5x | Starter + Pro | gpt-5, claude-sonnet |
| Premium | 8x | Pro only | claude-opus, gpt-5-pro |

Credit anchor: 1 credit = 1,000 tokens on Efficient tier models.

Model tier assignment based on outputPerMTok: Efficient < $2, Standard $2-$20, Premium > $20.
Hardcoded blocklist for premium models as safety net (prevents pricing glitch exploitation).

When a model is not found in the registry, cost defaults to fail-expensive ($100/MTok) — never $0.

## Tool & Integration Gating

| Capability | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Entity tools (CRUD) | Yes | Yes | Yes | Yes |
| Event tools | Yes | Yes | Yes | Yes |
| Web tools (search, fetch) | Yes | Yes | Yes | Yes |
| Agent.chat (multi-agent) | — | Yes | Yes | Yes |
| WhatsApp | — | Yes | Yes | Yes |
| Email (Resend) | — | Yes | Yes | Yes |
| Calendar (Google) | — | Yes | Yes | Yes |
| Airtable | — | — | Yes | Yes |
| Payment (Flow, Polar) | — | — | Yes | Yes |
| Custom tools | — | 5 total | Unlimited | Unlimited |
| Eval suites | — | 10 suites, 50 cases | Unlimited | Unlimited |
| Triggers | 2 | 10 | Unlimited | Custom |

Custom tools are always allowed to execute (user-defined), but execution counts toward rate limits and credit consumption.

## Tool Execution Costs

| Tool | Cost per use |
|------|-------------|
| WhatsApp messages | $0.005/message + Meta pass-through |
| Email (Resend) | $0.001/message |
| Custom tools | $0.001/execution + $0.01/minute runtime |
| Web tools | $0.001/call |
| Calendar, Entity, Event | Free |

WhatsApp Meta per-conversation fees are passed through at cost as a separate line item.

## Wallet & Credits

### Single Wallet per Organization (Phase 1)

One credit wallet per org. All credit consumption — dev, eval, production — deducts from the org's wallet.

### Credit Types & Deduction Order

1. **Bonus credits** — signup bonus. Consumed FIRST (they expire soonest). 30-day expiry on Free plan.
2. **Monthly credits** — included with plan, reset at billing cycle. Unused monthly credits roll over for 1 cycle (capped at plan's rolled credit cap).
3. **Rolled credits** — from previous cycle's unused monthly. Expire at end of current cycle.
4. **Purchased credits** — bought via top-up. Never expire. Non-refundable (14-day EU withdrawal right if unconsumed). Overdraft allowed on this bucket only (capped at 2x estimated request cost).

### Credit Pricing

- Markup: ~25% built into credit-to-token conversion (not user-facing)
- Opaque credit units — users see "credits," not dollar-to-token math
- Minimum top-up: $10
- Bulk discount: $100+ = 5% bonus, $500+ = 10% bonus
- Credit pricing adjusted quarterly, 30-day advance notice
- Purchased credits honor rate at time of purchase

### Inline LLM Deduction

LLM costs are deducted immediately after each chat execution (not via 15-minute sync). The OpenRouter usage sync cron is a reconciliation safety net only.

The deduction mutation also handles:
- Inline monthly credit refill (if billing period rolled, idempotent)
- Low-balance alert checks (10% threshold, rate-limited)
- Auto-top-up trigger (if enabled, 5-minute dedup)
- Cost rollup scheduling (fire-and-forget, not blocking)

### Multi-Agent Cost Budget

`agent.chat` passes `remainingBudget` through the depth chain. Per-conversation cap: Free $0.50, Starter $2, Pro $10. Prevents runaway multi-agent loops.

## Spend Management

### Alerts

- Low balance: 10% remaining threshold, email + dashboard notification
- Exhausted: immediate alert when wallet hits $0
- Conversation usage: alerts at 80% and 90% of monthly limit
- Rate-limited: max 1 alert email per hour

### Daily Spend Limit

Checked via costRollups day query (existing analytics table). No separate daily counter to avoid OCC contention.

### Emergency Mode

When wallet hits $0 (tier 3 users) or per-request cost cap exceeded:

- **API**: JSON response `{ error: "insufficient_credits", upgradeUrl }`
- **WhatsApp/Widget**: configurable fallback message from agentConfig
- **Dashboard**: error returned for modal display
- Alert email to org admins (max 1/hour)

Agent never silently stops — always a channel-appropriate response.

### Auto-Top-Up (Opt-In)

- Requires explicit consent with timestamp and clear disclosure
- Configurable threshold and amount
- Email notification on each charge
- Monthly maximum limit (configurable, default $200)
- 5-minute dedup between charges

## Production Deploy Requirements

Before any agent serves production traffic:

1. Builder on Starter+ plan (subscription required)
2. Fallback contact method configured (validated email or phone)
3. Funded wallet (minimum balance or BYOK configured)
4. At least one production-scoped API key

Enforced at infrastructure level.

## Development Environment Enforcement

| Rule | Detail |
|---|---|
| Rate limit | 10 req/min per API key |
| Thread expiry | 24 hours |
| Origin restriction | Dev API keys only from dashboard/CLI |
| Enforcement | Infrastructure-level (HTTP router) |

Eval environment is always accessible to all plans (not gated).

## Trials

- 14-day free trial on Starter only, no credit card required
- $5 trial credits included
- `trialUsed` flag prevents re-trial
- Auto-downgrade to Free after trial ends
- 3-day warning email before trial expires

## Subscriptions

### State Machine

```
trialing → active, cancelled
active → cancelled, past_due, paused
cancelled → active
past_due → active, cancelled
paused → active, cancelled
```

All state transitions validated via `validateStateTransition()`.

### Upgrade/Downgrade

- **Upgrade**: immediate effect, Polar prorated billing, monthly credits refilled to new amount
- **Downgrade**: 7-day grace period for production access. During grace, production agents continue with lower-tier model restrictions. After grace: production API keys revoked, production agents paused (not deleted). Rolled credits capped to new tier. Monthly credits change at next refill.

### Cancellation

- Set `cancelledAt` + `cancelAtPeriodEnd`
- Prorated refund for unused subscription days via Polar
- Credits NOT clawed back
- At period end: transition to expired, downgrade to Free

## Anti-Abuse

| Measure | Detail |
|---|---|
| Free org limit | 1 free org per Clerk user |
| Email verification | Required for free tier |
| Org creation rate | 1 per 30 days per user |
| Per-request cost cap | Free $0.50, Starter $2, Pro $10 |
| Eval limits | Free 10/mo, Starter 100/mo, Pro unlimited |
| Model blocklist | Hardcoded premium model list (safety net) |
| Webhook dedup | Polar webhook-id header |
| Replay window | 60 seconds |

## Downgrade Policy

1. Prorated refund issued via Polar
2. 7-day grace period (`downgradeGraceEnd`) for production access
3. During grace: agents continue, lower-tier model restrictions apply
4. Daily "X days remaining" emails
5. After grace: production API keys revoked, agents paused
6. Rolled credit cap reduced (excess expires)
7. Monthly credits change at next refill
8. Soft agent limit (warning, no deletion)
9. Data preserved (read-only for excess orgs if applicable)

## Migration (Existing Users)

- All existing orgs receive Free subscription with 60-day grandfathering (full access)
- Existing credit balances mapped to purchasedBalance in new wallet
- Migration announcement email sent
- Reminder at 30 days, final warning at 7 days
- Plan enforcement enabled after 60-day grace

## Compliance

- **PCI DSS**: SAQ A (redirect-based Polar checkout, no card data stored)
- **GDPR**: 7-year financial record retention, anonymization after 2 years, right to erasure = anonymize (cannot delete due to tax retention), DPA + SCCs for US data residency
- **Refunds**: 14-day withdrawal right on credit purchases (EU consumer law, track consumed per purchase). Subscription: prorated refund for unused days.
- **Tax**: Polar acts as Merchant of Record — handles tax collection, remittance, invoicing
- **Audit trail**: All admin billing actions logged, subscription state changes recorded in subscriptionEvents table

## Uptime SLA

| Plan | SLA | Breach credit |
|---|---|---|
| Pro | 99.9% monthly | 10% of monthly bill as account credits |
| Enterprise | 99.95% monthly | Per contract |

Scheduled maintenance: announced 72h in advance, 00:00-06:00 UTC, max 4h/month, excluded from SLA.

## Phase 2: End-Client Billing (Future — after 50+ paying builders)

When launched:
- Wallet splits: builder wallet (dev/eval) + per-org wallet (production)
- Builders set their own markup on Struere's credit rate per org
- Struere takes 15% of end-client credit purchases
- End clients get: read-only dashboard (usage, invoices), self-serve top-up, usage alerts
- Per-org budget caps and alerts configurable by builder

## Unit Economics

| Scenario | Revenue/mo | LLM cost | Infra | Margin |
|---|---|---|---|---|
| Free | $0 | ~$1.50 | $2 | -$3.50 |
| Starter (no BYOK) | $49 | ~$11.25 | $3 | $34.75 (71%) |
| Starter (BYOK) | $49 | $0 | $3 | $46 (94%) |
| Pro (no BYOK) | $129 | ~$56.25 | $5 | $67.75 (53%) |
| Pro (BYOK) | $129 | $0 | $5 | $124 (96%) |
| Pro + $100 purchased | $229 | ~$131.25 | $5 | $92.75 (40%) |

## Key Metrics

| Metric | Target | Alarm |
|---|---|---|
| Free → Starter conversion | 10-15% | <5% |
| Starter → Pro conversion | 20-25% | <10% |
| Trial → paid conversion | 30%+ | <15% |
| Starter monthly churn | <5% | >8% |
| Pro monthly churn | <3% | >5% |
| ARPU (paid users) | $90+/mo | <$60 |
| Credit utilization | 70-85% | <50% or >95% |
