# Glossary: Terms and Concepts

## Document Purpose

This glossary defines terms used throughout the roadmap documents. When a term has a specific meaning in the Struere context (which may differ from general usage), it is defined here.

---

## A

### Action
One of the five permission verbs: `create`, `read`, `update`, `delete`, `list`. Actions are used in policy definitions to specify what operations a role can perform on a resource.

### ActorContext
The runtime identity object that represents "who is performing this action." Contains:
- `organizationId`: Tenant boundary
- `actorType`: user, agent, system, or webhook
- `actorId`: Unique identifier for the actor
- `roleIds`: List of role IDs assigned to this actor

Built once per request (eager resolution) and passed to all permission checks.

### Agent
An AI-powered assistant configured with a system prompt, model settings, and tools. Agents process conversations and can execute tools to perform actions.

### Allowlist (Whitelist)
A field mask strategy where only explicitly listed fields are visible. Chosen over denylist because it fails safe—new fields are hidden by default.

---

## B

### Built-in Tool
A tool implemented as a Convex mutation that performs standard operations (entity.create, entity.query, event.emit, job.enqueue). Contrasted with custom tools that execute on the tool-executor worker.

---

## C

### Convex
The backend platform used by Struere. Provides real-time database, serverless functions, and scheduled jobs. All backend logic runs on Convex.

### Custom Tool
A tool whose handler code is stored in the agent configuration and executed on the Cloudflare Worker (tool-executor). Has a sandboxed fetch allowlist for security.

### Customization (Pack)
When a user modifies a pack-installed entity type, role, or policy. Customizations are tracked so they aren't overwritten during pack upgrades.

---

## D

### Defense in Depth
A security principle where multiple layers of protection exist. In Struere, organization boundary filtering happens at both the query level AND the permission level, so a bug in one layer doesn't cause cross-org data leaks.

### Denylist (Blacklist)
A field mask strategy where listed fields are hidden, and everything else is visible. NOT used in Struere because it fails dangerous—new fields are visible by default.

---

## E

### Eager Resolution
Building the complete ActorContext (including role lookups) once at the start of a request, rather than querying roles on every permission check. Chosen for performance.

### Entity
A business data record stored in the `entities` table. Has an entity type, organization, status, and arbitrary JSON data.

### Entity Relation
A link between two entities (stored in `entityRelations`). Used to model relationships like "guardian is parent of student" or "session belongs to teacher."

### Entity Type
A schema definition for a category of entities. Defines the structure, searchable fields, and display configuration for entities of that type.

### Event
An immutable audit log record stored in the `events` table. Records what happened, when, and who did it. Events are NOT the source of truth—entities are.

---

## F

### Field Mask
A rule that controls which fields of an entity a specific role can see. Implements column-level security. Uses allowlist strategy.

### Field Match (Scope Rule)
A type of scope rule that filters entities based on a field value matching the actor's identity. Example: `session.teacherId == actor.userId`.

### Flow
A Chilean payment provider. Used for payment link generation and webhook notifications in the tutoring integration.

---

## G

### Guardian
In the tutoring domain, a parent or guardian responsible for a student. Has a specific role with limited permissions.

---

## H

### Handler Code
The JavaScript code stored in a custom tool definition that executes on the tool-executor worker.

---

## I

### Identity Mode (Tool)
How a tool determines its execution permissions:
- `inherit`: Run as the calling actor (default)
- `system`: Run with elevated system permissions
- `configured`: Run as a specific configured role

### Integration
A connection to an external service (WhatsApp, Flow, Google Calendar). Configured per organization with API credentials.

---

## J

### Job
A scheduled or queued task stored in the `jobs` table. Jobs have actor context, status, and are processed by the Convex scheduler.

---

## L

### Lazy Resolution
Looking up roles on every permission check rather than once at request start. NOT used in Struere due to performance concerns.

---

## M

