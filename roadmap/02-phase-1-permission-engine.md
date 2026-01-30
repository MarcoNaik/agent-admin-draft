# Phase 1: Permission Engine Core

## Document Purpose

This document details the implementation of the core permission engine—the foundation that all subsequent phases depend on. By the end of this phase, we will have a working permission system that can evaluate policies, apply scope rules, and filter fields.

**Status**: 🔄 Ready for Implementation

**Dependencies**: Phase 0 (all decisions locked)

**Estimated Scope**: Core library (~500 lines), integration points (~200 lines), tests (~400 lines)

---

## Context: Why This Phase Exists

### The Current State

The Struere codebase has six tables related to permissions:

| Table | Purpose | Current Usage |
|-------|---------|---------------|
| `roles` | Define roles per organization | CRUD operations only |
| `policies` | Define what roles can do | Stored but never evaluated |
| `scopeRules` | Row-level filtering rules | Defined but never applied |
| `fieldMasks` | Column-level whitelists | Defined but never applied |
| `toolPermissions` | Per-tool authorization | Never consulted |
| `userRoles` | Assign roles to users | Stored but never used |

These tables exist because someone anticipated the need for permissions. But no code actually reads these tables to make authorization decisions. Every query returns all data for the organization, regardless of who is asking.

### The Problem This Creates

Without enforcement, the permission tables are "decorative security"—they give the appearance of access control without providing it.

**Example of current behavior:**

```typescript
// Teacher queries sessions
const sessions = await ctx.db.query("entities")
  .withIndex("by_org", q => q.eq("organizationId", orgId))
  .filter(q => q.eq(q.field("entityTypeId"), sessionTypeId))
  .collect()

// Returns ALL sessions in the org, including:
// - Other teachers' sessions
// - Payment amounts
// - Parent phone numbers
// - Internal notes
```

**Example of required behavior:**

```typescript
// Teacher queries sessions
const sessions = await queryAsActor(actor, "session", {})

// Returns only:
// - Sessions where teacherId == actor.userId (scope rule)
// - Only allowed fields: id, studentName, startTime, status, meetingLink (field mask)
// - Not: paymentAmount, guardianPhone, internalNotes
```

### Why This Must Be Phase 1

The permission engine is not a feature—it's a security boundary. Everything that accesses data must go through it:

- Entity queries → permission engine
- Entity mutations → permission engine
- Template compilation → permission engine
- Tool execution → permission engine
- Dashboard queries → permission engine

If we build features before the permission engine, we either:
1. Build them insecurely (and must retrofit later)
2. Block on permissions for every feature

Building the engine first means all subsequent work is automatically secure.

---

## Goals

By the end of Phase 1:

1. **ActorContext can be built** for any request (HTTP, dashboard, job, webhook)
2. **Policies can be evaluated** to check if an action is allowed
3. **Scope rules can be applied** to filter queries by row
4. **Field masks can be applied** to filter results by column
5. **One entity operation is secured** as proof of concept

### What "Secured" Means

An operation is secured when:
- Unauthorized attempts are rejected (not just filtered)
- Authorized attempts return only allowed data
- All checks are enforced in the backend (not UI)
- Bypass is not possible through API

---

## Non-Goals for This Phase

1. **Securing all operations** - We secure one operation (entity.query) as proof of concept. Phase 2 secures everything.

2. **Optimizing performance** - The initial implementation prioritizes correctness. Optimization comes after validation.

3. **UI integration** - The dashboard continues to work as before. Permission-aware UI comes in Phase 6.

4. **Tool permissions** - Tool-level authorization comes in Phase 3.

5. **Relation scope patterns** - V1 implements field_match only. Relation patterns come later.

---

## Implementation Plan

### Step 1: Create Permission Types

**File**: `platform/convex/lib/permissions/types.ts`

Define the type system for permissions:

```typescript
import { Id } from "../_generated/dataModel"

export type Action = "create" | "read" | "update" | "delete" | "list"

export type ActorType = "user" | "agent" | "system" | "webhook"

export interface ActorContext {
  organizationId: Id<"organizations">
  actorType: ActorType
  actorId: string
  roleIds: Id<"roles">[]
}

export interface PermissionResult {
  allowed: boolean
  reason?: string
  matchedPolicy?: Id<"policies">
  evaluatedPolicies?: number
}

export class PermissionError extends Error {
  constructor(
    public readonly reason: string,
    public readonly actor: ActorContext,
    public readonly action: Action,
    public readonly resource: string
  ) {
    super(`Permission denied: ${reason}`)
    this.name = "PermissionError"
  }
}

export interface ScopeFilter {
  field: string
  operator: "eq" | "neq" | "in" | "contains"
  value: unknown
}

export interface FieldMaskResult {
  allowedFields: string[]
  isWildcard: boolean
}
```

