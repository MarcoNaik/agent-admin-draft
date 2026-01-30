# Phase 0: Foundation Decisions

## Document Purpose

This document records all foundational architectural decisions that must be locked before implementation begins. These decisions affect every subsequent phase and cannot be easily changed later.

**Status**: ✅ Complete (all decisions locked)

---

## Context: Why We Need This Phase

### The Problem with Implicit Decisions

When building complex systems, teams often make decisions implicitly—choosing an approach without documenting why, what alternatives existed, or what trade-offs were accepted. This causes problems:

1. **Inconsistent implementation**: Different team members make different choices
2. **Repeated debates**: The same questions come up repeatedly
3. **Difficult onboarding**: New contributors don't understand the "why"
4. **Risky refactoring**: Changes break assumptions that were never documented

### What This Phase Accomplishes

By explicitly documenting decisions before coding:

1. **Alignment**: Everyone knows the chosen approach
2. **Speed**: No debates during implementation
3. **Quality**: Edge cases are considered upfront
4. **Maintainability**: Future contributors understand the rationale

---

## Decision 1: ActorContext Structure

### What Is ActorContext?

ActorContext is the identity object that represents "who is performing this action" at runtime. Every permission check, data query, and mutation must know the actor to enforce access control.

### The Question

How should ActorContext be structured, and when should role/permission data be resolved?

### Options Considered

**Option A: Minimal Context (Lazy Resolution)**
```typescript
interface ActorContext {
  organizationId: Id<"organizations">
  actorType: "user" | "agent" | "system" | "webhook"
  actorId: string
}
// Roles fetched on every permission check
```

Pros:
- Lightweight context creation
- Always uses latest role assignments

Cons:
- Multiple DB queries per request (one per permission check)
- Slower overall request handling
- Cache invalidation complexity

**Option B: Full Context (Eager Resolution)**
```typescript
interface ActorContext {
  organizationId: Id<"organizations">
  actorType: "user" | "agent" | "system" | "webhook"
  actorId: string
  roleIds: Id<"roles">[]
  // Optional: flattened permissions cache
}
// Roles resolved once at context creation
```

Pros:
- Single DB query at request start
- Fast permission checks (no additional queries)
- Predictable performance

Cons:
- Heavier context creation
- Stale data if roles change mid-request (acceptable)

### Decision: Option B (Eager Resolution)

**Rationale**:
- A single request typically performs 5-20 permission checks (query entities, check tool permissions, apply field masks)
- Lazy resolution would mean 5-20 additional DB queries
- Role changes mid-request are extremely rare and acceptable to ignore
- Convex's real-time nature means the next request will have updated roles

### Final Type Definition

```typescript
interface ActorContext {
  organizationId: Id<"organizations">
  actorType: "user" | "agent" | "system" | "webhook"
  actorId: string
  roleIds: Id<"roles">[]
}
```

### Implementation Notes

- `buildActorContext(ctx)` is called once per request entry point
- For HTTP endpoints: after API key validation
- For dashboard queries: using Clerk auth context
- For jobs: stored at enqueue time, restored at execution
- For webhooks: system actor with no roles (or specific webhook role)

---

## Decision 2: Field Mask Strategy

### What Are Field Masks?

Field masks control which fields of an entity a specific role can see. They implement column-level security on top of row-level security (scope rules).

### The Question

Should field masks be allowlists (whitelist) or denylists (blacklist)?

### Options Considered

**Option A: Denylist (Blacklist)**
```typescript
{
  roleId: "teacher",
  entityTypeSlug: "session",
  deniedFields: ["paymentAmount", "guardianPhone", "internalNotes"]
  // Everything else is visible
}
```

Pros:
- Shorter definitions when most fields are allowed
- Easier to add new "public" fields

Cons:
- **Dangerous under schema evolution**: New fields are visible by default
- Requires updating masks when adding sensitive fields
- Easy to forget and leak data

**Option B: Allowlist (Whitelist)**
```typescript
{
  roleId: "teacher",
  entityTypeSlug: "session",
  allowedFields: ["id", "studentName", "startTime", "duration", "status", "meetingLink"]
  // Everything else is hidden
}
```

Pros:
- **Safe under schema evolution**: New fields are hidden by default
- Explicit about what's visible
- No accidental data exposure

Cons:
- Longer definitions
- Must update when adding new "public" fields
- More verbose

### Decision: Option B (Allowlist)

