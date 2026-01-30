# Struere Platform Roadmap: Overview

## Document Purpose

This roadmap defines the complete implementation plan for transforming Struere from a "chat agent + tools" platform into a **permission-aware business operations platform**. Each phase document in this folder provides detailed context, rationale, implementation steps, and success criteria.

These documents are designed to be:
- **Self-contained**: Each phase can be understood without reading the others
- **Decision-documented**: Every choice includes the "why" and alternatives considered
- **Implementation-ready**: Clear steps that can be executed without ambiguity

---

## The Problem We Are Solving

### What Struere Is Today

Struere is an AI agent platform that allows developers to:
1. Define agents with system prompts and tools
2. Deploy agents via CLI (`struere dev`, `struere deploy`)
3. Execute agent conversations through HTTP endpoints
4. Store business data in entities (entityTypes, entities, entityRelations)
5. Run background jobs via Convex scheduler
6. View execution logs in a dashboard

**Current tech stack:**
- Next.js 14 (Dashboard)
- Convex (Backend: real-time DB, functions, scheduler)
- Cloudflare Workers (Tool executor sandbox)
- Clerk (Authentication)
- TypeScript throughout

### What Struere Cannot Do Today

Despite having tables for roles, policies, scope rules, and field masks, **none of these are enforced**. This means:

1. **Any user in an organization can see all data** - A teacher can see payment amounts, other teachers' sessions, parent phone numbers
2. **Any user can modify any record** - No permission checks on mutations
3. **Agents can access any data in prompts** - Template compilation has no permission boundary
4. **Tools execute without authorization** - Built-in tools don't check if the actor is allowed
5. **Jobs run without actor context** - No audit trail of who initiated automated actions

This makes Struere unsuitable for real business operations where:
- Different roles need different data access (admin vs teacher vs parent)
- Sensitive data must be protected (payment info, contact details)
- Audit trails are required for compliance
- Automated actions must be attributable

### The Tutoring Case Study

We have a concrete customer case that exemplifies the gap:

**The business:**
- Sells tutoring sessions (trials, single classes, packs)
- Uses WhatsApp as primary communication channel
- Has teachers, students, parents/guardians as actors
- Needs scheduling, payments, reminders, reports

