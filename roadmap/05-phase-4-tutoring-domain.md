# Phase 4: Tutoring Domain Implementation

## Document Purpose

This document details the implementation of the tutoring domain—the first real business use case built on the permission-aware platform. By the end of this phase, we have a working tutoring operations system that validates all platform primitives.

**Status**: 📋 Planned

**Dependencies**: Phase 3 (Template & Tool Security)

**Estimated Scope**: Entity types (~6 types), roles/policies (~3 roles, ~30 policies), workflows (~5 job types), scheduling logic (~500 lines)

---

## Context: Why This Phase Matters

### The Validation Function

Phases 1-3 built the infrastructure:
- Permission engine (Phase 1)
- Secure entity operations (Phase 2)
- Template and tool security (Phase 3)

But infrastructure without a real use case is untested theory. Phase 4 is where we discover:
- Are the primitives sufficient for real business logic?
- Are the permissions expressive enough?
- What's missing that we didn't anticipate?

### The Tutoring Case Study (Recap)

The customer is a tutoring business with:
- **Teachers**: Conduct sessions, submit reports
- **Students**: Receive tutoring
- **Guardians**: Pay for sessions, receive updates
- **Admins**: Manage operations

Their operational needs:
- Scheduling with constraints (buffers, reschedule limits)
- Pay-before-book flow
- Automated reminders
- Teacher cannot see payment info or guardian phone
- Guardian cannot see teacher compensation or internal notes

### Why Build Tutoring, Not a Generic Pack First

We could try to build a generic "scheduling pack" or "CRM pack." But:
- Generic solutions often miss critical business constraints
- Real use cases reveal what's actually needed
- It's easier to generalize from specific to abstract than abstract to specific

By building tutoring first, we:
- Validate that the platform can support a real business
- Discover missing primitives
- Create a template for future packs

---

## Goals

By the end of Phase 4:

1. **All tutoring entity types are defined** - Session, Student, Guardian, Teacher, Payment, Entitlement
2. **All tutoring roles are configured** - Admin, Teacher, Guardian with appropriate policies
3. **Scheduling logic works** - With buffers, constraints, and pack consumption
4. **Reminders are automated** - Jobs for pre-session reminders
5. **Status workflows exist** - Session lifecycle from scheduled to completed
6. **The agent can perform tutoring operations** - Using built-in tools with correct permissions

---

## Non-Goals for This Phase

1. **WhatsApp integration** - That's Phase 5
2. **Payment processing** - That's Phase 5
3. **Dashboard UI customization** - That's Phase 6
4. **Generic pack extraction** - That's Phase 7

---

## Entity Type Definitions

### Overview

| Entity Type | Description | Key Fields |
|-------------|-------------|------------|
| `teacher` | A tutor who conducts sessions | name, email, subjects, availability |
| `student` | A learner receiving tutoring | name, grade, subjects, notes |
| `guardian` | Parent/guardian who pays | name, email, phone, billingInfo |
| `session` | A scheduled tutoring session | teacherId, studentId, startTime, status |
| `payment` | A payment record | amount, status, method, sessionId/entitlementId |
| `entitlement` | A pack of sessions (credits) | totalCredits, remainingCredits, expiresAt |

### Entity Type: Teacher

```typescript
{
  name: "Teacher",
  slug: "teacher",
  description: "A tutor who conducts sessions",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string", format: "email" },
      phone: { type: "string" },
      subjects: { type: "array", items: { type: "string" } },
      availability: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dayOfWeek: { type: "number", minimum: 0, maximum: 6 },
            startHour: { type: "number", minimum: 0, maximum: 23 },
            endHour: { type: "number", minimum: 0, maximum: 23 },
          },
        },
      },
      hourlyRate: { type: "number" },
      bio: { type: "string" },
      userId: { type: "string" },
    },
    required: ["name", "email"],
  },
  searchFields: ["name", "email", "subjects"],
  displayConfig: {
    listFields: ["name", "email", "subjects"],
    detailFields: ["name", "email", "phone", "subjects", "availability", "bio"],
  },
}
```

**Why these fields?**

