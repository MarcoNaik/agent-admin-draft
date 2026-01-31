# Current Implementation State

## Document Purpose

This document captures the current state of the Struere platform after implementing all 7 phases of the roadmap. It serves as a reference for what has been built, what files were created/modified, and what capabilities are now available.

**Last Updated**: January 2026

**Status**: All phases complete and reviewed

---

## Implementation Summary

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|------------------|
| 0 | Foundation Decisions | ✅ Complete | 9 architectural decisions locked |
| 1 | Permission Engine Core | ✅ Complete | ActorContext, policy evaluation, scope rules, field masks |
| 2 | Entity System Integration | ✅ Complete | All entity operations permission-aware |
| 3 | Template & Tool Security | ✅ Complete | No privileged data paths |
| 4 | Tutoring Domain | ✅ Complete | 6 entity types, 3 roles, scheduling, workflows |
| 5 | Integration Layer | ✅ Complete | WhatsApp, Flow payments, webhooks |
| 6 | Dashboard Role Modules | ✅ Complete | Teacher/Guardian/Admin views |
| 7 | Pack System | ✅ Complete | Versioning, migrations, catalog UI |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION-AWARE PLATFORM                            │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────────────────────┐ │
│  │   Dashboard     │    │                    CONVEX                        │ │
│  │   (Next.js)     │◄──►│                                                  │ │
│  │                 │    │  ┌─────────────────────────────────────────┐    │ │
│  │  Role-Based UI  │    │  │         PERMISSION ENGINE                │    │ │
│  │  - Admin View   │    │  │  • ActorContext (eager resolution)       │    │ │
│  │  - Teacher View │    │  │  • Policy evaluation (deny overrides)    │    │ │
│  │  - Guardian View│    │  │  • Scope rules (row-level security)      │    │ │
│  └─────────────────┘    │  │  • Field masks (column-level security)   │    │ │
│                         │  └─────────────────────────────────────────┘    │ │
│  ┌─────────────────┐    │                      │                           │ │
│  │   CLI           │    │  ┌───────────────────┴───────────────────┐      │ │
│  │   (struere)     │────┤  │           SECURED OPERATIONS           │      │ │
│  └─────────────────┘    │  │  • Entities (CRUD + relations)         │      │ │
│                         │  │  • Events (visibility filtered)        │      │ │
│  ┌─────────────────┐    │  │  • Tools (permission checked)          │      │ │
│  │   Webhooks      │    │  │  • Templates (permission-aware)        │      │ │
│  │   - WhatsApp    │────┤  │  • Jobs (actor context preserved)      │      │ │
│  │   - Flow        │    │  └────────────────────────────────────────┘      │ │
│  └─────────────────┘    │                      │                           │ │
│                         │  ┌───────────────────┴───────────────────┐      │ │
│                         │  │           TUTORING DOMAIN              │      │ │
│                         │  │  • 6 Entity Types                      │      │ │
│                         │  │  • 3 Roles with policies               │      │ │
│                         │  │  • Scheduling constraints              │      │ │
│                         │  │  • Credit consumption                  │      │ │
│                         │  │  • Reminder/followup jobs              │      │ │
│                         │  └────────────────────────────────────────┘      │ │
│                         └─────────────────────────────────────────────────┘ │
│                                        │                                    │
│                                        ▼                                    │
│                         ┌─────────────────────────────────────────────────┐ │
│                         │           CLOUDFLARE WORKER                      │ │
│                         │           (tool-executor)                        │ │
│                         │  • Custom tool execution                         │ │
│                         │  • Sandboxed fetch                               │ │
│                         │  • Actor context passed                          │ │
│                         └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Files Created

### Permission Engine (`platform/convex/lib/permissions/`)

| File | Purpose |
|------|---------|
| `types.ts` | Core types: Action, ActorContext, PermissionResult, PermissionError, ScopeFilter, FieldMaskResult |
| `context.ts` | `buildActorContext()`, `buildSystemActorContext()` |
| `evaluate.ts` | `canPerform()`, `assertCanPerform()`, `logPermissionDenied()` |
| `scope.ts` | `getScopeFilters()`, `applyScopeFiltersToQuery()` |
| `mask.ts` | `getFieldMask()`, `applyFieldMask()` |
| `tools.ts` | `canUseTool()`, `getToolIdentity()` |
| `index.ts` | Exports + `queryEntitiesAsActor()`, `getEntityAsActor()` |

### Pack System (`platform/convex/lib/packs/`)