**Why these types?**

- `Action`: The five verbs we check (from Phase 0 decision)
- `ActorContext`: Who is performing the action (eager resolution)
- `PermissionResult`: Rich result for logging/debugging
- `PermissionError`: Typed exception for permission denials
- `ScopeFilter`: Compiled scope rule for query filtering
- `FieldMaskResult`: Resolved field mask for a role/entity combination

### Step 2: Implement ActorContext Builder

**File**: `platform/convex/lib/permissions/context.ts`

```typescript
import { QueryCtx, MutationCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import { ActorContext, ActorType } from "./types"

export async function buildActorContext(
  ctx: QueryCtx | MutationCtx,
  options: {
    organizationId: Id<"organizations">
    actorType: ActorType
    actorId: string
  }
): Promise<ActorContext> {
  const { organizationId, actorType, actorId } = options

  let roleIds: Id<"roles">[] = []

  if (actorType === "user") {
    const userRoles = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", actorId as Id<"users">))
      .filter((q) =>
        q.and(
          q.eq(q.field("organizationId"), organizationId),
          q.or(
            q.eq(q.field("expiresAt"), undefined),
            q.gt(q.field("expiresAt"), Date.now())
          )
        )
      )
      .collect()

    roleIds = userRoles.map((ur) => ur.roleId)
  } else if (actorType === "system") {
    const systemRole = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.eq(q.field("isSystem"), true))
      .first()

    if (systemRole) {
      roleIds = [systemRole._id]
    }
  }

  return {
    organizationId,
    actorType,
    actorId,
    roleIds,
  }
}

export function buildSystemActorContext(
  organizationId: Id<"organizations">
): ActorContext {
  return {
    organizationId,
    actorType: "system",
    actorId: "system",
    roleIds: [],
  }
}
```

**Why this implementation?**

1. **User actors**: Look up assigned roles from `userRoles` table, filtering expired assignments
2. **System actors**: Find the system role for the organization
3. **Agent/webhook actors**: Currently get no roles (inherit from API key permissions later)

**Important**: The role lookup happens ONCE when building context, not on every permission check. This is the "eager resolution" from Phase 0.

### Step 3: Implement Policy Evaluation

**File**: `platform/convex/lib/permissions/evaluate.ts`

```typescript
import { QueryCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import { ActorContext, Action, PermissionResult, PermissionError } from "./types"

export async function canPerform(
  ctx: QueryCtx,
  actor: ActorContext,
  action: Action,
  resource: string,
  record?: Record<string, unknown>
): Promise<PermissionResult> {
  if (actor.roleIds.length === 0) {
    if (actor.actorType === "system") {
      return { allowed: true, reason: "System actor has implicit access" }
    }
    return {
      allowed: false,
      reason: "Actor has no roles assigned",
      evaluatedPolicies: 0,
    }
  }

  const policies = await ctx.db
    .query("policies")
    .withIndex("by_org", (q) => q.eq("organizationId", actor.organizationId))
    .collect()

  const applicablePolicies = policies.filter(
    (p) =>
      actor.roleIds.includes(p.roleId) &&
      (p.resource === resource || p.resource === "*") &&
      (p.action === action || p.action === "*")
  )

  let hasAllow = false
  let allowPolicy: Id<"policies"> | undefined

  for (const policy of applicablePolicies) {
    if (policy.effect === "deny") {
      return {
        allowed: false,
        reason: `Denied by policy: ${policy.name || policy._id}`,
        matchedPolicy: policy._id,
        evaluatedPolicies: applicablePolicies.length,
      }
    }
    if (policy.effect === "allow") {
      hasAllow = true
      allowPolicy = policy._id
    }
  }

  if (hasAllow) {
    return {
      allowed: true,
      matchedPolicy: allowPolicy,
      evaluatedPolicies: applicablePolicies.length,
    }
  }

  return {
    allowed: false,
    reason: `No policy grants ${action} on ${resource}`,
    evaluatedPolicies: applicablePolicies.length,
  }
}

export async function assertCanPerform(
  ctx: QueryCtx,
  actor: ActorContext,
  action: Action,
  resource: string,
  record?: Record<string, unknown>
): Promise<void> {
  const result = await canPerform(ctx, actor, action, resource, record)
  if (!result.allowed) {
    throw new PermissionError(result.reason || "Permission denied", actor, action, resource)
  }
}
```

**Why this implementation?**

