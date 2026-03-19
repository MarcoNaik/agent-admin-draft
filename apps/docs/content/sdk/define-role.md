---
title: "defineRole"
description: "Create roles with policies, scope rules, and field masks"
section: "SDK"
order: 3
---

# defineRole

The `defineRole` function creates roles with access control policies, row-level scope rules, and column-level field masks. Each role is defined in its own file under the `roles/` directory.

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "teacher",
  description: "Tutors who conduct sessions",
  agentAccess: ["scheduling-agent", "student-portal"],
  policies: [
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
    { resource: "student", actions: ["list", "read"], effect: "allow" },
    { resource: "payment", actions: ["*"], effect: "deny" },
  ],
  scopeRules: [
    { entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" },
  ],
  fieldMasks: [
    { entityType: "session", fieldPath: "data.paymentId", maskType: "hide" },
    { entityType: "student", fieldPath: "data.guardianId", maskType: "hide" },
  ],
})
```

## RoleConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique role identifier |
| `description` | `string` | No | Human-readable description |
| `agentAccess` | `string[]` | No | Agent slugs this role can access conversations for (defaults to `[]`) |
| `policies` | `PolicyConfig[]` | Yes | Access control rules (at least one required) |
| `scopeRules` | `ScopeRuleConfig[]` | No | Row-level security filters (defaults to `[]`) |
| `fieldMasks` | `FieldMaskConfig[]` | No | Column-level security masks (defaults to `[]`) |

### Validation

`defineRole` throws errors if:

- `name` is missing
- `policies` is empty or missing
- Any policy is missing `resource`, `actions`, or `effect`
- `agentAccess` contains empty strings

## PolicyConfig

Policies define what actions a role can perform on which resources.

```typescript
interface PolicyConfig {
  resource: string
  actions: string[]
  effect: 'allow' | 'deny'
}
```

| Field | Type | Description |
|-------|------|-------------|
| `resource` | `string` | Data type slug or built-in resource (`users`) the policy applies to |
| `actions` | `string[]` | Allowed values: `"create"`, `"read"`, `"update"`, `"delete"`, `"list"`, or `"*"` for all |
| `effect` | `'allow' \| 'deny'` | Whether to allow or deny the specified actions |

### Policy Evaluation

The permission engine evaluates policies with a **deny-overrides-allow** model:

1. All policies matching the resource and action are collected
2. If any matching policy has `effect: "deny"`, access is denied
3. If at least one policy has `effect: "allow"` and none deny, access is allowed
4. If no policies match, access is denied

```typescript
policies: [
  { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
  { resource: "session", actions: ["delete"], effect: "deny" },
]
```

In this example, the role can list, read, and update sessions but cannot delete them. Even if another role grants delete access, this deny policy overrides it.

### Wildcard Actions

Use `"*"` to match all actions on a resource:

```typescript
{ resource: "session", actions: ["*"], effect: "allow" }
```

This grants create, read, update, delete, and list access.

### Deny-All Pattern

Block all access to a resource:

```typescript
{ resource: "payment", actions: ["*"], effect: "deny" }
```

## ScopeRuleConfig

Scope rules implement row-level security by filtering which entities a role can see.

```typescript
interface ScopeRuleConfig {
  entityType: string
  field: string
  operator: 'eq' | 'neq' | 'in' | 'contains'
  value: string
}
```

| Field | Type | Description |
|-------|------|-------------|
| `entityType` | `string` | Data type slug to filter |
| `field` | `string` | Dot-notation path to the entity field (e.g., `"data.teacherId"`) |
| `operator` | `string` | Comparison operator |
| `value` | `string` | Value to compare against; supports `"actor.userId"` for dynamic resolution |

### Dynamic Value Resolution

The `value` field supports the special prefix `actor.` to reference the current actor's properties at runtime:

- `"actor.userId"` resolves to the authenticated user's ID
- This enables scope rules like "a teacher can only see their own sessions"

### Scope Rule Examples

Teacher sees only sessions where they are the assigned teacher:

```typescript
scopeRules: [
  {
    entityType: "session",
    field: "data.teacherId",
    operator: "eq",
    value: "actor.userId",
  },
]
```

Guardian sees only their own children:

```typescript
scopeRules: [
  {
    entityType: "student",
    field: "data.guardianId",
    operator: "eq",
    value: "actor.userId",
  },
  {
    entityType: "session",
    field: "data.guardianId",
    operator: "eq",
    value: "actor.userId",
  },
]
```

### Operators

| Operator | Description |
|----------|-------------|
| `eq` | Field equals value |
| `neq` | Field does not equal value |
| `in` | Field is contained in value (array) |
| `contains` | Field contains value (substring or array member) |

## FieldMaskConfig

Field masks implement column-level security by hiding or redacting specific fields.

```typescript
interface FieldMaskConfig {
  entityType: string
  fieldPath: string
  maskType: 'hide' | 'redact'
  maskConfig?: Record<string, unknown>
}
```

| Field | Type | Description |
|-------|------|-------------|
| `entityType` | `string` | Data type slug to mask |
| `fieldPath` | `string` | Dot-notation path to the field (e.g., `"data.paymentId"`) |
| `maskType` | `'hide' \| 'redact'` | `hide` removes the field entirely; `redact` replaces the value |
| `maskConfig` | `object` | Additional configuration for redaction behavior |

### Mask Types

**Hide** removes the field from the response entirely:

```typescript
{ entityType: "student", fieldPath: "data.guardianId", maskType: "hide" }
```

**Redact** replaces the field value while keeping the key present:

```typescript
{ entityType: "payment", fieldPath: "data.amount", maskType: "redact", maskConfig: { replacement: "***" } }
```

### Allowlist Strategy

Field masks use an **allowlist strategy**, which means new fields added to a data type are hidden by default until explicitly allowed. This is a fail-safe approach that prevents accidental data exposure.

## Agent Access

The `agentAccess` field controls which agents' conversations a role can see in the dashboard. Members with a role can only view and reply to threads belonging to the listed agents. Admins bypass this restriction and see all conversations.

```typescript
agentAccess: ["sales-agent", "support-agent"]
```

| Behavior | Description |
|----------|-------------|
| Not set or empty | Role has no conversation access |
| List of slugs | Role can view threads for those agents |
| Multiple roles | Access is the union of all assigned roles' `agentAccess` slugs |
| Admin users | Bypass `agentAccess` entirely — see all conversations |

Agent slugs are resolved at query time. If a slug doesn't match an existing agent, it is silently skipped. When the agent is created later, access is automatically granted.

Members cannot start new conversations — they can only view and reply to existing threads for their allowed agents.

## Full Examples

### Admin Role

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "admin",
  description: "Full access to all resources",
  policies: [
    { resource: "teacher", actions: ["*"], effect: "allow" },
    { resource: "student", actions: ["*"], effect: "allow" },
    { resource: "guardian", actions: ["*"], effect: "allow" },
    { resource: "session", actions: ["*"], effect: "allow" },
    { resource: "payment", actions: ["*"], effect: "allow" },
    { resource: "entitlement", actions: ["*"], effect: "allow" },
  ],
})
```

### Teacher Role

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "teacher",
  description: "Tutors who conduct sessions",
  agentAccess: ["scheduling-agent", "student-portal"],
  policies: [
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
    { resource: "student", actions: ["list", "read"], effect: "allow" },
    { resource: "teacher", actions: ["read", "update"], effect: "allow" },
    { resource: "payment", actions: ["*"], effect: "deny" },
    { resource: "entitlement", actions: ["*"], effect: "deny" },
  ],
  scopeRules: [
    { entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" },
    { entityType: "teacher", field: "data.userId", operator: "eq", value: "actor.userId" },
  ],
  fieldMasks: [
    { entityType: "session", fieldPath: "data.paymentId", maskType: "hide" },
    { entityType: "student", fieldPath: "data.guardianId", maskType: "hide" },
  ],
})
```

### Guardian Role

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "guardian",
  description: "Parents or guardians of students",
  agentAccess: ["parent-portal"],
  policies: [
    { resource: "student", actions: ["list", "read", "update"], effect: "allow" },
    { resource: "session", actions: ["list", "read"], effect: "allow" },
    { resource: "payment", actions: ["list", "read"], effect: "allow" },
    { resource: "entitlement", actions: ["list", "read"], effect: "allow" },
    { resource: "teacher", actions: ["*"], effect: "deny" },
  ],
  scopeRules: [
    { entityType: "student", field: "data.guardianId", operator: "eq", value: "actor.userId" },
    { entityType: "session", field: "data.guardianId", operator: "eq", value: "actor.userId" },
    { entityType: "payment", field: "data.guardianId", operator: "eq", value: "actor.userId" },
    { entityType: "entitlement", field: "data.guardianId", operator: "eq", value: "actor.userId" },
  ],
  fieldMasks: [
    { entityType: "session", fieldPath: "data.teacherReport", maskType: "hide" },
  ],
})
```

### Team Lead Role

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "team-lead",
  description: "Team lead with member management access",
  agentAccess: ["support-agent", "sales-agent"],
  policies: [
    { resource: "users", actions: ["update", "delete"], effect: "allow" },
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
    { resource: "customer", actions: ["list", "read"], effect: "allow" },
  ],
  scopeRules: [
    { entityType: "session", field: "data.teamLeadId", operator: "eq", value: "actor.userId" },
  ],
})
```

The `resource: "users"` policies grant this role permission to assign internal roles to team members (`update`) and remove non-admin members (`delete`) from the Team page in the dashboard. Team leads cannot promote users to admin or modify admin users.