**Rationale**:
- Security should fail safe, not fail open
- When a developer adds `guardianPhone` to the Session schema, it should NOT appear to teachers automatically
- The verbosity cost is acceptable for the security benefit
- Pack definitions naturally enumerate the "public" fields anyway

### Implementation Notes

- Field masks are defined per (role, entityType) pair
- If no field mask exists for a role, that role sees NO fields (fail safe)
- Admin roles typically have a wildcard mask: `allowedFields: ["*"]`
- Nested fields use dot notation: `"data.address.city"`

### Example: Tutoring Session Field Masks

```typescript
// Admin sees everything
{ roleId: "admin", entityTypeSlug: "session", allowedFields: ["*"] }

// Teacher sees operational fields only
{ roleId: "teacher", entityTypeSlug: "session", allowedFields: [
  "id", "studentId", "startTime", "duration", "status", "meetingLink", "reportSubmitted"
]}

// Guardian sees their child's session info
{ roleId: "guardian", entityTypeSlug: "session", allowedFields: [
  "id", "teacherName", "startTime", "duration", "status", "meetingLink"
]}
```

---

## Decision 3: Permission Check Return Type

### What Is the Permission Check API?

The permission check API is how code asks "can this actor do this action on this resource?" The API design affects how callers handle permission denials.

### The Question

What should `canPerform()` return?

### Options Considered

**Option A: Boolean Only**
```typescript
function canPerform(actor: ActorContext, action: string, resource: string): boolean

// Usage
if (!canPerform(actor, "entity.create", "session")) {
  throw new Error("Permission denied")
}
```

Pros:
- Simple API
- Easy to use in conditionals

Cons:
- No information about WHY permission was denied
- Harder to debug
- No audit trail detail

**Option B: Result Object Only**
```typescript
interface PermissionResult {
  allowed: boolean
  reason?: string  // e.g., "No policy grants session:create for role teacher"
  matchedPolicy?: Id<"policies">
}

function canPerform(...): PermissionResult

// Usage
const result = canPerform(actor, "entity.create", "session")
if (!result.allowed) {
  log.warn("Permission denied", { reason: result.reason })
  throw new PermissionError(result.reason)
}
```

Pros:
- Rich debugging information
- Better audit trails
- Can log specific denial reasons

Cons:
- More verbose at call sites
- Callers might forget to check `.allowed`

**Option C: Both (Result + Assert Helper)**
```typescript
function canPerform(...): PermissionResult
function assertCanPerform(...): void  // throws PermissionError if denied

// Usage in mutations (fast-fail)
assertCanPerform(actor, "entity.create", "session")
// If we reach here, permission was granted

// Usage in logging/conditional paths
const result = canPerform(actor, "entity.read", "payment")
if (!result.allowed) {
  telemetry.record("permission_denied", { reason: result.reason })
}
```

Pros:
- Best of both worlds
- Mutations use simple assert pattern
- Logging/telemetry use detailed result
- Consistent underlying implementation

Cons:
- Two functions to maintain (minimal overhead)

### Decision: Option C (Both)

**Rationale**:
- Mutations are the common case and benefit from fast-fail
- Debugging and telemetry need the detailed result
- The two functions share implementation, so there's no duplication

### Final API

```typescript
interface PermissionResult {
  allowed: boolean
  reason?: string
  matchedPolicy?: Id<"policies">
  evaluatedPolicies?: number
}

function canPerform(
  actor: ActorContext,
  action: Action,
  resource: string,
  record?: Record<string, unknown>
): PermissionResult

function assertCanPerform(
  actor: ActorContext,
  action: Action,
  resource: string,
  record?: Record<string, unknown>
): void  // throws PermissionError

class PermissionError extends Error {
  constructor(
    public readonly reason: string,
    public readonly actor: ActorContext,
    public readonly action: Action,
    public readonly resource: string
  ) {
    super(`Permission denied: ${reason}`)
  }
}
```

---

## Decision 4: Action Granularity

### What Are Actions?

Actions are the verbs in permission checks: "can actor X do action Y on resource Z?" The granularity of actions affects both security and usability.

### The Question

What actions should the permission system support?

### Options Considered

**Option A: CRUD Only**
```typescript
type Action = "create" | "read" | "update" | "delete"
```

Pros:
- Simple, familiar
- Covers most cases

Cons:
- Can't distinguish "list all" from "read one"
- Can't express "can view but not download"

**Option B: Fine-Grained**
```typescript
type Action =
  | "create"
  | "read"
  | "read_sensitive"
  | "update"
  | "update_status"
  | "delete"
  | "delete_permanent"
  | "list"
  | "search"
  | "export"
  | ...
```