1. **No roles = denied** (except system actor, which has implicit access)
2. **Fetch all policies** for the organization (will optimize later with indexes)
3. **Filter to applicable** policies based on role, resource, action
4. **Deny overrides allow**: First deny found = immediately return denied
5. **At least one allow required**: No allows = denied

**The `record` parameter** is for future use when scope rules need to check record values. In V1, we don't use it for policy evaluation (only for scope rules).

### Step 4: Implement Scope Rule Application

**File**: `platform/convex/lib/permissions/scope.ts`

```typescript
import { QueryCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import { ActorContext, ScopeFilter } from "./types"

export async function getScopeFilters(
  ctx: QueryCtx,
  actor: ActorContext,
  entityTypeSlug: string
): Promise<ScopeFilter[]> {
  if (actor.actorType === "system") {
    return []
  }

  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", actor.organizationId).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) {
    return []
  }

  const scopeRules = await ctx.db
    .query("scopeRules")
    .withIndex("by_org", (q) => q.eq("organizationId", actor.organizationId))
    .filter((q) =>
      q.and(
        q.eq(q.field("entityTypeId"), entityType._id),
        q.or(
          ...actor.roleIds.map((roleId) => q.eq(q.field("roleId"), roleId))
        )
      )
    )
    .collect()

  const filters: ScopeFilter[] = []

  for (const rule of scopeRules) {
    if (rule.type === "field_match") {
      let value: unknown

      if (rule.valuePath === "actor.userId") {
        value = actor.actorId
      } else if (rule.valuePath === "actor.organizationId") {
        value = actor.organizationId
      } else if (rule.valuePath?.startsWith("literal:")) {
        value = rule.valuePath.slice(8)
      } else {
        value = rule.value
      }

      filters.push({
        field: rule.fieldPath,
        operator: rule.operator as ScopeFilter["operator"],
        value,
      })
    }
  }

  return filters
}

export function applyScopeFiltersToQuery<T extends Record<string, unknown>>(
  records: T[],
  filters: ScopeFilter[]
): T[] {
  if (filters.length === 0) {
    return records
  }

  return records.filter((record) => {
    return filters.every((filter) => {
      const fieldValue = getNestedValue(record, filter.field)

      switch (filter.operator) {
        case "eq":
          return fieldValue === filter.value
        case "neq":
          return fieldValue !== filter.value
        case "in":
          return Array.isArray(filter.value) && filter.value.includes(fieldValue)
        case "contains":
          return (
            typeof fieldValue === "string" &&
            typeof filter.value === "string" &&
            fieldValue.includes(filter.value)
          )
        default:
          return false
      }
    })
  })
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}
```

**Why this implementation?**

1. **System actors bypass scope**: They see everything in their org
2. **Look up scope rules** for the actor's roles and entity type
3. **Resolve value paths**: `actor.userId` → actual user ID, `literal:value` → literal value
4. **Return filters** that can be applied to query results

**Why filter in memory instead of in query?**

Convex doesn't support dynamic query construction with arbitrary field names. We fetch records and filter in memory. This is acceptable for V1 because:
- Entity lists are typically small (hundreds, not millions)
- Convex indexes already filter by org and type
- We can optimize with custom indexes later

### Step 5: Implement Field Masking

**File**: `platform/convex/lib/permissions/mask.ts`

```typescript
import { QueryCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import { ActorContext, FieldMaskResult } from "./types"

export async function getFieldMask(
  ctx: QueryCtx,
  actor: ActorContext,
  entityTypeSlug: string
): Promise<FieldMaskResult> {
  if (actor.actorType === "system") {
    return { allowedFields: [], isWildcard: true }
  }

  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", actor.organizationId).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) {
    return { allowedFields: [], isWildcard: false }
  }

  const masks = await ctx.db
    .query("fieldMasks")
    .withIndex("by_org", (q) => q.eq("organizationId", actor.organizationId))
    .filter((q) =>
      q.and(
        q.eq(q.field("entityTypeId"), entityType._id),
        q.or(
          ...actor.roleIds.map((roleId) => q.eq(q.field("roleId"), roleId))
        )
      )
    )
    .collect()

  if (masks.length === 0) {
    return { allowedFields: [], isWildcard: false }
  }

  const allAllowedFields = new Set<string>()
  let hasWildcard = false

  for (const mask of masks) {
    if (mask.mode === "whitelist") {
      for (const field of mask.fields) {
        if (field === "*") {
          hasWildcard = true
        } else {
          allAllowedFields.add(field)
        }
      }
    }
  }

  return {
    allowedFields: Array.from(allAllowedFields),
    isWildcard: hasWildcard,
  }
}

export function applyFieldMask<T extends Record<string, unknown>>(
  record: T,
  mask: FieldMaskResult
): Partial<T> {
  if (mask.isWildcard) {
    return record
  }

  if (mask.allowedFields.length === 0) {
    return {}
  }

  const result: Record<string, unknown> = {}

  for (const field of mask.allowedFields) {
    if (field.includes(".")) {
      setNestedValue(result, field, getNestedValue(record, field))
    } else if (field in record) {
      result[field] = record[field]
    }
  }

  result._id = record._id
  result._creationTime = record._creationTime

  return result as Partial<T>
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".")
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) {
      current[parts[i]] = {}
    }
    current = current[parts[i]] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}
```

