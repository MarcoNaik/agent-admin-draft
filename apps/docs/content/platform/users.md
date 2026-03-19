---
title: "User Management"
description: "Managing users, roles, and organization membership"
section: "Platform Concepts"
order: 11
---

# User Management

Struere manages users and organizations through Clerk. User records, organization membership, and org-level roles are synced automatically via webhooks. Internal RBAC roles are assigned separately and control what data each user can access.

## User Model

Users are synced from Clerk and stored in the `users` table. Each user record contains:

| Field | Type | Description |
|-------|------|-------------|
| `email` | string | Primary email address |
| `name` | string | Display name (optional) |
| `clerkUserId` | string | Clerk's unique user identifier |
| `createdAt` | number | Creation timestamp |
| `updatedAt` | number | Last update timestamp |

Users are created or updated automatically when Clerk fires `user.created` or `user.updated` webhook events. The `getOrCreateFromClerkNoOrg` internal mutation handles this upsert using the `by_clerk_user` index.

## Organizations

Organizations are the top-level boundary for all data in Struere. Every entity, role, agent, thread, and configuration belongs to exactly one organization.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Organization display name |
| `slug` | string | Unique URL-friendly identifier |
| `clerkOrgId` | string | Clerk's organization identifier |

Organizations are created via Clerk and synced through the `organization.created` webhook event. If a slug collision occurs, the platform appends a numeric suffix (e.g., `my-org-1`).

## Organization Membership

Users belong to organizations through the `userOrganizations` join table. Each membership has a role:

| Organization Role | Description |
|-------------------|-------------|
| `admin` | Full access to all data and settings. Bypasses the RBAC permission engine. Cannot be assigned internal roles. |
| `member` | Access determined by their assigned internal RBAC role. No access to data without a role assignment. |

Membership records are indexed by `by_user_org` for fast lookups and by `by_org` for listing all members.

### Admin vs Member

Organization admins have unrestricted access. The permission engine short-circuits for admins, granting full read/write access to all data types in all environments. Because of this, admins cannot be assigned internal RBAC roles. Promoting a member to admin automatically deletes all their `userRoles` records.

Members have no data access by default. They must be assigned an internal role (from the `roles` table) to gain permissions. The assigned role's policies, scope rules, and field masks determine exactly what data they can see and modify. The role's `agentAccess` field controls which agents' conversations are visible in the dashboard — members can only view and reply to threads from agents listed in their role. Members cannot start new conversations.

All members have access to the Team tab in the dashboard where they can view all organization members. Write actions on the Team page — such as assigning roles to other members or removing members — require `resource: "users"` policies on the member's role.

### Last Admin Protection

The platform prevents demoting the last admin to member. If only one admin remains, attempting to change their organization role to `member` throws an error. This ensures the organization always has at least one admin.

## Internal RBAC Roles

Internal roles are defined in the `roles` table and are environment-scoped. They carry policies, scope rules, and field masks that control data access through the [permission engine](/platform/permissions).

Role assignment is one-to-one: each member can have exactly one active internal role. Assigning a new role replaces the previous one by deleting all existing `userRoles` records for that user first.

### Assigning Roles

Roles are assigned via `roles.assignToUser`, which enforces the following:

1. The target user must be a member of the organization
2. The target user must not be an admin (admins have full access and cannot hold internal roles)
3. Any existing role assignment is removed before the new one is created
4. The assignment tracks who granted it (`grantedBy`) and supports optional expiration (`expiresAt`)

Non-admin members whose role includes `update` permission on the `users` resource can also assign roles to other members from the Team page. Admin-only restrictions still apply: non-admin members cannot modify admin users or promote any user to admin.

### userRoles Schema

| Field | Type | Description |
|-------|------|-------------|
| `userId` | ID | Reference to the user |
| `roleId` | ID | Reference to the role |
| `grantedBy` | ID | User who assigned the role |
| `expiresAt` | number | Optional expiration timestamp |
| `createdAt` | number | Assignment timestamp |

Expired role assignments are filtered out at query time. The `getUserRoles` query returns only active (non-expired) roles.

### Removing Roles

`roles.removeFromUser` deletes all `userRoles` records for a given user, effectively revoking their data access. Deleting a role from the `roles` table is blocked if any users are still assigned to it.

## Pending Role Assignments

Pending role assignments let you pre-assign a role to a user before they accept an organization invite. This is useful when you want a new team member to have the correct permissions from the moment they join.

### How It Works

1. An admin creates a pending assignment with an email address, a role, and an environment
2. The assignment is stored in the `pendingRoleAssignments` table, keyed by `organizationId` and `email`
3. When the user accepts the Clerk invitation and their membership is synced, the `syncMembership` mutation checks for a pending assignment matching their email
4. If found, the role is automatically assigned and the pending record is deleted

### pendingRoleAssignments Schema

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | ID | Owning organization |
| `email` | string | Normalized (lowercase, trimmed) email of the invitee |
| `roleId` | ID | Role to assign on join |
| `environment` | enum | Environment the role belongs to |
| `createdBy` | ID | Admin who created the assignment |

If a pending assignment already exists for the same email in the same organization, updating it replaces the role and environment rather than creating a duplicate.

### Validation

The `createPendingAssignment` mutation enforces:

- The role must belong to the same organization
- The role's environment must match the provided environment
- System roles cannot be pre-assigned

## Role-Bound Entity Types

Data types can be bound to a role using the `boundToRole` and `userIdField` fields on the entity type. When a user is assigned a role that matches an entity type's `boundToRole` value, a new entity is automatically created for that user.

### How It Works