### Migration (Pack)
A set of steps to upgrade a pack from one version to another. Can add fields, rename fields, modify schemas, or run scripts.

### Mutation
A Convex function that modifies data. Contrasted with queries (read-only).

---

## O

### Organization
A tenant in Struere. All data is scoped to exactly one organization. Users belong to one organization.

### Organization Boundary
The security boundary that ensures data from one organization is never visible to another organization.

---

## P

### Pack (Solution Pack)
A reusable template that packages entity types, roles, policies, field masks, scope rules, and workflows. Can be installed by organizations and upgraded over time.

### Permission
The combination of role + action + resource that determines if an operation is allowed.

### Permission Engine
The core library (`lib/permissions/`) that evaluates policies, applies scope rules, and filters fields.

### Policy
A rule that grants or denies permission. Contains:
- `roleId`: Which role this applies to
- `resource`: What entity type (or * for all)
- `action`: What operation (or * for all)
- `effect`: "allow" or "deny"

Deny overrides allow in policy evaluation.

### Privileged Path
A data access path that bypasses permission checks. The goal of Phase 1-3 is to eliminate all privileged paths.

---

## Q

### Query
A Convex function that reads data without modification.

---

## R

### Relation (Scope Rule)
A type of scope rule that filters entities based on relationships to other entities. More complex than field_match. Limited to predefined patterns in V1.

### Role
A named set of permissions assigned to users. Examples: admin, teacher, guardian.

### Row-Level Security
Filtering which records a role can access (implemented via scope rules). Contrasted with column-level security (field masks).

---

## S

### Scope Rule
A rule that filters which entities of a type a role can access. Implements row-level security.

### Semantic Versioning
Version numbering as MAJOR.MINOR.PATCH. Major = breaking changes, Minor = new features, Patch = bug fixes.

### Session (Tutoring)
A scheduled tutoring appointment with a teacher, student, time, and status.

### System Actor
A special actor type used for scheduled jobs and internal operations. Has elevated permissions but still respects organization boundaries.

---

## T

### Teacher
In the tutoring domain, a tutor who conducts sessions. Has a specific role with permissions limited to their own sessions and students.

### Template (WhatsApp)
A pre-approved message format required by Meta for outbound WhatsApp messages. Variables are filled in at send time.

### Template Compilation
The process of converting a system prompt template into the final prompt string. Resolves variables and functions. Must be permission-aware.

### Template Engine
The library (`lib/templateEngine.ts`) that processes system prompt templates.

### Tool
A capability that an agent can invoke. Built-in tools are Convex mutations. Custom tools execute on the tool-executor.

### Tool Executor
A Cloudflare Worker that executes custom tool handler code in a sandboxed environment with a fetch allowlist.

### Tool Permission
A rule that controls whether an agent can use a specific tool and under what identity mode.

---

## U

### UserRole
An assignment of a role to a user in a specific organization. Stored in `userRoles` table.

---

## V

### View
A saved query configuration that defines how to display a list of entities. Contains filters, columns, and sorting.

---

## W

### Webhook
An HTTP endpoint that receives notifications from external services (WhatsApp, Flow).

### WhatsApp Business API
Meta's API for sending and receiving WhatsApp messages programmatically. Requires approved templates for outbound messages.

### Window (24-Hour)
After a user sends a WhatsApp message, there is a 24-hour window during which freeform (non-template) messages can be sent. Tracked per conversation.

---

## Acronyms

| Acronym | Meaning |
|---------|---------|
| CRUD | Create, Read, Update, Delete |
| RBAC | Role-Based Access Control |
| RLS | Row-Level Security |
| API | Application Programming Interface |
| SDK | Software Development Kit |
| CLI | Command Line Interface |
| UI | User Interface |
| UX | User Experience |
| JWT | JSON Web Token |
| ID | Identifier |
| DB | Database |
| MVP | Minimum Viable Product |
| SMB | Small and Medium Business |
