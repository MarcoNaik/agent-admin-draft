---
title: "How do I set up RBAC for my agents?"
description: "Define roles with policies, scope rules, and field masks to control what agents and users can access"
section: "Knowledge Base"
order: 1
---

# How do I set up RBAC for my agents?

## Quick Answer

Create role definition files in `roles/` using `defineRole`. Each role contains policies (what actions are allowed), scope rules (row-level filtering), and field masks (column-level hiding). Run `struere dev` to sync.

## Step by Step

### 1. Scaffold a role

```bash
npx struere add role teacher
```

### 2. Define policies

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "teacher",
  description: "Tutors who conduct sessions",
  policies: [
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
    { resource: "student", actions: ["list", "read"], effect: "allow" },
    { resource: "payment", actions: ["*"], effect: "deny" },
  ],
})
```

Policies support five actions: `create`, `read`, `update`, `delete`, `list`. Use `"*"` to match all actions. The `effect` is either `"allow"` or `"deny"`.

### 3. Add scope rules (row-level security)

Scope rules filter which records a role can see:

```typescript
export default defineRole({
  name: "teacher",
  description: "Tutors who conduct sessions",
  policies: [
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
  ],
  scopeRules: [
    { entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" },
  ],
})
```

The `value: "actor.userId"` dynamically resolves to the current user's ID at query time. Operators: `eq`, `neq`, `in`, `contains`.

### 4. Add field masks (column-level security)

Field masks hide or redact specific fields:

```typescript
export default defineRole({
  name: "teacher",
  description: "Tutors who conduct sessions",
  policies: [
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
  ],
  scopeRules: [
    { entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" },
  ],
  fieldMasks: [
    { entityType: "session", fieldPath: "data.paymentId", maskType: "hide" },
    { entityType: "student", fieldPath: "data.guardianPhone", maskType: "hide" },
  ],
})
```

Field masks use an allowlist strategy — new fields are hidden by default until explicitly allowed.

### 5. Add agent access (conversation visibility)

Control which agents' conversations each role can see in the dashboard:

```typescript
export default defineRole({
  name: "teacher",
  description: "Tutors who conduct sessions",
  agentAccess: ["scheduling-agent", "student-portal"],
  policies: [
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
  ],
  scopeRules: [
    { entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" },
  ],
  fieldMasks: [
    { entityType: "session", fieldPath: "data.paymentId", maskType: "hide" },
  ],
})
```

Members with this role can only see conversations from `scheduling-agent` and `student-portal`. Admins see all conversations regardless. If `agentAccess` is not set or empty, the role has no conversation access.

### 6. Add team management permissions (optional)

Grant roles the ability to manage team members from the dashboard Team tab:

```typescript
export default defineRole({
  name: "team-lead",
  description: "Can manage team members and view sessions",
  agentAccess: ["scheduling-agent"],
  policies: [
    { resource: "users", actions: ["update", "delete"], effect: "allow" },
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
  ],
  scopeRules: [
    { entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" },
  ],
})
```

The `users` resource controls access to team management actions. `update` allows assigning roles, `delete` allows removing non-admin members. All members can view the team list regardless of permissions. Only organization admins can invite new members or change organization roles.

### 7. Sync and test

```bash
npx struere dev
```

The permission engine evaluates in order: deny overrides allow, then scope rules filter rows, then field masks strip columns.

## Common Mistakes

- **Forgetting deny overrides allow.** A single deny policy blocks access even if another policy allows it. Put deny rules on the most restrictive role.
- **Using `ne` instead of `neq`.** The correct operator is `neq` for "not equal."
- **Adding a `priority` field to policies.** Policies do not have a priority field. Deny always overrides allow regardless of order.
- **Not syncing after changes.** Run `struere dev` to push role updates to the platform.
- **Role has no `agentAccess`.** Members with a role that omits `agentAccess` cannot see any conversations. Add agent slugs to grant dashboard conversation access.

## Related

- [Permissions](/platform/permissions) — Full permission engine reference
- [Define Role](/sdk/define-role) — SDK role definition API
- [Environment Isolation](/platform/environment-isolation) — Roles are environment-scoped