1. A data type defines `boundToRole: "support-agent"` and optionally `userIdField: "userId"`
2. A user joins the organization and their pending role assignment resolves to the `support-agent` role
3. The `syncMembership` mutation finds the matching entity type via the `by_org_env` index and the `boundToRole` filter
4. A new entity is created with the user's Clerk ID in the `userIdField`, plus their `name` and `email` if those fields exist in the schema

This automates user provisioning. When a new support agent joins the organization, their agent profile entity is created without manual intervention.

### Example

Given a data type defined as:

```typescript
import { defineData } from 'struere'

export default defineData({
  name: "Support Agent",
  slug: "support-agent",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string" },
      userId: { type: "string" },
      department: { type: "string" },
      skills: { type: "array", items: { type: "string" } },
    },
  },
  boundToRole: "support-agent",
  userIdField: "userId",
})
```

When a user with email `alice@example.com` joins and is assigned the `support-agent` role, the platform creates:

```json
{
  "entityTypeId": "<support-agent type ID>",
  "status": "active",
  "data": {
    "userId": "clerk_user_abc123",
    "name": "Alice Smith",
    "email": "alice@example.com"
  }
}
```

## Team Management Permissions

Members can manage team members from the Team tab in the dashboard if their role includes policies for the `users` resource. The `users` resource supports the standard CRUD actions:

| Action | Permission | Capability |
|--------|-----------|------------|
| View members | Default | All members can view the team list |
| Assign roles | `update` on `users` | Change internal role assignments for non-admin members |
| Remove members | `delete` on `users` | Remove non-admin members from the organization |
| Invite members | Admin only | Sending invitations requires organization admin access |

### Security Guards

Regardless of permissions, non-admin members cannot:

- Promote any user to organization admin
- Modify or remove users who are organization admins
- Modify their own organization role

Example role with team management access:

```typescript
export default defineRole({
  name: "team-lead",
  description: "Can manage team members",
  policies: [
    { resource: "users", actions: ["update"], effect: "allow" },
    { resource: "session", actions: ["list", "read"], effect: "allow" },
  ],
  agentAccess: ["support-agent"],
})
```

## Removing Users

Removing a user from an organization deletes their `userOrganizations` membership record. The `users.remove` mutation handles this. The user's `users` record is not deleted since they may belong to other organizations.

Non-admin members with `delete` permission on the `users` resource can also remove non-admin members via the Team page.

When a membership is removed via Clerk (the `organizationMembership.deleted` webhook event), the `removeMembership` internal mutation also deletes all `userRoles` records for that user, revoking their internal role assignments.

## Authentication Flow

Every authenticated request passes through the auth module at `platform/convex/lib/auth.ts`.

### AuthContext

The `AuthContext` interface represents an authenticated caller:

```typescript
interface AuthContext {
  userId: Id<"users">
  organizationId: Id<"organizations">
  clerkUserId: string
  actorType: "user" | "agent" | "system" | "webhook"
}
```

### getAuthContext

Resolves the current user and organization from the Clerk JWT token:

1. Extract the Clerk user identity from the request
2. Look up the user by `clerkUserId`
3. If a Clerk `org_id` is present in the token, resolve the organization and verify membership
4. If no org is specified, fall back to the user's first organization membership

### requireAuth

Wraps `getAuthContext` and throws `"Authentication required"` if the context is null. Used in mutations that require a logged-in user.

### requireOrgAdmin

Checks that the authenticated user has the `admin` organization role. Used to guard admin-only operations like deleting an organization.

### isOrgAdmin

Returns a boolean indicating whether the user's `userOrganizations` membership role is `admin`. Does not throw on non-admin access.

### API Key Authentication

For API requests (agent chat, CLI sync), authentication uses API keys instead of Clerk JWTs. The `getAuthContextFromApiKey` function looks up the key by its SHA-256 hash and returns an `AuthContext` with `actorType: "system"`.

## Clerk Webhook Sync

The platform syncs user and organization data from Clerk via the `/webhook/clerk` HTTP endpoint. Webhooks are verified using HMAC-SHA256 with the Svix signing protocol.

### Handled Events

| Clerk Event | Handler | Effect |
|-------------|---------|--------|
| `user.created` | `getOrCreateFromClerkNoOrg` | Creates or updates the user record |
| `user.updated` | `getOrCreateFromClerkNoOrg` | Updates the user's name if changed |
| `organization.created` | `getOrCreateFromClerk` | Creates the organization record |
| `organization.updated` | `getOrCreateFromClerk` | Updates the organization name |
| `organization.deleted` | `markAsDeleted` | Schedules cascading deletion of all organization data |
| `organizationMembership.created` | `syncMembership` | Creates membership, applies pending role assignments, creates role-bound entities |
| `organizationMembership.updated` | `syncMembership` | Updates the membership role (admin/member) |
| `organizationMembership.deleted` | `removeMembership` | Deletes membership and all user role assignments |

### Role Mapping

Clerk organization roles are mapped to Struere membership roles:

| Clerk Role | Struere Role |
|------------|-------------|
| `org:admin` | `admin` |
| `org:owner` | `admin` |
| All others | `member` |

## Deleting an Organization

Organization deletion is admin-only and cascading. The `organizations.remove` mutation verifies the caller has `org:admin` or `org:owner` in Clerk, then schedules the `deleteAllOrgData` internal mutation which deletes all dependent data across all tables.

## Related

- [Permissions](/platform/permissions) — Permission engine that enforces role-based access
- [defineRole](/sdk/define-role) — SDK function for creating roles with policies and scope rules
- [Environment Isolation](/platform/environment-isolation) — Roles and data are scoped per environment
- [How do I set up RBAC?](/knowledge-base/how-to-set-up-rbac) — Step-by-step guide to configuring roles
