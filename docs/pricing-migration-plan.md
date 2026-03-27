# Pricing Migration Plan v14

## Current State → Target

| Aspect | Current | Target (v14) |
|---|---|---|
| Plans | None — pay-as-you-go | Free / Starter $49 / Pro $129 |
| Wallet | Org-level creditBalances | Org-level creditWallets (4 credit types) |
| Credit currency | Microdollars (1 USD = 1M) | Same internally, opaque "credits" in UI |
| Welcome bonus | $0.25 | None (Free), $10 (Starter), $15 (Pro) |
| Markup | 10% (1.1x) | 25% (1.25x) |
| LLM deduction | Async — OpenRouter sync every 15min | Inline — immediate after each chat |
| Balance check | None (allows unlimited overdraft) | Pre-flight check + post-call deduction |
| Model gating | None | By subscription tier (Efficient/Standard/Premium) |
| Agent limits | None | 3/15/Unlimited |
| Conversation limits | None | 200/5K/50K per month |
| Tool gating | None | By subscription tier |
| Rate limits | Fixed (30/100 per min) | Plan-aware |
| BYOK | Supported, $0 platform charge | Supported, subscription still required |
| Payment | Polar one-time purchases | Polar subscriptions + one-time top-ups |
| Public credit mutations | addCredits, adjustBalance (anyone can mint) | Deleted — internal only |

## Architecture Decisions

- **Org-scoped billing** — subscriptions + creditWallets per org (not user)
- **Post-call deduction** — pre-flight balance check (query, soft) → execute LLM → deductWallet (mutation, atomic). Overdraft allowed up to 2x estimated cost on purchased bucket only.
- **Inline monthly refill** — wallet checks billing period at deduction time, refills if stale (idempotent via lastMonthlyRefillPeriod)
- **No reservation pattern** — OCC conflicts too high under load. Post-call deduction is simpler and handles Convex's action model correctly.
- **No dual-write migration** — freeze old tables, write only to new. Avoids divergence from in-flight actions with old code.
- **Subscription required for all tiers** — even BYOK users pay subscription for platform features

## Implementation Steps

### Step 1: Plan Constants & Types

Create `platform/convex/lib/plans.ts` — pure TypeScript.

- PLANS constant with all limits per tier
- Model tier thresholds (outputPerMTok: efficient < $2, standard $2-$20, premium > $20)
- Hardcoded model blocklist (safety net for pricing glitches)
- MARKUP constant: 1.25
- Credit deduction order: bonus → monthly → rolled → purchased
- State machine transitions + validateStateTransition()
- Helper functions: getPlanLimits, getModelTier, canUseModelTier, canUseToolByPlan, canUseEnvironmentByPlan

### Step 2: Schema Changes

Modify `platform/convex/schema.ts`:

**New tables:**
- `subscriptions` — organizationId, plan, status, polarSubscriptionId?, currentPeriodStart, currentPeriodEnd, cancelledAt?, downgradeGraceEnd?, grandfatheredUntil?, trialUsed?, createdAt, updatedAt. Indexes: by_org, by_polar_sub, by_status_period_end [status, currentPeriodEnd]
- `creditWallets` — organizationId, bonusBalance (0), monthlyBalance (0), rolledBalance (0), purchasedBalance (0), bonusExpiresAt?, rolledCap, lastMonthlyRefillPeriod?, welcomeCreditSeeded?, autoTopUp fields, alert fields, lastReconciledAt?, updatedAt. Indexes: by_org, by_refill_period
- `conversationCounters` — organizationId, period (YYYY-MM), chatCount, evalRunCount, alert fields, updatedAt. Index: by_org_period
- `subscriptionEvents` — organizationId, eventType, polarEventId?, payload?, createdAt. Indexes: by_org, by_polar_event

**Modified tables:**
- `creditTransactions` — add creditType?, markupUsed?, type adds "admin_adjustment" and "refund"
- `modelRegistry` — add tier? (efficient|standard|premium)
- `processedPayments` — add webhookId? (Polar webhook-id header)