Pros:
- Very precise control
- Can model complex requirements

Cons:
- Explosion of combinations
- Hard to manage policies
- Over-engineering for most cases

**Option C: CRUD + List (Pragmatic)**
```typescript
type Action = "create" | "read" | "update" | "delete" | "list"
```

Pros:
- Covers the important distinction (single item vs collection)
- Not over-engineered
- Familiar pattern

Cons:
- Can't express very fine distinctions

### Decision: Option C (CRUD + List)

**Rationale**:
- The distinction between "read one item" and "list items" is important
- Reading a single session you're authorized for is different from listing all sessions
- More granular actions can be added later if needed
- Field masks handle the "sensitive fields" case, not action types

### Final Type

```typescript
type Action = "create" | "read" | "update" | "delete" | "list"
```

### Usage Examples

```typescript
// Can this teacher create a session?
canPerform(actor, "create", "session")

// Can this teacher view this specific session?
canPerform(actor, "read", "session", session)

// Can this teacher see a list of sessions?
canPerform(actor, "list", "session")

// Can this admin delete this session?
canPerform(actor, "delete", "session", session)
```

---

## Decision 5: Scope Rule Types

### What Are Scope Rules?

Scope rules implement row-level security. They answer: "which records of this type can this role access?" For example: "teachers can only see sessions where they are the assigned teacher."

### The Question

What types of scope rules should V1 support?

### Options Considered

**Option A: Field Match Only**
```typescript
{
  type: "field_match",
  field: "teacherId",
  operator: "eq",
  valueSource: "actor.userId"  // or literal value
}
// session.teacherId == actor.userId
```

Pros:
- Simple to implement
- Fast to evaluate
- Covers many cases

Cons:
- Can't express relation-based access
- Can't express complex conditions

**Option B: Full Query Builder**
```typescript
{
  type: "query",
  where: {
    or: [
      { field: "teacherId", eq: "actor.userId" },
      { field: "status", eq: "public" },
      { relation: "student", through: "sessions", where: {...} }
    ]
  }
}
```

Pros:
- Can express any condition
- Very flexible

Cons:
- Complex to implement correctly
- Security risks from dynamic queries
- Performance unpredictable
- Hard to audit

**Option C: Field Match + Limited Relations**
```typescript
// Field match (simple)
{ type: "field_match", field: "teacherId", operator: "eq", valueSource: "actor.userId" }

// Relation (predefined patterns only)
{ type: "relation", pattern: "teacher_sessions" }
// Pattern is code-defined, not user-defined
```

Pros:
- Covers common cases
- Relations are safe because patterns are predefined
- No arbitrary query construction
- Can add patterns as needed

Cons:
- New relation patterns require code changes
- Less flexible than full query builder

### Decision: Option C (Field Match + Limited Relations)

**Rationale**:
- Field match covers 80% of cases
- Relation patterns can be added as packs need them
- Full query builder is a security and performance risk
- "Code-defined patterns" means we control the complexity

### V1 Scope Rule Types

```typescript
type ScopeRule = FieldMatchRule | RelationRule

interface FieldMatchRule {
  type: "field_match"
  field: string              // e.g., "teacherId"
  operator: "eq" | "neq" | "in" | "contains"
  valueSource: string        // e.g., "actor.userId" or literal
}

interface RelationRule {
  type: "relation"
  pattern: string            // e.g., "teacher_sessions", "guardian_students"
  // Pattern implementation is in code, not in the rule
}
```

### Relation Patterns for Tutoring

```typescript
// Defined in platform/convex/lib/scopePatterns.ts
const scopePatterns = {
  // Teacher sees sessions where they are the teacher
  "teacher_sessions": (actor: ActorContext) => ({
    field: "teacherId",
    operator: "eq",
    value: actor.actorId
  }),

  // Guardian sees students linked to them
  "guardian_students": async (actor: ActorContext, ctx: QueryCtx) => {
    // Fetch guardian's linked student IDs
    const links = await ctx.db.query("entityRelations")
      .filter(q => q.and(
        q.eq(q.field("fromEntityId"), actor.actorId),
        q.eq(q.field("relationType"), "guardian_of")
      ))
      .collect()
    return { field: "id", operator: "in", value: links.map(l => l.toEntityId) }
  }
}
```

---

## Decision 6: Tool Identity Modes

### What Are Tool Identity Modes?

When an agent executes a tool, the tool runs under some identity. The identity mode determines whose permissions apply to the tool's data access.

### The Question

