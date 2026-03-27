# Pricing Implementation Tracker

Tracks features advertised on the pricing page vs implementation status. Features marked as "advertised" are shown on the pricing page and are OK to ship — they represent the intended product direction. Features marked as "removed from page" were stripped because they're not close enough to implementation.

## Implemented

| Feature | Where enforced | Notes |
|---------|---------------|-------|
| Agent limits (Free: 3) | `agents.ts:create()` | |
| Automation limits (Free: 5) | `lib/sync/triggers.ts` | |
| Eval suite limits (Free: 1) | `evals.ts:createSuite()` | |
| WhatsApp connection limits (Free: 1, Starter: 5, Pro: unlimited) | `whatsapp.ts:addPhoneNumber()` | |
| Team member limits (Free: 1, Starter: 5, Pro: 20) | `organizations.ts:ensureMembershipFromClerk()` | |
| Weekly credit allocation (Starter: $7.50, Pro: $75) | `lib/plans.ts`, `subscriptions.ts` | |
| Weekly credit reset (7-day cycle) | `billing.ts:deductCredits()` inline + `crons.ts` safety net | |
| Purchased credits never expire | `billing.ts` — no expiry logic | |
| BYOK skips LLM credit deduction | `agent.ts:358` — `usedPlatformKey = tier === 3` | |
| WhatsApp message billing | `whatsapp.ts:updateMessageStatus()` — country-based pricing | |
| Email billing | `email.ts:storeOutboundEmail()` — 990 microdollars/email | |
| Zero-balance enforcement | `agent.ts:358-366` — pre-execution check blocks at `balance <= 0` | Returns hardcoded message |
| 1 free org per admin user | `organizations.ts:ensureMembershipFromClerk()` | Implemented 2026-03-27 |
| Credit deduction order (subscription first, then purchased) | `billing.ts:deductCredits()` | |

## Advertised but Not Yet Implemented

These are shown on the pricing page as intended features. Implement before they become customer expectations.

### High Priority

| Feature | Advertised as | Current behavior | Files to change |
|---------|--------------|-----------------|-----------------|
| Model tier gating | Free: efficient only, Starter: +standard, Pro: +premium | All models available to all plans. Tiers tracked in `modelRegistry` but never checked | `agent.ts` (add plan check before LLM call), `lib/plans.ts` (add `allowedModelTiers`) |
| Integration/tool gating | Free: entity/event/web. Starter: +WhatsApp/email/calendar/agent.chat. Pro: +Airtable/payment/custom tools | All tools available to all plans. `canUseTool()` only checks RBAC, not plan | `lib/permissions/tools.ts` or `lib/toolExecution.ts` (add plan-based tool filtering) |
| Multi-agent orchestration gating | Starter+ only | `agent.chat` tool available to all plans | Same as tool gating above |
| Custom tools gating | Pro: unlimited | No custom tool count limit exists | `lib/plans.ts` (add `maxCustomTools`), enforce in tool creation |

### Medium Priority

| Feature | Advertised as | Current behavior | Files to change |
|---------|--------------|-----------------|-----------------|
| Upgrade credit refill | "Credits refilled to new plan's allowance" | `seedWeeklyCredits` blocked mid-week by dedup check — new credits only at next week boundary | `subscriptions.ts` (detect plan change, force refill bypassing dedup) |
| Extra seat billing ($5/mo) | Removed from page but in `plans.ts` as `extraSeatPrice: 500` | Hard-rejects at seat limit instead of allowing paid overage | Needs Polar metered billing or manual credit charge per seat |

## Removed from Pricing Page

These were stripped because they're not implemented and not close to implementation. Re-add when built.

| Feature | Was advertised as | Why removed |
|---------|------------------|-------------|
| Extra seat billing | "$5/mo per additional team member" | `extraSeatPrice` defined but never charged. System rejects at limit. |
| Downgrade grace period | "7-day grace period for production access, agents paused" | No downgrade handler, no grace timer, no agent pausing. Polar handles end-of-period. |
| Configurable fallback message | "WhatsApp and widget get configurable fallback" | Hardcoded message in `agent.ts:362`. No per-agent config field. |
| Low balance email alerts | "Org admins receive an email alert" | `checkLowBalances` cron only logs to console. No email integration. |
| Conversation limits | 200/5K/50K monthly limits in pricing doc | Not in `PLANS`, no thread creation limits. |
| Environment restriction by plan | "Free restricted to dev only" | No environment+plan check anywhere in code. |

## Implementation Notes

- **Model tier data exists** — `getModelTier()` in `modelPricing.ts` classifies models as efficient/standard/premium based on output cost. Just needs a plan check gate.
- **Tool permission framework exists** — `canUseTool()` in `lib/permissions/tools.ts` already runs per-tool checks. Can extend with plan-based filtering.
- **Zero-balance message is hardcoded** — `agent.ts:362`: `"I'm temporarily unavailable due to a billing issue. Please contact support."` Could be made configurable via `agentConfigs` field.
- **Overdraft is possible** — A single expensive LLM call can push balance negative. Next call is blocked. This is acceptable (small overdraft on last call).