### Step 3: Wallet System

Create `platform/convex/wallets.ts`:

| Function | Type | Purpose |
|----------|------|---------|
| getWallet | query | 4-credit breakdown + totalBalance |
| getEffectiveBalance | internalQuery | Sum non-expired credits |
| getOrCreateWallet | internal helper | Eager at org creation, lazy as migration safety net |
| deductWallet | internalMutation | bonus→monthly→rolled→purchased, inline refill, overdraft cap, alerts, auto-top-up trigger, schedule costRollup |
| addPurchasedCredits | internalMutation | One-time purchase |
| seedSignupBonus | internalMutation | Idempotent via welcomeCreditSeeded flag |
| refillMonthlyCredits | internalMutation | Roll unused (capped), reset monthly, paginated 100/batch |
| expireBonusCredits | internalMutation | Zero if expired |

Key behaviors:
- All balances initialized to 0 (never optional)
- Daily spend checked via costRollups day query (not separate field)
- Inline refill idempotent via lastMonthlyRefillPeriod
- getModelCost returns fail-expensive ($100/MTok) when model not found

### Step 4: Subscription System

Create `platform/convex/subscriptions.ts`:

| Function | Type | Purpose |
|----------|------|---------|
| getUserSubscription | query | Current org subscription |
| getSubscriptionForOrg | internalQuery | Picks highest-tier active, respects grandfatheredUntil |
| createSubscription | internalMutation | Expires old subs first, records event |
| cancelSubscription | mutation | Requires org admin, validates transition, prorated refund |
| createSubscriptionCheckout | action | Polar checkout |
| handleSubscriptionWebhook | internalMutation | ALL logic in single mutation (dedup + process atomically) |

Webhook events handled: subscription.active, subscription.updated, subscription.canceled, checkout.completed, order.refunded, order.disputed, order.dispute_won, order.dispute_lost.

### Step 5: Plan Enforcement

Create `platform/convex/lib/planEnforcement.ts`:

| Function | Purpose |
|----------|---------|
| getPlanForOrg | org → subscription → plan limits (default "free") |
| assertAgentLimit | Count agents excluding deleted |
| incrementAndAssertConversationLimit | Single atomic mutation, separate chat/eval counts, 80%/90% alerts |
| assertModelAccess | By subscription tier + blocklist + real-time fallback |
| assertToolAccess | Glob match, custom tools always allowed |
| assertEnvironmentAccess | Eval always allowed |

### Step 6: Chat Enforcement

Modify `platform/convex/agent.ts` — in `executeChat` (shared by ALL paths):

```
1. Resolve API key + tier
2. Resolve subscription tier
3. assertEnvironmentAccess (eval always allowed)
4. assertModelAccess (by subscription tier, ALL key tiers)
5. incrementAndAssertConversationLimit
6. assertToolAccess (cache allowlist)
7. Estimate cost (maxTokens × model pricing)
8. Pre-flight balance check (query, soft)
9. Per-request cost cap check
10. Execute LLM (pass remainingBudget through agent.chat chain)
11. Compute actual cost (LLM + tool costs)
12. deductWallet (mutation — atomic with inline refill)
13. Record execution
14. Schedule OpenRouter key limit update + costRollup
```

Channel-appropriate error responses on billing failure.

### Step 7: Security Fixes

Modify `platform/convex/billing.ts`:
- DELETE `addCredits` and `adjustBalance` as public mutations
- Add `adminAdjustCredits` (internalMutation, requires reason, logged)
- Rewire deductCredits → wallets.deductWallet
- Rewire getBalance → creditWallets
- Extend addCreditsFromPolar for subscription events
- Redirect seedWelcomeCredits → wallets.seedSignupBonus

### Step 8: Rewire OpenRouter Keys

Modify `platform/convex/orgKeys.ts`:
- provisionOrgKey, updateKeyLimit, syncKeyUsage → read from creditWallets
- syncAllOrgKeys → parallelized batches of 20

