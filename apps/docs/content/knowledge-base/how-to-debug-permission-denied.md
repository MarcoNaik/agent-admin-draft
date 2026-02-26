---
title: "How do I debug permission denied errors?"
description: "Diagnose and fix access control issues when agents or users are blocked by the permission engine"
section: "Knowledge Base"
order: 2
---

# How do I debug permission denied errors?

## Quick Answer

Permission denials happen when: (1) no allow policy matches the resource and action, (2) a deny policy overrides an allow, or (3) scope rules filter out the target record. Check the actor's roles, policies, and scope rules in the dashboard under the relevant environment.

## Step by Step

### 1. Identify the actor and environment

Every request has an `ActorContext` with:

```typescript
{
  organizationId: "...",
  actorType: "user" | "agent" | "system" | "webhook",
  actorId: "...",
  roleIds: ["role_abc", "role_def"],
  environment: "development" | "production"
}
```

Check which API key was used — `sk_dev_` keys operate in development, `sk_prod_` in production. The environment determines which roles and policies apply.

### 2. Check the role's policies

In the dashboard, navigate to **Roles** and inspect the role assigned to the actor. Verify:

- There is an `allow` policy for the resource and action being attempted
- There is no `deny` policy that overrides it

```typescript
// This allows list+read but denies delete
policies: [
  { resource: "session", actions: ["list", "read"], effect: "allow" },
  { resource: "session", actions: ["delete"], effect: "deny" },
]
```

If the agent tries `entity.update` on a session, it will be denied because there is no allow policy for the `update` action.

### 3. Check scope rules

Even with an allow policy, scope rules can filter out specific records. A teacher with this scope rule:

```typescript
scopeRules: [
  { entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" },
]
```

...can only see sessions where `data.teacherId` matches their user ID. If they query a session assigned to another teacher, they get an empty result (not an error).

### 4. Check field masks

Field masks hide fields but do not block access to the record itself. If an agent tries to read a masked field, it will be missing from the response rather than causing a permission error.

### 5. Check tool permissions

If the denial is on a tool call, verify the agent's tools list includes the tool:

```typescript
export default defineAgent({
  name: "Support",
  slug: "support",
  tools: ["entity.query", "entity.get"],
  // entity.update is NOT listed — tool calls to it will fail
})
```

### 6. Check the environment

Roles are environment-scoped. A role that exists in development may not exist in production. Run `struere status` to compare local definitions against remote state:

```bash
npx struere status
```

## Common Mistakes

- **Wrong environment.** A role synced to development does not exist in production until you run `struere deploy`.
- **Missing list permission.** `entity.query` requires the `list` action, not `read`. The `read` action is for `entity.get` (single record by ID).
- **Deny on wildcard.** `{ resource: "payment", actions: ["*"], effect: "deny" }` blocks all five actions on payments, including `list` and `read`.
- **System actor bypass.** System actors (automations, webhooks) bypass all permission checks. If an automation works but a user cannot perform the same action, it is a permission issue on the user's role.

## Related

- [Permissions](/platform/permissions) — Full permission engine reference
- [How do I set up RBAC?](/knowledge-base/how-to-set-up-rbac) — Role setup guide
- [How do I manage environments?](/knowledge-base/how-to-manage-environments) — Environment scoping