| File | Purpose |
|------|---------|
| `version.ts` | `compareVersions()`, `isUpgrade()`, `isMajorUpgrade()` |
| `migrate.ts` | Migration execution, field operations |

### Scheduling & Workflows (`platform/convex/lib/`)

| File | Purpose |
|------|---------|
| `scheduling.ts` | Booking validation, availability, overlap detection |
| `workflows/session.ts` | Session lifecycle, credit consumption |

### Integrations (`platform/convex/lib/integrations/`)

| File | Purpose |
|------|---------|
| `whatsapp.ts` | WhatsApp API client, template messages, window tracking |
| `flow.ts` | Flow payment API, link creation, signature generation |

### Job Handlers (`platform/convex/jobs/`)

| File | Purpose |
|------|---------|
| `sessionReminder.ts` | 20-hour pre-session reminder |
| `sessionFollowup.ts` | Post-session follow-up (trial/pack) |

### Convex Functions (`platform/convex/`)

| File | Purpose |
|------|---------|
| `permissions.ts` | Internal query wrappers for permissions |
| `whatsapp.ts` | WhatsApp mutations (send, receive, conversations) |
| `payments.ts` | Payment mutations (create, mark paid/failed, reconcile) |
| `integrations.ts` | Integration config management |
| `sessions.ts` | Session CRUD with scheduling constraints |

### Dashboard Components (`apps/dashboard/src/`)

| Path | Purpose |
|------|---------|
| `hooks/use-current-role.ts` | Role detection hook |
| `contexts/role-context.tsx` | Role context provider |
| `components/role-redirect.tsx` | Access control components |
| `components/teacher/report-form.tsx` | Session report submission |
| `components/teacher/session-actions.tsx` | Role-aware action buttons |
| `components/entities/entity-actions.tsx` | Entity CRUD buttons |
| `app/(dashboard)/teacher/*` | Teacher module (5 pages) |
| `app/(dashboard)/guardian/*` | Guardian module (5 pages) |
| `app/(dashboard)/settings/integrations/*` | Integration settings (3 pages) |
| `app/(dashboard)/settings/packs/*` | Pack catalog (2 pages) |

---

## Files Modified

### Schema (`platform/convex/schema.ts`)

Added tables:
- `whatsappConversations` - Conversation state, 24-hour window
- `whatsappTemplates` - Approved message templates
- `whatsappMessages` - Message audit log
- `integrationConfigs` - Integration credentials

Added fields:
- `jobs.actorContext` - Preserved actor identity
- `installedPacks.customizations` - Track user modifications
- `installedPacks.upgradeHistory` - Version history
- `entities.providerReference` - External payment reference

Added indexes:
- `roles.by_org_isSystem` - System role lookup
- `integrationConfigs.by_provider` - Provider lookup
- `integrationConfigs.by_provider_status` - Active integrations

### Core Functions

| File | Changes |
|------|---------|
| `entities.ts` | All operations permission-aware, secure CRUD |
| `entityTypes.ts` | Admin-only schema operations |
| `events.ts` | Visibility filtered by entity access |
| `agent.ts` | Actor context for templates, tool permissions |
| `jobs.ts` | Actor context preservation, job handlers |
| `packs.ts` | Install with version, upgrade with migrations |
| `packs/tutoring.ts` | Complete pack definition with 6 types, 3 roles |
| `packs/index.ts` | Pack types with migrations, scope rules, field masks |

### Built-in Tools (`platform/convex/tools/`)

| File | Changes |
|------|---------|
| `entities.ts` | Permission checks, actor context |
| `events.ts` | Visibility filtering |
| `jobs.ts` | Actor context in job creation |

### Dashboard

| File | Changes |
|------|---------|
| `hooks/use-convex-data.ts` | Added 15+ new hooks for roles, integrations, packs |
| `components/header.tsx` | Role-based navigation |
| `app/(dashboard)/layout.tsx` | RoleProvider wrapper |
| `app/(dashboard)/settings/page.tsx` | Links to integrations and packs |

---

## Security Model

### Permission Flow

```
Request
    │
    ▼
┌─────────────────────────────────┐
│ 1. Build ActorContext           │
│    - organizationId             │
│    - actorType (user/agent/...) │
│    - actorId                    │
│    - roleIds (eager resolved)   │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ 2. Check Permission             │
│    - Find matching policies     │
│    - Deny overrides allow       │
│    - No roles = denied          │
│    - System actor = allowed     │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ 3. Apply Scope Rules            │
│    - Filter by field match      │
│    - Teacher sees own sessions  │
│    - Guardian sees own children │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ 4. Apply Field Masks            │
│    - Allowlist (whitelist)      │
│    - Teachers: no payment info  │
│    - Guardians: no teacher notes│
└─────────────┬───────────────────┘
              │
              ▼
           Response
```