**What they need that Struere can't provide:**
- Teachers see only their own sessions (not other teachers')
- Teachers cannot see payment amounts or parent phone numbers
- Parents cannot see internal notes or teacher compensation
- Automated reminders must be traceable
- Agent prompts must not leak restricted data

**Why this matters:**
If we can support this tutoring business without custom code, we can support many similar SMB operations (clinics, service businesses, field operations). If we can't, we either:
- Build bespoke systems per client (doesn't scale)
- Stay in the narrow lane of "chat + tools" (lower value)

---

## What We Already Have (The Good News)

Before planning what to build, we must acknowledge what exists. The codebase exploration revealed:

### Database Schema (Complete)

The following tables exist in `platform/convex/schema.ts`:

| Table | Purpose | Status |
|-------|---------|--------|
| `roles` | Role definitions per organization | ✅ Schema exists |
| `policies` | Resource + action + effect rules | ✅ Schema exists |
| `scopeRules` | Row-level filtering rules | ✅ Schema exists |
| `fieldMasks` | Column-level whitelists | ✅ Schema exists |
| `toolPermissions` | Per-tool authorization | ✅ Schema exists |
| `userRoles` | User-to-role assignments | ✅ Schema exists |

### Pack System (Functional)

- `platform/convex/packs.ts` - Install/uninstall mutations
- `platform/convex/packs/tutoring.ts` - Example pack with 6 entity types and 3 roles
- Pack installation creates entity types and roles automatically

### Actor Identity (Partial)

- `AuthContext` exists with `userId`, `organizationId`, `actorType`
- Flows through HTTP handlers to mutations
- Events table records actor information

### Template Engine (Exists but Unsecured)

- `lib/templateEngine.ts` processes system prompts
- Supports variables (`{{ variable }}`) and functions (`{{ entity.get() }}`)
- **Problem**: No permission checks on data access

### What's Missing: Enforcement

The gap is not "missing tables" but "missing enforcement":

```
Current state:
  User Request → Auth Check (org boundary only) → Full Data Access

Required state:
  User Request → Auth Check → Build Actor Context → Permission Check → Scoped Data Access
```

---

## The Solution: Permission-Aware Execution

### Core Principle

Every data access must answer three questions:
1. **Who is asking?** (Actor identity)
2. **What are they allowed to see?** (Scope rules + field masks)
3. **What are they allowed to do?** (Policies)

### Architecture Change

```
Before:
  Query → DB → Full Result → Client

After:
  Query → Build ActorContext → Apply Scope Rules → DB → Apply Field Masks → Client
```

This applies uniformly to:
- Dashboard queries
- Tool execution
- Template compilation
- Job execution

### Why Not Just Fix It in the UI?

**Wrong approach (UI filtering):**
```typescript
const sessions = useAllSessions()  // Returns everything
const filtered = sessions.filter(s => isAllowed(s))  // Client-side filter
```

Problems:
- Data already sent to client (leaked)
- Client can bypass filtering
- No audit trail
- Inconsistent with API access

**Correct approach (backend filtering):**
```typescript
const sessions = useSessionsAsActor(actorContext)  // Returns only allowed data
```

Benefits:
- Data never leaves server unless permitted
- Consistent across all access methods
- Auditable
- Single enforcement point

---

## Decisions Already Locked

Through prior discussion, we locked these foundational decisions:

### 1. ActorContext Resolution: Eager

**Decision**: Resolve roles and permissions once when creating actor context, not on every check.

**Why**: A single request may perform multiple permission checks (query, then update, then emit event). Lazy resolution would query the database repeatedly. Eager resolution pays the cost once.

**Trade-off accepted**: Context creation is heavier, but total request cost is lower.

### 2. Field Masks: Allowlist (Whitelist)

**Decision**: Field masks define which fields ARE visible, not which are hidden.

**Why**: When schema evolves and new fields are added, allowlist fails safe (new fields are hidden by default). Denylist fails dangerous (new fields are visible by default).

**Example**:
```typescript
// Allowlist (our choice)
{ allowedFields: ["name", "startTime", "status"] }
// New field "paymentAmount" added → automatically hidden

// Denylist (rejected)
{ deniedFields: ["paymentAmount", "internalNotes"] }
// New field "guardianPhone" added → accidentally visible!
```

### 3. Permission Check API: Result + Assert

**Decision**: Provide both a result-returning function and a throwing function.

**Why**: Different call sites have different needs.
- Mutations want fast-fail: `assertCanPerform()` throws immediately
- Logging/telemetry wants details: `canPerform()` returns reason

```typescript
// For mutations (fast-fail)
assertCanPerform(actor, "entity.create", "session")

// For logging/conditional logic
const result = canPerform(actor, "entity.read", "payment")
if (!result.allowed) {
  logPermissionDenied(result.reason)
}
```

### 4. Scope Rules V1: Limited Set

**Decision**: V1 supports `field_match` and limited `relation` patterns. No `custom` rules.

**Why**:
- `field_match` is simple and fast: `session.teacherId == actor.userId`
- `relation` can explode in complexity if fully generic
- `custom` is too open-ended and hard to secure
- Tutoring can be served with a small set of explicit patterns

**What this means**: Relation-based scopes are defined in code for specific pack patterns, not as a generic query builder.

### 5. Tool Identity Modes: Default Inherit

**Decision**: Tools run as the actor who triggered them by default. `system` mode only for jobs and webhooks.

**Why**:
- Most tools should respect the caller's permissions
- System mode is dangerous and must be explicit
- Even system mode respects organization boundaries

**System mode tools**:
- Job execution (triggered by scheduler, not user)
- Webhook handlers (external systems, not authenticated users)

### 6. Template Compilation: No Privileged Path

**Decision**: Template compilation uses the same permission-aware data layer as tools and dashboard.

**Why**: If templates can query without permissions, all other security is bypassed. The LLM receives data through prompts, so prompt construction must be permission-aware.

**Implementation**: Template functions like `{{ entity.get() }}` call the same `queryAsActor()` that tools use.

---

## Phase Overview

The implementation is divided into phases that build on each other:

| Phase | Name | Purpose | Depends On |
|-------|------|---------|------------|
| 0 | Foundation Decisions | Lock architectural choices | (none) |
| 1 | Permission Engine Core | Build the enforcement layer | Phase 0 |
| 2 | Entity System Integration | Apply permissions to all data access | Phase 1 |
| 3 | Template & Tool Security | Secure prompt compilation and tool execution | Phase 2 |
| 4 | Tutoring Domain Implementation | Build the first real use case | Phase 3 |
| 5 | Integration Layer | WhatsApp, Payments, Calendar | Phase 4 |
| 6 | Dashboard Role Modules | Role-aware UI | Phase 4 |
| 7 | Pack System & Migrations | Reusable solution templates | Phase 6 |

### Why This Order?

1. **Phase 1 before everything**: Permissions are the foundation. Without them, everything else is insecure.

2. **Phase 2 before Phase 3**: Entity system is the data layer. Tools and templates access entities, so entities must be secure first.

3. **Phase 3 before Phase 4**: Template and tool security must be proven before building real flows on top.

4. **Phase 4 before Phase 5-6**: Tutoring domain validates the primitives. We don't want to build integrations or UI for a broken foundation.

5. **Phase 7 last**: Pack system formalizes patterns discovered in Phase 4-6.

---

## Success Criteria (Overall)

The platform is complete when:

1. **Permission enforcement is universal**: No data access path bypasses permission checks
2. **Tutoring pack works end-to-end**: Teachers, admins, and parents see only their allowed data
3. **Template compilation is secure**: Agent prompts never contain unauthorized data
4. **Integrations are operational**: WhatsApp templates, payment links work
5. **Dashboard is role-aware**: Different roles see different views
6. **Packs are reusable**: New customers can install tutoring pack and customize

---

## How to Read This Roadmap

Each phase document follows this structure:

1. **Context**: What exists, what's the problem, why this phase matters
2. **Goals**: What we're trying to achieve
3. **Non-Goals**: What we're explicitly NOT doing in this phase
4. **Decisions**: Choices made and alternatives rejected
5. **Implementation Steps**: Concrete tasks with file paths
6. **Testing Strategy**: How we verify it works
7. **Success Criteria**: How we know we're done
8. **What's Next**: Context for the following phase

---

## Document Index

- [Phase 0: Foundation Decisions](./01-phase-0-foundation-decisions.md)
- [Phase 1: Permission Engine Core](./02-phase-1-permission-engine.md)
- [Phase 2: Entity System Integration](./03-phase-2-entity-integration.md)
- [Phase 3: Template & Tool Security](./04-phase-3-template-tool-security.md)
- [Phase 4: Tutoring Domain Implementation](./05-phase-4-tutoring-domain.md)
- [Phase 5: Integration Layer](./06-phase-5-integrations.md)
- [Phase 6: Dashboard Role Modules](./07-phase-6-dashboard-roles.md)
- [Phase 7: Pack System & Migrations](./08-phase-7-pack-system.md)
- [Glossary: Terms and Concepts](./09-glossary.md)
