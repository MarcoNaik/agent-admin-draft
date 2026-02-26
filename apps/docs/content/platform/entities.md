---
title: "Data"
description: "Domain data with permission-aware CRUD operations"
section: "Platform Concepts"
order: 1
---

# Data

Data is the primary data model in Struere. It represents domain objects (teachers, students, sessions, payments) with typed schemas, environment isolation, full-text search, and permission-aware CRUD operations.

## Data Types

Data types define the schema for a category of data. They are created using the `defineEntityType` SDK function and synced to the platform.

Each data type specifies:

- **Schema**: JSON Schema defining the data structure
- **Search fields**: Fields indexed for text search
- **Display config**: How records appear in the dashboard

Data types are scoped per environment using the `by_org_env_slug` index, so development and production can have different schemas.

### Data Type Schema in the Database

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | ID | Owning organization |
| `environment` | enum | `"development"` or `"production"` |
| `name` | string | Display name |
| `slug` | string | Unique identifier within org + environment |
| `schema` | object | JSON Schema definition |
| `searchFields` | array | Fields indexed for search |
| `displayConfig` | object | Dashboard display options |
| `boundToRole` | string | Role binding for user linking |
| `userIdField` | string | Field storing Clerk user ID |

## Records

Records are instances of a data type. Each record stores its data as a flexible JSON object that conforms to the data type's schema.

### Record Schema in the Database

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | ID | Owning organization |
| `environment` | enum | `"development"` or `"production"` |
| `entityTypeId` | ID | Reference to data type |
| `data` | object | Record data conforming to the type's JSON Schema |
| `status` | string | Lifecycle status (e.g., `"active"`, `"deleted"`) |
| `createdAt` | number | Creation timestamp |
| `updatedAt` | number | Last update timestamp |

### Environment Scoping

All data queries are scoped to the current environment using the `by_org_env_type` and `by_org_env_type_status` indexes. An agent running in the development environment cannot access production data.

## CRUD Operations

All data operations are permission-aware, flowing through the permission engine before executing.

### Create

```typescript
entity.create({
  type: "session",
  data: {
    teacherId: "ent_abc123",
    studentId: "ent_def456",
    guardianId: "ent_ghi789",
    startTime: 1700000000000,
    duration: 60,
    subject: "Mathematics",
    status: "scheduled",
  },
})
```

Creates a record and emits an event. The actor must have `create` permission on the data type.

### Read

```typescript
entity.get({ id: "ent_abc123" })
```

Retrieves a single record by ID. The response is filtered through field masks based on the actor's role, hiding or redacting fields the actor should not see.

### Query

```typescript
entity.query({
  type: "session",
  filters: { "data.status": "scheduled" },
  limit: 10,
})
```

Queries records by type with optional filters. Scope rules are applied automatically, so a teacher only sees their own sessions and a guardian only sees sessions for their children.

### Update

```typescript
entity.update({
  id: "ent_abc123",
  data: { status: "completed", teacherReport: "Great progress in algebra." },
})
```

Updates record data and emits an event. The actor must have `update` permission.

### Delete

```typescript
entity.delete({ id: "ent_abc123" })
```

Performs a soft delete (sets status to `"deleted"`) and emits an event. The actor must have `delete` permission.

## Relations

Records can be linked to each other through the `entityRelations` table. Relations are typed and directional.

### Link

```typescript
entity.link({
  fromEntityId: "ent_abc123",
  toEntityId: "ent_def456",
  relationType: "enrolled_in",
})
```

### Unlink

```typescript
entity.unlink({
  fromEntityId: "ent_abc123",
  toEntityId: "ent_def456",
  relationType: "enrolled_in",
})
```

### Environment Filtering

The `entityRelations` table indexes (`by_from` and `by_to`) do not include the environment field. All relation queries apply a post-index filter to ensure environment isolation:

```typescript
.filter((q) => q.eq(q.field("environment"), environment))
```

## Search

Data types define `searchFields` that are indexed for text search. The `entity.query` tool supports searching across these fields:

```typescript
entity.query({
  type: "teacher",
  filters: { search: "mathematics" },
  limit: 5,
})
```

This searches across all fields listed in the data type's `searchFields` array.

## Permission Flow for Data

Every data operation passes through the full permission pipeline:

```
Actor makes request
    │
    ▼
1. Permission Check
   Does the actor's role have a policy allowing this action
   on this data type? (deny overrides allow)
    │
    ▼
2. Scope Rules (row-level)
   Filter query results to only records the actor
   is allowed to see (e.g., teacher sees own sessions)
    │
    ▼
3. Field Masks (column-level)
   Hide or redact fields the actor should not access
   (e.g., teacher cannot see paymentId)
    │
    ▼
Filtered response returned
```

## Tutoring Domain Example

The tutoring pack defines 6 data types that demonstrate the full data system:

| Data Type | Key Fields | Relationships |
|-----------|------------|---------------|
| `teacher` | name, email, subjects, availability, hourlyRate, userId | Linked to sessions |
| `student` | name, grade, subjects, notes, guardianId, preferredTeacherId | Linked to guardian |
| `guardian` | name, email, phone, whatsappNumber, billingAddress, userId | Parent of students |
| `session` | teacherId, studentId, guardianId, startTime, duration, status | Links teacher, student, guardian |
| `payment` | guardianId, amount, status, providerReference, sessionId | Linked to session |
| `entitlement` | guardianId, studentId, totalCredits, remainingCredits, expiresAt | Credits for sessions |

### Session Lifecycle

Sessions follow a defined state machine:

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
- Credit consumption on session completion