What identity modes should tools support, and what should the default be?

### Options Considered

**Option A: Always Inherit**
All tools run as the actor who triggered the conversation.

Pros:
- Simple model
- No privilege escalation

Cons:
- Some tools legitimately need elevated access
- Jobs would fail if original actor lacks permissions

**Option B: Always System**
All tools run with system (admin-level) permissions.

Pros:
- Tools always succeed
- Simple model

Cons:
- No security benefit from permissions
- Data leaks through tools
- Defeats the purpose

**Option C: Configurable Per Tool**
```typescript
identityMode: "inherit" | "system" | "configured"
// inherit: run as triggering actor
// system: run with system permissions
// configured: run as specific role
```

Pros:
- Maximum flexibility
- Can secure most tools while elevating specific ones
- Audit trail shows which mode was used

Cons:
- More complex
- Risk of over-using system mode

### Decision: Option C with Inherit as Default

**Rationale**:
- Most tools should run as the actor (inherit) - this is the safe default
- System mode is needed for scheduled jobs and webhooks
- Configured mode allows specific use cases (e.g., "this tool always runs as if it were an admin")

### Default and Exceptions

**Default**: `inherit` - tool runs as the actor who triggered the conversation

**System mode** (must be explicitly configured):
- Job execution (no user context, triggered by scheduler)
- Webhook handlers (external system, not authenticated user)
- Specific internal tools that need cross-actor access

**Configured mode** (rare):
- A tool that always needs admin access regardless of caller
- Must be documented and justified

### Important Constraint

Even in `system` mode, tools are still scoped to `organizationId`. System mode means "all roles within this org," not "all data across all orgs."

```typescript
// System mode still enforces org boundary
const sessions = await queryAsActor(
  { ...actor, roleIds: ["system"] },  // Elevated permissions
  "session"
)
// Still filtered by actor.organizationId
```

---

## Decision 7: Template Compilation Security Model

### What Is Template Compilation?

Template compilation is the process of converting a system prompt template into the final prompt string sent to the LLM. Templates can include dynamic data:

```
You are helping {{org.name}}.
Today's sessions: {{entity.query({ type: "session" })}}
```

### The Question

Should template compilation have access to all data, or should it respect permissions?

### Options Considered

**Option A: Privileged Access**
Templates can access any data regardless of actor permissions.

Pros:
- Simple implementation
- Templates always work

Cons:
- **Major security hole**: Any data can leak into prompts
- Bypasses all permission work
- LLM sees data the user shouldn't see

**Option B: Permission-Aware**
Templates use the same permission-aware data layer as tools and dashboard.

Pros:
- Consistent security model
- No privileged data paths
- LLM only sees what actor can see

Cons:
- More complex implementation
- Templates might fail if actor lacks access
- Must handle permission errors in prompts

### Decision: Option B (Permission-Aware)

**Rationale**:
- If templates bypass permissions, everything else is pointless
- The LLM is the ultimate data consumer—if it sees data, it can output it
- A teacher's agent conversation should not include payment amounts in the prompt
- The extra implementation complexity is mandatory, not optional

### Implementation Approach

Template functions do NOT get special access. They call the same data layer:

```typescript
// Inside templateEngine.ts
async function resolveFunction(name: string, args: unknown, context: TemplateContext) {
  if (name === "entity.query") {
    // Uses permission-aware query, not direct DB access
    return await queryAsActor(context.actor, args.type, args.filters)
  }
  if (name === "entity.get") {
    return await getAsActor(context.actor, args.type, args.id)
  }
}
```

### Error Handling in Templates

If a template function fails due to permissions, the template should handle it gracefully:

```typescript
// Option 1: Return empty/null for missing data
"Sessions: {{entity.query({ type: "session" }) | default: "No sessions available"}}"

// Option 2: Conditional blocks
"{{#if canView("session")}}Sessions: {{entity.query(...)}}{{/if}}"
```

The exact syntax depends on the template engine, but the principle is: permission errors are expected and must be handled, not hidden.

---

## Decision 8: Policy Evaluation Order

### What Is Policy Evaluation?

When checking if an actor can perform an action, multiple policies might apply. We need a deterministic way to decide the final result.

### The Question

How should multiple policies be combined?

### Options Considered

**Option A: First Match Wins**
Evaluate policies in order, stop at first match.

Pros:
- Simple
- Predictable

Cons:
- Order-dependent (fragile)
- Hard to reason about

**Option B: Most Specific Wins**
More specific policies override general ones.

Pros:
- Intuitive
- Matches mental model