- `availability`: Structured availability for scheduling algorithm
- `hourlyRate`: Internal field (teachers shouldn't see their own rate in some orgs)
- `userId`: Links to Clerk/auth user for login
- `subjects`: Searchable for matching students with teachers

### Entity Type: Student

```typescript
{
  name: "Student",
  slug: "student",
  description: "A learner receiving tutoring",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      grade: { type: "string" },
      subjects: { type: "array", items: { type: "string" } },
      notes: { type: "string" },
      preferredTeacherId: { type: "string" },
      guardianId: { type: "string" },
    },
    required: ["name"],
  },
  searchFields: ["name", "grade"],
  displayConfig: {
    listFields: ["name", "grade", "subjects"],
    detailFields: ["name", "grade", "subjects", "notes", "preferredTeacherId"],
  },
}
```

**Why these fields?**

- `guardianId`: Links to guardian for billing and communication
- `preferredTeacherId`: For scheduling consistency
- `notes`: Internal notes (not visible to guardians)

### Entity Type: Guardian

```typescript
{
  name: "Guardian",
  slug: "guardian",
  description: "Parent or guardian responsible for payment and communication",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string", format: "email" },
      phone: { type: "string" },
      whatsappNumber: { type: "string" },
      billingAddress: {
        type: "object",
        properties: {
          street: { type: "string" },
          city: { type: "string" },
          postalCode: { type: "string" },
          country: { type: "string" },
        },
      },
      paymentMethod: { type: "string" },
      userId: { type: "string" },
    },
    required: ["name", "phone"],
  },
  searchFields: ["name", "email", "phone"],
  displayConfig: {
    listFields: ["name", "email", "phone"],
    detailFields: ["name", "email", "phone", "whatsappNumber", "billingAddress"],
  },
}
```

**Why these fields?**

- `whatsappNumber`: For Phase 5 WhatsApp integration
- `billingAddress`, `paymentMethod`: For payment processing
- `userId`: Links to Clerk user for self-service portal

### Entity Type: Session

```typescript
{
  name: "Session",
  slug: "session",
  description: "A scheduled tutoring session",
  schema: {
    type: "object",
    properties: {
      teacherId: { type: "string" },
      studentId: { type: "string" },
      guardianId: { type: "string" },
      startTime: { type: "number" },
      duration: { type: "number" },
      subject: { type: "string" },
      meetingLink: { type: "string" },
      status: {
        type: "string",
        enum: ["pending_payment", "scheduled", "in_progress", "completed", "cancelled", "no_show"],
      },
      entitlementId: { type: "string" },
      paymentId: { type: "string" },
      teacherNotes: { type: "string" },
      guardianNotes: { type: "string" },
      reportSubmitted: { type: "boolean" },
      reportContent: { type: "string" },
      cancellationReason: { type: "string" },
      cancelledBy: { type: "string" },
      cancelledAt: { type: "number" },
    },
    required: ["teacherId", "studentId", "startTime", "duration"],
  },
  searchFields: ["subject"],
  displayConfig: {
    listFields: ["startTime", "studentId", "teacherId", "status"],
    detailFields: ["startTime", "duration", "subject", "meetingLink", "status", "teacherNotes"],
  },
}
```

**Why these fields?**

- `status`: Full lifecycle tracking
- `entitlementId`/`paymentId`: Links to payment records
- `teacherNotes`: Only visible to teacher and admin
- `guardianNotes`: Visible to guardian
- `reportSubmitted`/`reportContent`: Post-session report workflow

### Entity Type: Payment

```typescript
{
  name: "Payment",
  slug: "payment",
  description: "A payment record for sessions or packs",
  schema: {
    type: "object",
    properties: {
      guardianId: { type: "string" },
      amount: { type: "number" },
      currency: { type: "string" },
      status: {
        type: "string",
        enum: ["pending", "processing", "paid", "failed", "refunded"],
      },
      method: { type: "string" },
      providerReference: { type: "string" },
      sessionId: { type: "string" },
      entitlementId: { type: "string" },
      paymentLinkUrl: { type: "string" },
      paidAt: { type: "number" },
      failedAt: { type: "number" },
      failureReason: { type: "string" },
    },
    required: ["guardianId", "amount", "status"],
  },
  searchFields: [],
  displayConfig: {
    listFields: ["guardianId", "amount", "status", "paidAt"],
    detailFields: ["guardianId", "amount", "currency", "status", "method", "providerReference"],
  },
}
```

**Why these fields?**

- `providerReference`: External payment provider ID (Flow, Stripe, etc.)
- `paymentLinkUrl`: For pay-by-link flow
- `sessionId`/`entitlementId`: What this payment is for

### Entity Type: Entitlement

```typescript
{
  name: "Entitlement",
  slug: "entitlement",
  description: "A pack of session credits",
  schema: {
    type: "object",
    properties: {
      guardianId: { type: "string" },
      studentId: { type: "string" },
      totalCredits: { type: "number" },
      remainingCredits: { type: "number" },
      usedCredits: { type: "number" },
      expiresAt: { type: "number" },
      status: {
        type: "string",
        enum: ["active", "exhausted", "expired", "cancelled"],
      },
      paymentId: { type: "string" },
      subject: { type: "string" },
      preferredTeacherId: { type: "string" },
      recurringSchedule: {
        type: "object",
        properties: {
          dayOfWeek: { type: "number" },
          hour: { type: "number" },
          minute: { type: "number" },
        },
      },
    },
    required: ["guardianId", "studentId", "totalCredits", "remainingCredits"],
  },
  searchFields: [],
  displayConfig: {
    listFields: ["studentId", "totalCredits", "remainingCredits", "status"],
    detailFields: ["studentId", "totalCredits", "remainingCredits", "usedCredits", "expiresAt", "status"],
  },
}
```

**Why these fields?**

- `recurringSchedule`: For automatic session scheduling
- `remainingCredits`/`usedCredits`: Track pack consumption
- `expiresAt`: Packs can expire

---

## Role and Policy Definitions

### Role: Admin

```typescript
{
  name: "admin",
  description: "Full access to all operations",
  isSystem: false,
  policies: [
    { resource: "*", action: "*", effect: "allow" },
  ],
}
```

**Why**: Admins see and do everything. Wildcard policies.

### Role: Teacher

```typescript
{
  name: "teacher",
  description: "Tutors who conduct sessions",
  isSystem: false,
  policies: [
    { resource: "session", action: "list", effect: "allow" },
    { resource: "session", action: "read", effect: "allow" },
    { resource: "session", action: "update", effect: "allow" },
    { resource: "student", action: "read", effect: "allow" },
    { resource: "teacher", action: "read", effect: "allow" },
    { resource: "teacher", action: "update", effect: "allow" },
  ],
}
```

**Why**:
- Teachers can list/read sessions (scoped to their own)
- Teachers can update sessions (for notes, status changes)
- Teachers can read student info (limited fields)
- Teachers can read/update their own teacher profile

### Role: Guardian

```typescript
{
  name: "guardian",
  description: "Parents/guardians who manage students and payments",
  isSystem: false,
  policies: [
    { resource: "session", action: "list", effect: "allow" },
    { resource: "session", action: "read", effect: "allow" },
    { resource: "student", action: "read", effect: "allow" },
    { resource: "student", action: "update", effect: "allow" },
    { resource: "guardian", action: "read", effect: "allow" },
    { resource: "guardian", action: "update", effect: "allow" },
    { resource: "payment", action: "list", effect: "allow" },
    { resource: "payment", action: "read", effect: "allow" },
    { resource: "entitlement", action: "list", effect: "allow" },
    { resource: "entitlement", action: "read", effect: "allow" },
  ],
}
```

**Why**:
- Guardians can see their children's sessions
- Guardians can update student info
- Guardians can see their payments and entitlements
- Guardians cannot create/delete (handled by system)

---

## Scope Rule Definitions

### Teacher Session Scope

```typescript
{
  roleId: teacherRoleId,
  entityTypeId: sessionTypeId,
  type: "field_match",
  fieldPath: "data.teacherId",
  operator: "eq",
  valuePath: "actor.userId",
}
```

**Effect**: Teachers only see sessions where `teacherId == their user ID`.

### Teacher Self Scope

```typescript
{
  roleId: teacherRoleId,
  entityTypeId: teacherTypeId,
  type: "field_match",
  fieldPath: "data.userId",
  operator: "eq",
  valuePath: "actor.userId",
}
```

**Effect**: Teachers only see their own teacher profile.

### Guardian Session Scope

```typescript
{
  roleId: guardianRoleId,
  entityTypeId: sessionTypeId,
  type: "field_match",
  fieldPath: "data.guardianId",
  operator: "eq",
  valuePath: "actor.userId",
}
```

**Effect**: Guardians only see sessions for their students.

### Guardian Student Scope

```typescript
{
  roleId: guardianRoleId,
  entityTypeId: studentTypeId,
  type: "field_match",
  fieldPath: "data.guardianId",
  operator: "eq",
  valuePath: "actor.userId",
}
```

**Effect**: Guardians only see their own students.

---

## Field Mask Definitions

### Teacher Session Mask

```typescript
{
  roleId: teacherRoleId,
  entityTypeId: sessionTypeId,
  mode: "whitelist",
  fields: [
    "_id",
    "status",
    "data.studentId",
    "data.startTime",
    "data.duration",
    "data.subject",
    "data.meetingLink",
    "data.status",
    "data.teacherNotes",
    "data.reportSubmitted",
    "data.reportContent",
  ],
}
```

**What's hidden from teachers**:
- `guardianId` (no direct contact)
- `paymentId`, `entitlementId` (payment info)
- `guardianNotes` (private to guardian/admin)
- `cancellationReason`, `cancelledBy` (admin context)

### Teacher Student Mask

```typescript
{
  roleId: teacherRoleId,
  entityTypeId: studentTypeId,
  mode: "whitelist",
  fields: [
    "_id",
    "data.name",
    "data.grade",
    "data.subjects",
  ],
}
```

**What's hidden from teachers**:
- `notes` (internal notes)
- `guardianId` (no direct contact info)

### Guardian Session Mask

```typescript
{
  roleId: guardianRoleId,
  entityTypeId: sessionTypeId,
  mode: "whitelist",
  fields: [
    "_id",
    "status",
    "data.teacherId",
    "data.studentId",
    "data.startTime",
    "data.duration",
    "data.subject",
    "data.meetingLink",
    "data.status",
    "data.guardianNotes",
  ],
}
```

**What's hidden from guardians**:
- `teacherNotes` (teacher-only)
- `reportContent` (may contain teacher feedback not yet shared)

---

## Scheduling Logic

### Constraint: Minimum Booking Lead Time

Sessions cannot be booked less than 24 hours in advance.

```typescript
function validateBookingTime(startTime: number): void {
  const now = Date.now()
  const leadTimeMs = startTime - now
  const minLeadTimeMs = 24 * 60 * 60 * 1000

  if (leadTimeMs < minLeadTimeMs) {
    throw new Error("Sessions must be booked at least 24 hours in advance")
  }
}
```

**Why**: Teachers need prep time. Prevents last-minute chaos.

### Constraint: Reschedule Cutoff

Sessions can only be rescheduled up to 2 hours before start time.

```typescript
function validateReschedule(session: Session): void {
  const now = Date.now()
  const timeUntilStart = session.startTime - now
  const cutoffMs = 2 * 60 * 60 * 1000

  if (timeUntilStart < cutoffMs) {
    throw new Error("Sessions can only be rescheduled up to 2 hours before start time")
  }
}
```

**Why**: Prevents no-shows being converted to reschedules.

### Constraint: Teacher Availability

Sessions can only be booked during teacher's available slots.

```typescript
function validateTeacherAvailability(
  teacher: Teacher,
  startTime: number,
  duration: number
): void {
  const date = new Date(startTime)
  const dayOfWeek = date.getDay()
  const startHour = date.getHours()
  const endHour = startHour + Math.ceil(duration / 60)

  const availableSlot = teacher.availability?.find(
    (slot) =>
      slot.dayOfWeek === dayOfWeek &&
      slot.startHour <= startHour &&
      slot.endHour >= endHour
  )

  if (!availableSlot) {
    throw new Error("Teacher is not available at this time")
  }
}
```

### Constraint: No Double Booking

Teachers cannot have overlapping sessions.

```typescript
async function validateNoOverlap(
  ctx: QueryCtx,
  teacherId: string,
  startTime: number,
  duration: number,
  excludeSessionId?: Id<"entities">
): Promise<void> {
  const endTime = startTime + duration * 60 * 1000

  const teacherSessions = await ctx.db
    .query("entities")
    .withIndex("by_org", (q) => q.eq("organizationId", ctx.organizationId))
    .filter((q) =>
      q.and(
        q.eq(q.field("data.teacherId"), teacherId),
        q.neq(q.field("data.status"), "cancelled"),
        q.neq(q.field("_id"), excludeSessionId)
      )
    )
    .collect()

  for (const session of teacherSessions) {
    const sessionStart = session.data.startTime
    const sessionEnd = sessionStart + session.data.duration * 60 * 1000

    if (startTime < sessionEnd && endTime > sessionStart) {
      throw new Error("Teacher already has a session at this time")
    }
  }
}
```

### Pack Consumption

When a session is completed, deduct from entitlement.

```typescript
async function consumeCredit(
  ctx: MutationCtx,
  sessionId: Id<"entities">,
  entitlementId: Id<"entities">
): Promise<void> {
  const entitlement = await ctx.db.get(entitlementId)
  if (!entitlement) {
    throw new Error("Entitlement not found")
  }

  if (entitlement.data.remainingCredits <= 0) {
    throw new Error("No remaining credits")
  }

  await ctx.db.patch(entitlementId, {
    data: {
      ...entitlement.data,
      remainingCredits: entitlement.data.remainingCredits - 1,
      usedCredits: (entitlement.data.usedCredits || 0) + 1,
    },
    updatedAt: Date.now(),
  })

  if (entitlement.data.remainingCredits - 1 === 0) {
    await ctx.db.patch(entitlementId, {
      status: "exhausted",
    })
  }
}
```

---

## Workflow Jobs

### Job: Session Reminder

Send reminder 20 hours before session.

```typescript
{
  type: "session.reminder",
  payload: {
    sessionId: Id<"entities">,
    reminderType: "guardian" | "teacher",
  },
}
```

**Handler logic**:
1. Load session
2. Check session status (only send if still scheduled)
3. Load guardian or teacher
4. Queue WhatsApp template message (Phase 5)

**Scheduling**:
When session is created, schedule reminder:
```typescript
const reminderTime = session.startTime - (20 * 60 * 60 * 1000)
await enqueueJob(ctx, actor, {
  type: "session.reminder",
  payload: { sessionId, reminderType: "guardian" },
  scheduledFor: reminderTime,
  idempotencyKey: `reminder-guardian-${sessionId}`,
})
```

### Job: Post-Session Follow-Up

After session completion, send follow-up.

```typescript
{
  type: "session.followup",
  payload: {
    sessionId: Id<"entities">,
    followupType: "trial" | "pack",
  },
}
```

**Handler logic**:
1. Load session and related entities
2. If trial: prompt to purchase pack
3. If pack: check remaining credits, prompt if low

### Job: Entitlement Expiry Warning

Warn when pack is about to expire.

```typescript
{
  type: "entitlement.expiry_warning",
  payload: {
    entitlementId: Id<"entities">,
    daysRemaining: number,
  },
}
```

---

## Session Lifecycle

```
                    ┌─────────────────┐
                    │ pending_payment │
                    └────────┬────────┘
                             │ payment.success
                             ▼
                    ┌─────────────────┐
        ┌───────────│   scheduled     │───────────┐
        │           └────────┬────────┘           │
        │ cancel              │ start_time        │ cancel
        │                     │ reached           │
        ▼                     ▼                   ▼
┌───────────────┐    ┌─────────────────┐   ┌───────────────┐
│   cancelled   │    │   in_progress   │   │   no_show     │
└───────────────┘    └────────┬────────┘   └───────────────┘
                              │ teacher
                              │ marks complete
                              ▼
                     ┌─────────────────┐
                     │    completed    │
                     └─────────────────┘
```

**Status transition rules**:
- `pending_payment` → `scheduled`: Only when payment succeeds
- `scheduled` → `cancelled`: By guardian (before cutoff) or admin
- `scheduled` → `no_show`: Automatically if not started after grace period
- `scheduled` → `in_progress`: When session time arrives
- `in_progress` → `completed`: When teacher submits report

---

## Agent System Prompt Template

Example tutoring agent prompt:

```
You are a tutoring operations assistant for {{org.name}}.

Your role is to help schedule sessions, answer questions, and assist with operational tasks.

## Current Context

Today's date: {{datetime}}

## Upcoming Sessions

{{entity.query({ type: "session", filters: { status: "scheduled" } }) | formatSessionList}}

## Available Tools

- entity.query: Search for sessions, students, teachers
- entity.create: Create new sessions (with scheduling validation)
- entity.update: Update session details, submit reports

## Important Rules

1. Sessions must be booked at least 24 hours in advance
2. Teachers can only be booked during their available hours
3. Pack credits must be available before scheduling
4. Always confirm availability before booking
```

**Note**: The `entity.query` call uses the actor's permissions. If a teacher is using the agent, they only see their sessions.

---

## Testing Strategy

### Entity Type Tests

1. **Create all entity types**
   - Install tutoring pack
   - Verify 6 entity types created

2. **Entity validation**
   - Create session with invalid status
   - Assert validation error

### Permission Tests

1. **Teacher sees only own sessions**
   - Create sessions for multiple teachers
   - Query as teacher A
   - Assert only teacher A's sessions

2. **Teacher doesn't see payment info**
   - Create session with payment link
   - Query as teacher
   - Assert paymentId, paymentLinkUrl not in result

3. **Guardian sees only their students' sessions**
   - Create sessions for multiple guardians
   - Query as guardian A
   - Assert only guardian A's sessions

### Scheduling Tests

1. **Reject booking within 24 hours**
   - Attempt to book session starting in 12 hours
   - Assert error

2. **Reject double booking**
   - Book session for teacher at 3pm
   - Attempt to book same teacher at 3pm
   - Assert error

3. **Pack credit deduction**
   - Create entitlement with 4 credits
   - Complete session
   - Assert remaining credits = 3

### Workflow Tests

1. **Reminder job scheduled**
   - Create session
   - Assert reminder job exists with correct time

2. **Reminder not sent for cancelled session**
   - Cancel session
   - Process reminder job
   - Assert no message sent

---

## Success Criteria

Phase 4 is complete when:

1. ✅ All 6 entity types are defined and installable
2. ✅ All 3 roles have correct policies
3. ✅ Scope rules filter sessions by teacher/guardian
4. ✅ Field masks hide sensitive data per role
5. ✅ Scheduling constraints are enforced
6. ✅ Pack credit consumption works
7. ✅ Reminder jobs are scheduled and execute
8. ✅ Session lifecycle transitions work
9. ✅ Agent can perform operations with correct permissions

---

## Files Created/Modified

| Path | Changes |
|------|---------|
| `platform/convex/packs/tutoring.ts` | Complete entity types, roles, policies |
| `platform/convex/lib/scheduling.ts` | NEW: Scheduling validation logic |
| `platform/convex/lib/workflows/session.ts` | NEW: Session workflow logic |
| `platform/convex/jobs/sessionReminder.ts` | NEW: Reminder job handler |
| `platform/convex/jobs/sessionFollowup.ts` | NEW: Follow-up job handler |

---

## What's Next: Phase 5

Phase 5 adds external integrations:

- **WhatsApp**: Template messaging, window tracking
- **Payments**: Flow integration, webhook handling
- **Calendar**: Meeting link generation

See [06-phase-5-integrations.md](./06-phase-5-integrations.md) for details.