### Security Properties

1. **No privileged data paths** - Templates, tools, jobs all go through permissions
2. **Defense in depth** - Organization boundary checked at multiple layers
3. **Deny overrides allow** - Any deny policy blocks access
4. **Fail safe** - New fields hidden by default (allowlist)
5. **Audit trail** - Events capture actor for all mutations

---

## Tutoring Domain

### Entity Types

| Type | Key Fields | Notes |
|------|------------|-------|
| `teacher` | name, email, subjects, availability, hourlyRate, userId | Linked to Clerk user |
| `student` | name, grade, subjects, notes, guardianId, preferredTeacherId | Linked to guardian |
| `guardian` | name, email, phone, whatsappNumber, billingAddress, userId | Primary contact |
| `session` | teacherId, studentId, guardianId, startTime, duration, status | Full lifecycle |
| `payment` | guardianId, amount, status, providerReference, sessionId | Flow integration |
| `entitlement` | guardianId, studentId, totalCredits, remainingCredits, expiresAt | Pack credits |

### Roles & Permissions

| Role | Can See | Can Do |
|------|---------|--------|
| Admin | Everything | Everything |
| Teacher | Own sessions, assigned students (limited fields) | Update sessions, submit reports |
| Guardian | Children's sessions, own payments | Update student info |

### Session Lifecycle

```
pending_payment ──[payment.success]──► scheduled
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
               cancelled            in_progress              no_show
                                          │
                                          ▼
                                      completed
```

### Scheduling Constraints

- 24-hour minimum booking lead time
- 2-hour reschedule cutoff
- Teacher availability validation
- No double booking
- Credit consumption on completion

---

## Integrations

### WhatsApp

- Template message sending (approved templates only)
- 24-hour window tracking for freeform messages
- Inbound message processing via webhook
- Conversation state management

### Flow Payments

- Payment link generation
- HMAC-SHA256 request signing
- Webhook processing for status updates
- Reconciliation job for missed webhooks

### Webhooks

| Endpoint | Purpose |
|----------|---------|
| `GET /webhook/whatsapp` | Hub challenge verification |
| `POST /webhook/whatsapp` | Inbound messages |
| `POST /webhook/flow` | Payment status updates |

---

## Pack System

### Current Packs

| Pack | Version | Entity Types | Roles |
|------|---------|--------------|-------|
| Tutoring | 1.0.0 | 6 | 3 |

### Migration Support

- Add/remove/rename fields
- Add entity types
- Modify schemas
- Run custom scripts
- Customization preservation

### Pack Catalog Features

- List available packs
- Install with version tracking
- Upgrade preview (shows changes vs skipped)
- Customization tracking
- Version history

---

## Dashboard Modules

### Admin Module

- Full dashboard access
- Agent management
- Pack management
- Integration settings
- User/role management

### Teacher Module

| Route | Feature |
|-------|---------|
| `/teacher/sessions` | Session list with filters |
| `/teacher/sessions/[id]` | Detail + report form |
| `/teacher/students` | Assigned students |
| `/teacher/profile` | Own profile |

### Guardian Module

| Route | Feature |
|-------|---------|
| `/guardian/sessions` | Children's sessions |
| `/guardian/students` | Children's profiles |
| `/guardian/payments` | Payment history |
| `/guardian/profile` | Own profile |

---

## Known Limitations

1. **Query performance** - Some queries filter in memory after index lookup (documented trade-off for V1)
2. **Relation scope patterns** - Only `field_match` implemented, complex relations require code patterns
3. **Event payload masking** - Event payloads may contain unmasked historical data
4. **Single payment provider** - Only Flow implemented

---

## Next Steps (Future Phases)

| Phase | Name | Description |
|-------|------|-------------|
| 8 | Guardian Portal | Self-service booking, payment |
| 9 | Analytics | Usage reports, dashboards |
| 10 | Localization | Multi-language support |
| 11 | Pack Marketplace | Public pack registry |

---

## Testing

All phases were reviewed against:
1. Convex best practices (from ~/Downloads/Convex Rules (3).txt)
2. Roadmap specifications
3. TypeScript compilation

Key fixes applied during review:
- Added return validators to all Convex functions
- Replaced `.filter()` with `withIndex()` where possible
- Fixed type mismatches and unused imports
- Added missing indexes to schema