Cons:
- "Specificity" is hard to define
- Complex implementation

**Option C: Deny Overrides Allow**
If any policy denies, the action is denied. Allow only if no denies and at least one allow.

Pros:
- Secure default
- Easy to add restrictions
- No order dependency

Cons:
- Can't override denies
- Might be too restrictive

**Option D: Priority-Based**
Each policy has a priority number. Highest priority wins.

Pros:
- Explicit control
- Can model any behavior

Cons:
- Must manage priority numbers
- Potential for conflicts

### Decision: Option C (Deny Overrides Allow)

**Rationale**:
- Security should fail safe
- If any policy says "no," the answer is "no"
- Easy to understand: "deny always wins"
- Matches common security models (AWS IAM, etc.)

### Evaluation Algorithm

```typescript
function evaluatePolicies(actor: ActorContext, action: Action, resource: string): PermissionResult {
  const policies = getPoliciesForRoles(actor.roleIds, resource, action)

  let hasAllow = false

  for (const policy of policies) {
    if (policy.effect === "deny") {
      return { allowed: false, reason: `Denied by policy ${policy.id}`, matchedPolicy: policy.id }
    }
    if (policy.effect === "allow") {
      hasAllow = true
    }
  }

  if (hasAllow) {
    return { allowed: true }
  }

  return { allowed: false, reason: "No policy grants this permission" }
}
```

### Implications

- To restrict a role, add a deny policy (it overrides any allows)
- To grant access, add an allow policy (only works if no denies)
- Default is deny (no matching policy = denied)

---

## Decision 9: Organization Boundary Enforcement

### What Is Organization Boundary?

Every piece of data in Struere belongs to exactly one organization. Users should never see data from other organizations.

### The Question

How do we ensure org boundaries are never violated, even with bugs in permission code?

### Options Considered

**Option A: Trust Permission Layer**
Organization filtering is just another scope rule.

Pros:
- Unified model

Cons:
- Bug in permission code = cross-org leak
- Single point of failure

**Option B: Defense in Depth**
Organization filtering happens at multiple layers.

Pros:
- Bugs in one layer don't cause leaks
- Defense in depth is security best practice

Cons:
- Redundant code
- Might hide bugs (silent failures)

### Decision: Option B (Defense in Depth)

**Rationale**:
- Cross-org data leaks are catastrophic
- We want multiple layers of protection
- Even if permission code has a bug, org boundary should hold

### Implementation Layers

1. **ActorContext creation**: Always includes `organizationId`
2. **Query layer**: Always adds `organizationId` filter
3. **Permission layer**: Policies are org-scoped
4. **DB indexes**: Start with `organizationId` for efficient filtering

```typescript
// Layer 1: ActorContext always has org
const actor = await buildActorContext(ctx)  // actor.organizationId is required

// Layer 2: Query layer enforces org
function queryAsActor(actor: ActorContext, entityType: string) {
  return ctx.db.query("entities")
    .withIndex("by_org", q => q.eq("organizationId", actor.organizationId))  // Always
    // ... then apply scope rules
}

// Layer 3: Policies are org-scoped
const policies = await ctx.db.query("policies")
  .withIndex("by_org_resource", q =>
    q.eq("organizationId", actor.organizationId)  // Policies only from this org
  )
```

---

## Summary: All Locked Decisions

| # | Decision | Choice | Key Rationale |
|---|----------|--------|---------------|
| 1 | ActorContext resolution | Eager | Avoid repeated DB queries |
| 2 | Field mask strategy | Allowlist | Fail safe under schema evolution |
| 3 | Permission check return | Result + Assert | Flexibility + convenience |
| 4 | Action granularity | CRUD + List | Pragmatic, extensible |
| 5 | Scope rule types | Field match + limited relation | Balance power and safety |
| 6 | Tool identity mode | Configurable, default inherit | Secure default, flexible when needed |
| 7 | Template compilation | Permission-aware | No privileged data paths |
| 8 | Policy evaluation | Deny overrides allow | Fail safe |
| 9 | Org boundary | Defense in depth | Multiple layers of protection |

---

## What's Next: Phase 1

With all decisions locked, Phase 1 implements the permission engine core:

1. `ActorContext` type and `buildActorContext()` function
2. `canPerform()` and `assertCanPerform()` functions
3. `applyFieldMask()` for column-level filtering
4. `applyScope()` for row-level filtering
5. Policy evaluation logic

Phase 1 is detailed in [02-phase-1-permission-engine.md](./02-phase-1-permission-engine.md).
