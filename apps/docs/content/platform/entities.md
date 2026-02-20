---
title: "Entities"
description: "Domain data with permission-aware CRUD operations"
section: "Platform Concepts"
order: 1
---

# Entities

Entities are the primary data model in Struere. They represent domain objects (teachers, students, sessions, payments) with typed schemas, environment isolation, full-text search, and permission-aware CRUD operations.

## Entity Types

Entity types define the schema for a category of entities. They are created using the `defineEntityType` SDK function and synced to the platform.

Each entity type specifies:

- **Schema**: JSON Schema defining the data structure
- **Search fields**: Fields indexed for text search
- **Display config**: How entities appear in the dashboard

Entity types are scoped per environment using the `by_org_env_slug` index, so development and production can have different schemas.

### Entity Type Schema in the Database

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

## Entities

Entities are instances of an entity type. Each entity stores its data as a flexible JSON object that conforms to the entity type's schema.

### Entity Schema in the Database

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | ID | Owning organization |
| `environment` | enum | `"development"` or `"production"` |
| `entityTypeId` | ID | Reference to entity type |
| `data` | object | Entity data conforming to the type's JSON Schema |
| `status` | string | Lifecycle status (e.g., `"active"`, `"deleted"`) |
| `createdAt` | number | Creation timestamp |
| `updatedAt` | number | Last update timestamp |

### Environment Scoping

All entity queries are scoped to the current environment using the `by_org_env_type` and `by_org_env_type_status` indexes. An agent running in the development environment cannot access production entities.

## CRUD Operations

All entity operations are permission-aware, flowing through the permission engine before executing.

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

Creates an entity and emits an event. The actor must have `create` permission on the entity type.

### Read

```typescript
entity.get({ id: "ent_abc123" })
```

Retrieves a single entity by ID. The response is filtered through field masks based on the actor's role, hiding or redacting fields the actor should not see.

### Query

```typescript
entity.query({
  type: "session",
  filters: { "data.status": "scheduled" },
  limit: 10,
})
```

Queries entities by type with optional filters. Scope rules are applied automatically, so a teacher only sees their own sessions and a guardian only sees sessions for their children.

### Update

```typescript
entity.update({
  id: "ent_abc123",
  data: { status: "completed", teacherReport: "Great progress in algebra." },
})
```

Updates entity data and emits an event. The actor must have `update` permission.

### Delete

```typescript
entity.delete({ id: "ent_abc123" })
```

Performs a soft delete (sets status to `"deleted"`) and emits an event. The actor must have `delete` permission.

## Relations

Entities can be linked to each other through the `entityRelations` table. Relations are typed and directional.

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

Entity types define `searchFields` that are indexed for text search. The `entity.query` tool supports searching across these fields:

```typescript
entity.query({
  type: "teacher",
  filters: { search: "mathematics" },
  limit: 5,
})
```

This searches across all fields listed in the entity type's `searchFields` array.

## Permission Flow for Entities

Every entity operation passes through the full permission pipeline:

```
Actor makes request
    │
    ▼
1. Permission Check
   Does the actor's role have a policy allowing this action
   on this entity type? (deny overrides allow)
    │
    ▼
2. Scope Rules (row-level)
   Filter query results to only entities the actor
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

The tutoring pack defines 6 entity types that demonstrate the full entity system:

| Entity Type | Key Fields | Relationships |
|-------------|------------|---------------|
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

