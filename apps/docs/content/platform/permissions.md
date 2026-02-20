---
title: "Permissions"
description: "Role-based access control with row and column security"
section: "Platform Concepts"
order: 2
---

# Permissions

Struere implements a comprehensive permission engine that provides role-based access control (RBAC) with row-level security (scope rules) and column-level security (field masks). Every data operation in the platform passes through this engine.

## Architecture

The permission engine lives in `platform/convex/lib/permissions/` and consists of five modules:

| Module | File | Responsibility |
|--------|------|----------------|
| Context | `context.ts` | Build ActorContext with eager role resolution |
| Evaluate | `evaluate.ts` | Policy evaluation with deny-overrides-allow |
| Scope | `scope.ts` | Row-level security via scope filters |
| Mask | `mask.ts` | Column-level security via field masks |
| Tools | `tools.ts` | Tool permission checking and identity modes |

## ActorContext

Every request begins by building an `ActorContext` that captures who is making the request and what they are allowed to do:

```typescript
interface ActorContext {
  organizationId: Id<"organizations">
  actorType: "user" | "agent" | "system" | "webhook"
  actorId: string
  roleIds: Id<"roles">[]
  isOrgAdmin?: boolean
  environment: "development" | "production"
}
```

| Field | Description |
|-------|-------------|
| `organizationId` | The organization boundary for all data access |
| `actorType` | Whether the caller is a user, agent, system process, or webhook |
| `actorId` | Unique identifier for the specific actor |
| `roleIds` | Pre-resolved role IDs (eager resolution at request start) |
| `isOrgAdmin` | Whether the actor has organization admin privileges |
| `environment` | Data environment scope (development or production) |

### Eager Resolution

Roles are resolved once when the `ActorContext` is built, not on each permission check. This means the roles are fetched from the database at the start of the request and cached in the context object for the duration of that request.

### Context Builders

| Function | Use Case |
|----------|----------|
| `buildActorContext()` | For authenticated user requests |
| `buildSystemActorContext()` | For system operations (triggers, webhooks) |
| `buildActorContextForAgent()` | For agent execution with environment from API key |

## Permission Flow

Every data operation passes through a four-stage pipeline:

```
Request arrives
    │
    ▼
┌──────────────────────────────────────┐
│ Stage 1: Build ActorContext          │
│                                      │
│ Resolve organization, actor type,    │
│ actor ID, environment, and role IDs  │
│ (eager resolution).                  │
│                                      │
│ System actors are automatically      │
│ allowed through all checks.          │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Stage 2: Policy Evaluation           │
│                                      │
│ Find all policies matching the       │
│ requested resource and action.       │
│                                      │
│ Deny overrides allow:                │
│ - Any deny policy → access denied    │
│ - At least one allow → proceed       │
│ - No matching policies → denied      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Stage 3: Scope Rules (Row-Level)     │
│                                      │
│ Apply scope filters to restrict      │
│ which entities are visible.          │
│                                      │
│ Example: Teacher sees only sessions  │
│ where data.teacherId matches their   │
│ user ID.                             │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Stage 4: Field Masks (Column-Level)  │
│                                      │
│ Hide or redact specific fields       │
│ from the response.                   │
│                                      │
│ Example: Teacher cannot see          │
│ data.paymentId on sessions.          │
└──────────────┬───────────────────────┘
               │
               ▼
          Filtered response
```

## Policy Evaluation

Policies define what actions a role can perform on which resources.

### Action Types

The platform supports 5 action types:

| Action | Description |
|--------|-------------|
| `create` | Create a new entity |
| `read` | Retrieve a single entity by ID |
| `update` | Modify an existing entity |
| `delete` | Soft-delete an entity |
| `list` | Query multiple entities |

### Evaluation Rules

1. **Collect** all policies from the actor's roles that match the requested resource and action
2. **Deny overrides**: If any matching policy has `effect: "deny"`, access is denied regardless of allow policies
3. **Allow required**: At least one matching policy must have `effect: "allow"` for access to be granted
4. **No match = denied**: If no policies match the resource and action, access is denied

### API

```typescript
canPerform(ctx, actorContext, resource, action)
```

Returns a `PermissionResult`:

```typescript
interface PermissionResult {
  allowed: boolean
  reason?: string
  matchedPolicy?: Id<"policies">
  evaluatedPolicies?: number
}
```

```typescript
assertCanPerform(ctx, actorContext, resource, action)
```

Throws a `PermissionError` if access is denied. Used in mutations where denial should halt execution.

## Scope Rules (Row-Level Security)

Scope rules restrict which entities an actor can see by filtering query results based on entity data fields.

### How Scope Rules Work

When an actor queries entities, scope rules for their role and the target entity type are collected. These rules generate filters that are applied to the query:

```
Actor queries "session" entities
    │
    ▼
Scope rules for actor's roles + "session" entity type collected
    │
    ▼
Filters generated:
  { field: "data.teacherId", operator: "eq", value: <actor's userId> }
    │
    ▼
Query results filtered to only matching entities
```

### Dynamic Value Resolution

Scope rules support `actor.userId` as a dynamic value that resolves to the current actor's user ID at query time. This enables rules like "a teacher can only see sessions assigned to them":

```typescript
{ entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" }
```

### Operators

| Operator | Description |
|----------|-------------|
| `eq` | Field equals value |
| `neq` | Field does not equal value |
| `in` | Field is contained in value |
| `contains` | Field contains value |

## Field Masks (Column-Level Security)

Field masks control which fields an actor can see on an entity, implementing column-level security.

### Allowlist Strategy

Field masks use an **allowlist strategy**: new fields added to an entity type are hidden by default until explicitly allowed in a role's field mask configuration. This is a fail-safe design that prevents accidental data exposure.

### Mask Types

| Type | Behavior |
|------|----------|
| `hide` | Removes the field entirely from the response |
| `redact` | Replaces the field value while keeping the key present |

### Example

A teacher role with field masks:

```typescript
fieldMasks: [
  { entityType: "session", fieldPath: "data.paymentId", maskType: "hide" },
  { entityType: "student", fieldPath: "data.guardianId", maskType: "hide" },
]
```

When a teacher queries a session, the `paymentId` field is not present in the response.

## Tool Permissions

The permission engine also controls which tools an agent or user can invoke.

### Tool Identity Modes

| Mode | Behavior |
|------|----------|
| `inherit` | Tool runs with the caller's permissions |
| `system` | Tool runs with system-level permissions (environment-aware, `isOrgAdmin: true`) |
| `configured` | Tool runs with explicitly configured permissions |

### Permission Check

```typescript
canUseTool(ctx, actorContext, toolName)
```

Checks if the actor is allowed to use the specified tool based on their role's tool permissions.

## Security Properties

The permission engine guarantees the following security properties:

| Property | Description |
|----------|-------------|
| No privileged data paths | Templates, tools, and triggers all go through the permission engine |
| Defense in depth | Organization boundary checked at multiple layers |
| Environment isolation | All queries, roles, configs, and entities scoped to environment |
| Deny-safe | Any deny policy blocks access, regardless of allow policies |
| Fail-safe | New fields hidden by default via allowlist field masking |
| Audit trail | Events capture actor context for all mutations |

## System Actor

The system actor bypasses all permission checks. It is used for:

- Trigger execution (automated workflows need full data access)
- Webhook processing (inbound messages need to create entities)
- Internal operations (migrations, system maintenance)

The system actor is built using `buildSystemActorContext()` and always includes the environment.

