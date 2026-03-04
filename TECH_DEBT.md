# Struere Platform -- Technical Debt Registry

Last updated: 2026-03-04

This document catalogs known technical debt items across the Struere platform. Each item includes a description, impact assessment, priority level, and estimated effort.

**Priority levels:**
- **P0** -- Critical. Actively causing or likely to cause production incidents.
- **P1** -- High. Degrades reliability, developer experience, or security posture.
- **P2** -- Medium. Increases maintenance burden or slows feature development.
- **P3** -- Low. Cleanup or improvement with minimal immediate risk.

**Effort estimates:**
- **S** (Small) -- Under 1 day of work.
- **M** (Medium) -- 1-3 days of work.
- **L** (Large) -- 3-7 days of work.
- **XL** (Extra Large) -- 1-3 weeks of work.

---

## Table of Contents

1. [TD-001: Credits can go negative](#td-001-credits-can-go-negative)
2. [TD-002: No test coverage](#td-002-no-test-coverage)
3. [TD-003: Messages and events tables grow unboundedly](#td-003-messages-and-events-tables-grow-unboundedly)
4. [TD-004: No debounce on file watcher](#td-004-no-debounce-on-file-watcher)
5. [TD-005: Hardcoded Convex URL in 6 files](#td-005-hardcoded-convex-url-in-6-files)
6. [TD-006: Virtual module source not auto-synced with SDK defines](#td-006-virtual-module-source-not-auto-synced-with-sdk-defines)
7. [TD-007: use-convex-data.ts monolith](#td-007-use-convex-datats-monolith)
8. [TD-008: Excessive v.any() and as-any casts](#td-008-excessive-vany-and-as-any-casts)

---

## TD-001: Credits can go negative

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Effort** | M |
| **Area** | `platform/convex/billing.ts`, `platform/convex/agent.ts` |

### Description

A `checkCreditsPreExecution` internal mutation already exists (line 105 of `billing.ts`) that reads the balance and throws if insufficient. However, two gaps remain:

1. **Race condition** -- The check is read-only. Two concurrent requests can both pass the pre-check before either's deduction is visible, allowing both to proceed.
2. **Low threshold** -- The pre-check only validates against `estimateMinimumCost` for 1000 input tokens, so the balance can still go negative when actual usage exceeds that estimate.

Credit deduction is still post-hoc. The LLM execution loop in `agent.ts` runs to completion (up to 10 tool call iterations), and only after the full execution does it call `billing.deductCredits` (line 361 of `agent.ts`). The `deductCredits` mutation inserts a transaction record but performs no balance check. Balance reconciliation happens asynchronously via a cron job (`reconcileBalances`) that runs every 5 seconds.

This means an organization can consume unbounded resources before the balance is updated, and the balance can go negative without any enforcement.

### Impact

- Organizations can accrue usage they cannot pay for.
- The pre-execution check exists but does not prevent concurrent requests from both passing.
- The 5-second reconciliation delay creates a window where concurrent requests can all pass without seeing each other's consumption.

### Suggested Fix

Implement an atomic credit reservation pattern: reserve (decrement) an estimated amount at the start of execution within a mutation (ensuring serialized access), then reconcile the difference on completion. This eliminates the race condition because the reservation is a write that Convex serializes. If the reservation fails due to insufficient balance, the request is rejected before any LLM call.

---

## TD-002: No test coverage

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Effort** | XL |
| **Area** | Entire codebase |

### Description

The project has zero automated tests. There are no unit tests for Convex backend functions, no integration tests for the permission engine, no UI tests for the dashboard, and no CLI tests. The only test-adjacent files found in the repository are configuration stubs in `tsconfig.json` files and unrelated OpenAPI exploration scripts.

Specific areas of concern:
- The permission engine (`platform/convex/lib/permissions/`) implements deny-overrides-allow evaluation, scope filtering, and field masking with no test validation.
- The billing system has no tests verifying credit deduction, reconciliation, or edge cases (negative balances, concurrent transactions).
- The CLI sync pipeline (watch, load, transform, upload) has no tests.
- The agent execution loop (LLM calls, tool dispatch, multi-agent delegation with cycle detection) has no tests.

### Impact

- Regressions are only caught in production or during manual testing.
- Refactoring the permission engine or billing system is high-risk without test coverage.
- No confidence in correctness of security-critical code paths (RBAC, scope rules, field masks).

### Suggested Fix

Prioritize testing in this order:
1. Permission engine unit tests (security-critical).
2. Billing logic tests (financial-critical).
3. CLI sync integration tests.
4. Agent execution loop tests.
5. Dashboard component tests for key workflows.

---

## TD-003: Messages and events tables grow unboundedly

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Effort** | L |
| **Area** | `platform/convex/schema.ts` (tables: `messages`, `events`, `executions`) |

### Description

The `messages`, `events`, and `executions` tables have no TTL, archival strategy, or cleanup mechanism. Every LLM interaction produces multiple message rows. Every entity mutation emits events. Every agent execution creates an execution record. These tables grow monotonically.

The only cron jobs defined in `platform/convex/crons.ts` are for sandbox session cleanup, payment reconciliation, and credit balance reconciliation. There is nothing for message/event pruning.

### Impact

- Query performance degrades over time as tables grow, particularly for thread-scoped message queries and event queries filtered by type.
- Storage costs increase linearly with usage.
- Large organizations with high agent usage will hit performance cliffs first.
- The `events` table is especially concerning because `event.query` tool calls scan by `by_org_env_type` index, and high-volume event types will accumulate unbounded rows.

### Suggested Fix

Implement a tiered approach:
1. Add a scheduled cron to soft-delete or archive messages and events older than a configurable retention period.
2. Add pagination limits to all event and message query paths.
3. Consider a separate archival table or external storage for historical data.

---

## TD-004: No debounce on file watcher

**Status: RESOLVED** -- File watcher debounce has been implemented in `packages/struere/src/cli/commands/dev.ts`.

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Effort** | S |
| **Area** | `packages/struere/src/cli/commands/dev.ts` |

### Description

The `struere dev` command uses chokidar to watch resource directories (agents, entity-types, roles, triggers, tools, evals, fixtures). Every file change, addition, or removal event immediately triggers `performDevSync()` with no debounce or throttle. The `handleFileChange` function (line 209) calls sync directly on each event.

When a user saves multiple files in quick succession (common with editor auto-save, git branch switches, or bulk edits), each file change triggers a separate full sync to Convex. These syncs run concurrently, potentially causing race conditions and redundant network requests.

### Impact

- Rapid saves trigger multiple simultaneous sync calls to the Convex HTTP endpoint.
- Concurrent syncs can produce inconsistent state if they interleave.
- Unnecessary load on the Convex backend during normal development workflows.
- User sees multiple "Syncing..." / "Synced" spinner cycles for what should be a single operation.

### Suggested Fix

Add a debounce (300-500ms) to the `handleFileChange` function so that multiple rapid file changes are batched into a single sync call. A simple implementation: collect changed paths, wait for the debounce window to expire, then perform one sync.

---

## TD-005: Hardcoded Convex URL in 6 files

**Status: RESOLVED** -- Convex URL has been centralized in `packages/struere/src/cli/utils/convex.ts` and imported by other files.

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Effort** | S |
| **Area** | `packages/struere/src/cli/utils/` |

### Description

The production Convex deployment URL (`https://rapid-wildebeest-172.convex.cloud`) is hardcoded as a fallback in 6 separate files:

- `packages/struere/src/cli/utils/convex.ts`
- `packages/struere/src/cli/utils/entities.ts`
- `packages/struere/src/cli/utils/integrations.ts`
- `packages/struere/src/cli/utils/whatsapp.ts`
- `packages/struere/src/cli/utils/evals.ts`
- `apps/dashboard/test-sandbox-struere.mjs`

Each file independently declares `const CONVEX_URL = process.env.STRUERE_CONVEX_URL || 'https://rapid-wildebeest-172.convex.cloud'`.

### Impact

- If the Convex deployment URL changes, all 6 files must be updated manually. Missing one causes a silent failure pointing to a stale deployment.
- Violates DRY; the URL string appears as a magic constant scattered across the CLI utils.

### Suggested Fix

Extract the Convex URL resolution into a single shared constant or utility function (e.g., in `convex.ts`) and import it from the other files. The `convex.ts` file already exists and is the natural home for this.

---

## TD-006: Virtual module source not auto-synced with SDK defines

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Effort** | M |
| **Area** | `packages/struere/src/cli/utils/plugin.ts`, `packages/struere/src/define/` |

### Description

The Bun plugin in `plugin.ts` provides a virtual module that intercepts `import { defineAgent } from 'struere'` during `struere dev`. This virtual module contains a hand-written JavaScript re-implementation of the define functions (`defineAgent`, `defineRole`, `defineEntityType`, `defineTrigger`, `defineTools`, `defineConfig`) as a raw string template (`VIRTUAL_MODULE_SOURCE`, lines 6-131).

The actual SDK define functions live in separate TypeScript files under `packages/struere/src/define/` (agent.ts, role.ts, entityType.ts, trigger.ts, tools.ts, config.ts). The virtual module source and the real SDK implementations are maintained independently with no automated check that they stay in sync.

Additionally, the type declarations (`TYPE_DECLARATIONS`, lines 153-315 in plugin.ts) are also manually maintained and contain known discrepancies with the CLAUDE.md documentation:
- `ScopeRuleConfig.operator` includes `'ne'` instead of `'neq'`.
- `PolicyConfig` includes an optional `priority` field that does not exist in the actual system.
- `ToolContext.state` (get/set/delete) is declared in TYPE_DECLARATIONS but does not exist in the actual `types.ts`.
- `AgentConfig.threadContextParams` is missing from TYPE_DECLARATIONS but exists in the actual schema (line 64-69 of schema.ts).

### Impact

- Changes to define function behavior in the SDK may not be reflected in the virtual module, causing different behavior during `struere dev` vs production imports.
- Type declaration drift causes incorrect editor autocompletion and can mislead developers.
- Bugs introduced by the drift are silent and hard to diagnose.

### Suggested Fix

Generate `VIRTUAL_MODULE_SOURCE` and `TYPE_DECLARATIONS` automatically from the actual SDK source files, either at build time or as a pre-publish step. Alternatively, have the Bun plugin resolve to the actual compiled SDK files instead of maintaining a separate copy.

---

## TD-007: use-convex-data.ts monolith

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Effort** | M |
| **Area** | `apps/dashboard/src/hooks/use-convex-data.ts` |

### Description

This single file is 597 lines long and exports 62+ custom hooks wrapping Convex queries and mutations. Every domain (agents, entities, threads, roles, events, triggers, billing, integrations, evals, etc.) is mixed into one file with no separation.

### Impact

- Difficult to navigate; finding a specific hook requires searching through 597 lines.
- Merge conflicts are frequent because any dashboard feature change touches this file.
- No domain boundaries make it hard to reason about which hooks depend on which backend functions.
- Importing from this file pulls the entire module into scope even when only one hook is needed.

### Suggested Fix

Split into domain-specific hook modules:
- `hooks/use-agents.ts`
- `hooks/use-entities.ts`
- `hooks/use-threads.ts`
- `hooks/use-roles.ts`
- `hooks/use-events.ts`
- `hooks/use-billing.ts`
- `hooks/use-integrations.ts`
- `hooks/use-evals.ts`

Re-export from a barrel `hooks/index.ts` for backward compatibility during migration.

---

## TD-008: Excessive v.any() and as-any casts

| Field | Value |
|-------|-------|
| **Priority** | P3 |
| **Effort** | L |
| **Area** | `platform/convex/` (28 files, 157 `v.any()` occurrences), `apps/dashboard/` (7 files, 9 `as any` casts) |

### Description

The Convex schema (`platform/convex/schema.ts`) uses `v.any()` in 26 locations across fields like `parameters`, `schema`, `data`, `payload`, `metadata`, `config`, `result`, `arguments`, `condition`, and `args`. Backend function files add another 131 `v.any()` usages across 28 files. The dashboard has 9 `as any` casts across 7 component/page files. Combined with the 48 `as any` casts in backend TypeScript files, this represents a significant erosion of type safety.

Key locations in the schema:
- `entityTypes.schema` -- entity type schemas stored as `v.any()`
- `entities.data` -- all entity data stored as `v.any()`
- `events.payload` -- event payloads stored as `v.any()`
- `messages.toolCalls` -- tool call arrays stored as `v.any()`
- `executions.result` -- execution results stored as `v.any()`
- `triggers.condition` and `triggers.actions[].args` -- trigger configs stored as `v.any()`

### Impact

- Runtime type errors are not caught at the database layer.
- Convex schema validation provides no protection for these fields.
- Backend `as any` casts suppress TypeScript errors that could indicate real bugs.
- Refactoring is risky because the type system cannot verify correctness of changes to these fields.

### Suggested Fix

Incrementally replace `v.any()` with precise validators where the shape is known. Start with high-traffic fields:
1. `messages.toolCalls` -- define a proper tool call validator.
2. `entities.data` -- this is inherently dynamic, but can be wrapped in a runtime validation layer.
3. `events.payload` -- define per-event-type payload schemas.
4. `triggers.condition` and `triggers.actions[].args` -- these have known shapes that can be typed.

For `as any` casts, audit each usage and replace with proper type assertions or generic type parameters.

---

## Summary Table

| ID | Item | Priority | Effort | Area |
|----|------|----------|--------|------|
| TD-001 | Credits can go negative | P0 | M | Billing |
| TD-002 | No test coverage | P0 | XL | All |
| TD-003 | Unbounded messages/events tables | P1 | L | Backend schema |
| TD-004 | No debounce on file watcher | RESOLVED | S | CLI |
| TD-005 | Hardcoded Convex URL in 6 files | RESOLVED | S | CLI |
| TD-006 | Virtual module source drift | P2 | M | SDK/CLI |
| TD-007 | use-convex-data.ts monolith | P2 | M | Dashboard |
| TD-008 | Excessive v.any() and as-any | P3 | L | Backend + Dashboard |