**Why this implementation?**

1. **System actors see everything**: Return wildcard mask
2. **No mask = no access**: If no field masks are defined for the role, return empty
3. **Union of masks**: If actor has multiple roles, they see union of allowed fields
4. **Always include `_id` and `_creationTime`**: These are system fields needed for updates/references
5. **Support nested fields**: `data.address.city` works correctly

**Why union of masks?**

A user might have both "teacher" and "admin" roles. They should see everything both roles allow. This is the principle of least surprise—adding a role should never reduce access.

### Step 6: Create Main Permission Module

**File**: `platform/convex/lib/permissions/index.ts`

```typescript
export { ActorContext, Action, PermissionResult, PermissionError, ScopeFilter, FieldMaskResult } from "./types"
export { buildActorContext, buildSystemActorContext } from "./context"
export { canPerform, assertCanPerform } from "./evaluate"
export { getScopeFilters, applyScopeFiltersToQuery } from "./scope"
export { getFieldMask, applyFieldMask } from "./mask"

import { QueryCtx, MutationCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import { ActorContext, Action, PermissionResult } from "./types"
import { canPerform, assertCanPerform } from "./evaluate"
import { getScopeFilters, applyScopeFiltersToQuery } from "./scope"
import { getFieldMask, applyFieldMask } from "./mask"

export async function queryEntitiesAsActor<T extends Record<string, unknown>>(
  ctx: QueryCtx,
  actor: ActorContext,
  entityTypeSlug: string
): Promise<Partial<T>[]> {
  const permission = await canPerform(ctx, actor, "list", entityTypeSlug)
  if (!permission.allowed) {
    return []
  }

  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", actor.organizationId).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) {
    return []
  }

  const entities = await ctx.db
    .query("entities")
    .withIndex("by_org", (q) => q.eq("organizationId", actor.organizationId))
    .filter((q) => q.eq(q.field("entityTypeId"), entityType._id))
    .collect()

  const scopeFilters = await getScopeFilters(ctx, actor, entityTypeSlug)
  const scopedEntities = applyScopeFiltersToQuery(entities as T[], scopeFilters)

  const fieldMask = await getFieldMask(ctx, actor, entityTypeSlug)
  const maskedEntities = scopedEntities.map((e) => applyFieldMask(e, fieldMask))

  return maskedEntities
}

export async function getEntityAsActor<T extends Record<string, unknown>>(
  ctx: QueryCtx,
  actor: ActorContext,
  entityTypeSlug: string,
  entityId: Id<"entities">
): Promise<Partial<T> | null> {
  const entity = await ctx.db.get(entityId)

  if (!entity || entity.organizationId !== actor.organizationId) {
    return null
  }

  const entityType = await ctx.db.get(entity.entityTypeId)
  if (!entityType || entityType.slug !== entityTypeSlug) {
    return null
  }

  const permission = await canPerform(ctx, actor, "read", entityTypeSlug, entity as unknown as Record<string, unknown>)
  if (!permission.allowed) {
    return null
  }

  const scopeFilters = await getScopeFilters(ctx, actor, entityTypeSlug)
  const scoped = applyScopeFiltersToQuery([entity as T], scopeFilters)
  if (scoped.length === 0) {
    return null
  }

  const fieldMask = await getFieldMask(ctx, actor, entityTypeSlug)
  return applyFieldMask(scoped[0], fieldMask)
}
```

**Why this high-level API?**

These functions (`queryEntitiesAsActor`, `getEntityAsActor`) are what most code will call. They encapsulate:
1. Permission check (can you do this action?)
2. Scope filtering (which records can you see?)
3. Field masking (which fields can you see?)

Lower-level functions are exported for cases that need fine-grained control.

### Step 7: Add Integration Point (Proof of Concept)

**File**: Modify `platform/convex/entities.ts` to add a secure query

