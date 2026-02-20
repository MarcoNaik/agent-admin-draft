---
title: "Events"
description: "Audit logging and event-driven architecture"
section: "Platform Concepts"
order: 4
---

# Events

Events provide a complete audit trail of all mutations in the Struere platform. Every entity creation, update, deletion, and custom action is recorded with full actor context, enabling compliance tracking, debugging, and event-driven automation.

## Event Structure

Each event captures the full context of what happened, who did it, and when:

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | ID | Owning organization |
| `environment` | enum | `"development"` or `"production"` |
| `eventType` | string | Category of the event (e.g., `"session.created"`, `"session.completed"`) |
| `entityId` | string | ID of the affected entity (optional for non-entity events) |
| `actorType` | string | `"user"`, `"agent"`, `"system"`, or `"webhook"` |
| `actorId` | string | ID of the actor who performed the action |
| `payload` | object | Event-specific data |
| `createdAt` | number | Unix timestamp of when the event occurred |

## Event Types

Events fall into two categories: system events emitted automatically by the platform, and custom events emitted explicitly by tools or triggers.

### System Events

These events are emitted automatically when entity mutations occur:

| Event Type | Trigger |
|------------|---------|
| `{type}.created` | An entity of the given type is created (e.g., `session.created`, `teacher.created`) |
| `{type}.updated` | An entity's data or status is modified |
| `{type}.deleted` | An entity is soft-deleted |
| `entity.linked` | A relation is created between two entities |
| `entity.unlinked` | A relation is removed between two entities |
| `trigger.executed` | A trigger completes successfully |
| `trigger.failed` | A trigger fails during execution |

### Custom Events

Custom events are emitted using the `event.emit` tool:

```typescript
event.emit({
  eventType: "session.reminder.sent",
  entityId: "ent_abc123",
  payload: {
    recipientType: "guardian",
    recipientId: "ent_def456",
    channel: "whatsapp",
  },
})
```

Custom event types follow a dot-notation naming convention (e.g., `"session.completed"`, `"payment.received"`, `"credits.deducted"`).

## Event Sources

Events are emitted from three mutation sources:

| Source | Description |
|--------|-------------|
| Dashboard CRUD | User actions in the admin dashboard |
| Agent tool calls | Built-in tools like `entity.create` and `event.emit` |
| API mutations | External API calls via HTTP endpoints |

All sources capture the actor context, so events always record who performed the action.

## Querying Events

Events can be queried using the `event.query` tool:

```typescript
event.query({
  eventType: "session.created",
  entityId: "ent_abc123",
  since: 1700000000000,
  limit: 50,
})
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventType` | string | Filter by event type |
| `entityId` | string | Filter by associated entity |
| `since` | number | Unix timestamp for lower bound |
| `limit` | number | Maximum number of events to return |

All parameters are optional. When multiple are provided, they act as AND filters.

## Visibility Filtering

Event queries are **visibility-filtered** based on the actor's permissions. An actor can only see events related to entities they have permission to access. This means:

- A teacher only sees events for their own sessions and assigned students
- A guardian only sees events related to their children
- An admin sees all events within the organization

The visibility filtering applies the same scope rules used for entity queries, ensuring consistent access control across the platform.

## Environment Scoping

Events are scoped to the environment where they were emitted. Development events are only visible in the development environment, and production events only in production.

Events are indexed by `by_org_env_type` for efficient querying by organization, environment, and event type.

## Event Payloads

Event payloads contain event-specific data. For system events, the payload typically includes the entity data at the time of the event:

### {type}.created Payload

```typescript
{
  entityType: "session",
  data: {
    teacherId: "ent_abc123",
    studentId: "ent_def456",
    startTime: 1700000000000,
    status: "scheduled",
  },
}
```

### {type}.updated Payload

```typescript
{
  entityType: "session",
  previousData: {
    status: "scheduled",
  },
  newData: {
    status: "completed",
    teacherReport: "Good progress.",
  },
}
```

### Custom Event Payload

Custom events can include any JSON-serializable payload:

```typescript
{
  message: "Session reminder sent",
  channel: "whatsapp",
  templateName: "session_reminder",
}
```

## Events and Triggers

Events serve as the input for the trigger system. When an entity mutation emits an event, matching triggers are activated:

```
Entity mutation occurs
    │
    ▼
System event emitted ({type}.created, {type}.updated, etc.)
    │
    ▼
Trigger engine checks for matching triggers
    │
    ▼
Matching triggers scheduled for execution
    │
    ▼
Trigger actions execute (may emit more events)
```

Triggers can also emit events via the `event.emit` tool in their action chains, creating observable side effects for other triggers or audit purposes.