### Step 9: Model Tier & Markup

Modify `platform/convex/modelPricing.ts`:
- MARKUP: 1.1 → 1.25 (store markupUsed in transactions)
- syncModelRegistry: set tier field + hardcoded blocklist
- getModelCost: fail-expensive fallback when model not found

### Step 10: Resource Limits

- `agents.ts` create: assertAgentLimit (soft on downgrade)
- `threads.ts` create/getOrCreate: incrementAndAssertConversationLimit
- `toolExecution.ts`: assertToolAccess (built-in only)
- `rateLimits.ts`: plan-aware rates
- Environment gating at API key creation and CLI sync

### Step 11: Polar Subscription Products

- Create products: Starter Monthly/Annual, Pro Monthly/Annual
- Extend `/webhook/polar` for subscription + dispute events
- Dedup by webhook-id header
- Handle refunds and disputes

### Step 12: New Crons

| Cron | Frequency | Purpose |
|------|-----------|---------|
| refillMonthlyCredits | daily | Safety net for inline refill misses, paginated |
| expireBonusCredits | daily | Zero expired balances |
| expireSubscriptions | daily | Cancelled/trialing past period → expired |
| expireDowngradeGrace | daily | Revoke prod access after 7-day grace |
| syncAllOrgKeys | 15min | Reconciliation (batched) |
| reconcileBalances | weekly | Safety net |
| anonymizeOldRecords | monthly | GDPR: anonymize > 2 years |
| resetAutoTopUpCounters | monthly | Reset monthly charge tracking |

### Step 13: Dashboard

- Billing page: plan card, 4-credit wallet, usage meters, transaction history, auto-top-up config
- Model selector: filter by subscription tier, locked models with upgrade CTA
- Environment switcher: disable production for Free
- Eval runner: cost estimate before running, confirm if > 25% of balance
- Spend forecast: projected monthly based on 7-day trailing
- Invoice downloads via Polar API

### Step 14: Cleanup

- Remove reads from old creditBalances
- Keep old tables for historical data
- Remove reconcileBalances hourly cron (weekly only)
- Archive old billing code

## Migration Strategy

### Phase 1 — Schema + Data

1. Deploy new schema (4 new tables, 3 modified)
2. Paginated migration (100 orgs/batch): create wallet + subscription for each org
3. Map existing creditBalances.balance → purchasedBalance
4. All orgs get Free subscription with `grandfatheredUntil = now + 60 days`
5. Send migration announcement email

### Phase 2 — Verify

6. Compare total credits across old/new tables
7. Run reconciliation

### Phase 3 — Switch

8. Enable enforcement in executeChat
9. Update dashboard billing pages
10. Update Polar webhook handler
11. Deploy to production

### Phase 4 — Communicate

12. Grandfathering reminder at 30 days
13. Final warning at 7 days

### Phase 5 — Cleanup (after 60-day grace)

14. Enable full plan enforcement
15. Remove grandfathering logic
16. Archive old billing code

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Existing users churn | 60-day grandfathering with full access |
| Credit migration data loss | Paginated + idempotent, no dual-write |
| BYOK users refuse subscription | Grandfathered for 60 days, clear communication |
| OCC contention on wallet | Post-call deduction (not reservation), costRollup scheduled |
| Cron double-execution | lastMonthlyRefillPeriod idempotency guard |
| OpenRouter sync gap | Inline deduction is primary, sync is safety net |
| Polar webhook failures | Dedup by webhook-id, catch errors, return 200, alert |
| Model pricing glitch | Hardcoded blocklist + fail-expensive fallback |
| Public credit mutations | Deleted entirely, internal only |

## Compliance

- **PCI DSS**: SAQ A (redirect-based checkout)
- **GDPR**: 7-year retention, 2-year anonymization, right to erasure = anonymize
- **EU Consumer Law**: 14-day withdrawal on credit purchases (track consumed)
- **Tax**: Polar as Merchant of Record
- **Audit**: All admin actions logged, subscription events recorded