```typescript
import { query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthContext } from "./lib/auth"
import { buildActorContext, queryEntitiesAsActor } from "./lib/permissions"

export const listSecure = query({
  args: {
    entityTypeSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    return await queryEntitiesAsActor(ctx, actor, args.entityTypeSlug)
  },
})
```

**Why a new query instead of modifying existing?**

1. **No breaking changes**: Existing code continues to work
2. **Easy comparison**: Can test secure vs insecure side-by-side
3. **Gradual migration**: Dashboard can switch to secure queries incrementally

---

## Testing Strategy

### Unit Tests

**File**: `platform/convex/lib/permissions/__tests__/evaluate.test.ts`

Test cases for policy evaluation:

1. **No roles = denied**
   - Actor with empty roleIds
   - Expected: denied

2. **System actor = allowed**
   - Actor with actorType "system"
   - Expected: allowed regardless of policies

3. **Matching allow policy = allowed**
   - Actor with role that has allow policy for resource/action
   - Expected: allowed

4. **Matching deny policy = denied**
   - Actor with role that has deny policy
   - Expected: denied

5. **Deny overrides allow**
   - Actor with two roles: one allows, one denies
   - Expected: denied

6. **Wildcard resource policy**
   - Policy with resource "*"
   - Expected: matches any resource

7. **Wildcard action policy**
   - Policy with action "*"
   - Expected: matches any action

### Integration Tests

**File**: `platform/convex/lib/permissions/__tests__/integration.test.ts`

Test end-to-end flows:

1. **Teacher can list own sessions**
   - Create teacher, sessions, scope rule
   - Query as teacher
   - Expected: only teacher's sessions returned

2. **Teacher cannot see payment fields**
   - Create teacher with field mask excluding payment
   - Query session with payment amount
   - Expected: payment field not in result

3. **Admin sees everything**
   - Create admin with wildcard mask
   - Query any entity
   - Expected: all fields visible

4. **Cross-org access denied**
   - Create entity in org A
   - Query from org B actor
   - Expected: empty result (not error)

### Manual Testing Checklist

- [ ] Create a teacher role with policies for session:list, session:read
- [ ] Create scope rule: session.teacherId == actor.userId
- [ ] Create field mask: teacher can see [id, studentName, startTime, status]
- [ ] Assign teacher role to a user
- [ ] Query sessions as that user via `listSecure`
- [ ] Verify only own sessions returned
- [ ] Verify only allowed fields present
- [ ] Verify paymentAmount, guardianPhone not present

---

## Success Criteria

Phase 1 is complete when:

1. ✅ `buildActorContext()` correctly builds context for all actor types
2. ✅ `canPerform()` correctly evaluates policies (deny overrides allow)
3. ✅ `getScopeFilters()` returns correct filters based on scope rules
4. ✅ `applyFieldMask()` correctly filters fields (allowlist)
5. ✅ `queryEntitiesAsActor()` combines all of the above
6. ✅ `entities.listSecure` query works in Convex dashboard
7. ✅ Unit tests pass for all permission functions
8. ✅ Integration test demonstrates teacher seeing only their sessions

---

## Files Created/Modified

### New Files

| Path | Purpose |
|------|---------|
| `platform/convex/lib/permissions/types.ts` | Type definitions |
| `platform/convex/lib/permissions/context.ts` | ActorContext builder |
| `platform/convex/lib/permissions/evaluate.ts` | Policy evaluation |
| `platform/convex/lib/permissions/scope.ts` | Scope rule application |
| `platform/convex/lib/permissions/mask.ts` | Field mask application |
| `platform/convex/lib/permissions/index.ts` | Module exports + high-level API |

### Modified Files

| Path | Change |
|------|--------|
| `platform/convex/entities.ts` | Add `listSecure` query |

---

## Known Limitations (To Address Later)

1. **No query optimization**: Fetches all entities then filters in memory. Acceptable for small datasets.

2. **No caching**: Policies/masks fetched on every request. Can cache in later optimization pass.

3. **No relation scope patterns**: Only field_match implemented. Relation patterns come in Phase 4.

4. **No audit logging**: Permission checks not logged. Add in Phase 2.

---

## What's Next: Phase 2

Phase 2 applies the permission engine to ALL entity operations:

- `entities.list` → becomes permission-aware
- `entities.get` → becomes permission-aware
- `entities.create` → requires permission check
- `entities.update` → requires permission check + field mask on input
- `entities.delete` → requires permission check

Phase 2 also secures `entityTypes`, `events`, and other entity-adjacent operations.

See [03-phase-2-entity-integration.md](./03-phase-2-entity-integration.md) for details.
