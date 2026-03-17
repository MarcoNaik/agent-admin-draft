---
title: "Events"
description: "Audit logging and event-driven architecture"
section: "Platform Concepts"
order: 4
---

# Events

Events provide a complete audit trail of all mutations in the Struere platform. The platform automatically emits events whenever entities are created, updated, or deleted. Every mutation is recorded with full actor context, enabling compliance tracking, debugging, and event-driven automation.

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

All events are system-generated. The platform automatically emits events when mutations occur.

### Entity Lifecycle Events

| Event Type | Trigger |
|------------|---------|
| `{type}.created` | An entity of the given type is created (e.g., `session.created`, `teacher.created`) |
| `{type}.updated` | An entity's data or status is modified |
| `{type}.deleted` | An entity is soft-deleted |

### Payment Events

| Event Type | Trigger |
|------------|---------|
| `payment.created` | A payment entity is created |
| `payment.paid` | A payment is confirmed via webhook or reconciliation |
| `payment.failed` | A payment is rejected or cancelled |
| `payment.link_created` | A payment link is generated |

### Trigger Execution Events

| Event Type | Trigger |
|------------|---------|
| `trigger.executed` | An automation completes successfully |
| `trigger.failed` | An automation fails during execution |

## Event Sources

Events are emitted automatically from all mutation sources:

| Source | Description |
|--------|-------------|
| Dashboard CRUD | User actions in the admin dashboard |
| Agent tool calls | Built-in tools like `entity.create`, `entity.update`, `entity.delete` |
| API mutations | External API calls via HTTP endpoints |
| Webhooks | External services like payment providers updating entity state |

All sources capture the actor context, so events always record who performed the action.

## Environment Scoping

Events are scoped to the environment where they were emitted. Development events are only visible in the development environment, and production events only in production.

Events are indexed by `by_org_env_type` for efficient querying by organization, environment, and event type.

## Event Payloads

Event payloads contain event-specific data. The payload typically includes the entity data at the time of the event:

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

## Viewing Events

Events are visible in the dashboard under the **Events** tab. You can filter by event type, entity, and time range to inspect the audit trail for any record.

## Events and Automations

Events serve as the input for the automation system. When a data mutation emits an event, matching automations are activated:

```
Entity mutation occurs
    │
    ▼
System event emitted ({type}.created, {type}.updated, etc.)
    │
    ▼
Automation engine checks for matching automations
    │
    ▼
Matching automations scheduled for execution
    │
    ▼
Automation actions execute
```

Automations are defined using [`defineTrigger`](/sdk/define-trigger) and fire based on entity lifecycle events. See [Automations](/sdk/define-trigger) for details.
