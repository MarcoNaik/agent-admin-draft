---
title: "Automations"
description: "Automated workflows triggered by data changes"
section: "Platform Concepts"
order: 3
---

# Automations

Automations are automated workflows that execute when data is created, updated, or deleted. They enable event-driven architecture by running a sequence of tool calls in response to data mutations, without requiring manual intervention.

## How Automations Work

When a mutation occurs (from the dashboard, an agent tool call, or an API request), the automation engine checks for matching automations and schedules them for execution:

```
Data mutation (create/update/delete)
    │
    ▼
Automation engine scans for matching automations
    │
    ├─ Match on entityType
    ├─ Match on action (created/updated/deleted)
    └─ Match on condition (optional data filter)
    │
    ▼
Matched automations scheduled asynchronously
    │
    ▼
Actions execute in order (fail-fast)
    │
    ├─ Success → trigger.executed event emitted
    └─ Failure → trigger.failed event emitted (retry if configured)
```

### Execution Characteristics

| Property | Behavior |
|----------|----------|
| Timing | Asynchronous (scheduled after the originating mutation completes) |
| Actor | Runs as the **system actor** with full permissions |
| Error handling | **Fail-fast** (first action failure stops the chain) |
| Success event | Emits `trigger.executed` |
| Failure event | Emits `trigger.failed` |
| Sources | Fires from dashboard CRUD, agent tool calls, and API mutations |

## Immediate Automations

By default, automations execute as soon as they are scheduled (immediately after the originating mutation). The actions run in sequence:

```typescript
{
  name: "Notify on New Session",
  slug: "notify-on-session",
  on: {
    entityType: "session",
    action: "created",
    condition: { "data.status": "scheduled" },
  },
  actions: [
    {
      tool: "entity.get",
      args: { id: "{{trigger.data.teacherId}}" },
      as: "teacher",
    },
    {
      tool: "event.emit",
      args: {
        eventType: "session.notification",
        entityId: "{{trigger.entityId}}",
        payload: { teacherName: "{{steps.teacher.data.name}}" },
      },
    },
  ],
}
```

## Scheduled Automations

Automations can be delayed or scheduled for a specific time using the `schedule` field:

### Delay-Based

Execute after a fixed delay:

```typescript
schedule: {
  delay: 300000,
}
```

This runs the automation 5 minutes after the data mutation.

### Time-Based

Execute at a specific time derived from the data:

```typescript
schedule: {
  at: "{{trigger.data.startTime}}",
  offset: -3600000,
}
```

This schedules the automation for 1 hour before the session's `startTime`. The `at` field supports template expressions that resolve to an ISO timestamp or Unix timestamp.

### Cancel Previous

When a record is updated multiple times, `cancelPrevious` ensures only the latest scheduled run is kept:

```typescript
schedule: {
  at: "{{trigger.data.startTime}}",
  offset: -3600000,
  cancelPrevious: true,
}
```

If a session's start time is changed, the old reminder is cancelled and a new one is scheduled.

## Automation Runs

Scheduled automations create records in the `triggerRuns` table for status tracking.

### Status Lifecycle

```
pending ──► running ──► completed
                │
                ▼
             failed ──► running (retry) ──► completed
                │
                ▼
              dead (retries exhausted)
```

| Status | Description |
|--------|-------------|
| `pending` | Scheduled but not yet executed |
| `running` | Currently executing actions |
| `completed` | All actions finished successfully |
| `failed` | An action failed (may be retried) |
| `dead` | Failed and exhausted all retry attempts |

### Automation Run Fields

| Field | Type | Description |
|-------|------|-------------|
| `triggerId` | ID | Reference to the automation definition |
| `triggerSlug` | string | Slug of the automation definition |
| `entityId` | string | Record that triggered the run |
| `status` | enum | Current lifecycle status |
| `data` | object | Record data at time of activation |
| `previousData` | object | Record data before the mutation (for updates) |
| `scheduledFor` | number | When the run is scheduled to execute |
| `startedAt` | number | When execution began |
| `completedAt` | number | When execution finished |
| `errorMessage` | string | Error message if failed |
| `attempts` | number | Current retry attempt count |
| `maxAttempts` | number | Maximum retry attempts configured |
| `backoffMs` | number | Base backoff delay in milliseconds |
| `result` | object | Execution result on completion |
| `environment` | enum | Scoped to development or production |

## Retry Configuration

Failed automations can be retried with backoff:

```typescript
retry: {
  maxAttempts: 3,
  backoffMs: 5000,
}
```

| Field | Type | Description |
|-------|------|-------------|
| `maxAttempts` | number | Maximum retry attempts (minimum 1) |
| `backoffMs` | number | Base delay in milliseconds between retries |

When an automation fails:

1. If `attempts < maxAttempts`, the run is rescheduled with exponential backoff: `backoffMs * 2^(attempts-1)`, capped at 1 hour
2. The status transitions back to `pending`
3. On the next attempt, it transitions to `running`
4. If all retries are exhausted, the status becomes `dead` and a `trigger.scheduled.dead` event is emitted

## Template Variable Resolution

Automation action arguments support template variables that are resolved at execution time.

### Automation Context

| Variable | Description |
|----------|-------------|
| `{{trigger.entityId}}` | ID of the record that activated the automation |
| `{{trigger.entityType}}` | Data type slug |
| `{{trigger.action}}` | The action: `"created"`, `"updated"`, or `"deleted"` |
| `{{trigger.data.X}}` | Field `X` from the record's current data |
| `{{trigger.previousData.X}}` | Field `X` from the record's data before an update |

### Step References

| Variable | Description |
|----------|-------------|
| `{{steps.NAME.X}}` | Field `X` from the result of a named step |

Steps are named using the `as` field on an automation action. Later actions can reference the result:

```typescript
actions: [
  {
    tool: "entity.get",
    args: { id: "{{trigger.data.guardianId}}" },
    as: "guardian",
  },
  {
    tool: "event.emit",
    args: {
      eventType: "notification",
      payload: { name: "{{steps.guardian.data.name}}" },
    },
  },
]
```

## Condition Matching

The `on.condition` field filters which mutations activate the automation. All condition fields must match for the automation to fire:

```typescript
on: {
  entityType: "session",
  action: "updated",
  condition: { "data.status": "completed" },
}
```

This automation only fires when a session record is updated and its `data.status` field equals `"completed"`.

Multiple conditions act as AND filters:

```typescript
condition: {
  "data.status": "scheduled",
  "data.subject": "Mathematics",
}
```

## Mutation Sources

Automations fire from all mutation sources in the platform:

| Source | Example |
|--------|---------|
| **Dashboard CRUD** | Admin creates a session via the UI |
| **Agent tool calls** | Agent uses `entity.create` to schedule a session |
| **API mutations** | External system calls the HTTP API |

This ensures that automated workflows execute regardless of how the mutation originated.

## Events

Automations emit events throughout their lifecycle:

| Event | When |
|-------|------|
| `trigger.executed` | Immediate automation completed successfully |
| `trigger.failed` | Immediate automation action failed |
| `trigger.scheduled.completed` | Scheduled automation run completed successfully |
| `trigger.scheduled.dead` | Scheduled automation run exhausted all retry attempts |

## Available Tools

Automations can execute any built-in tool and custom tools. Actions run as the **system actor** with full permissions.

### Core Tools

| Category | Tools |
|----------|-------|
| Data | `entity.create`, `entity.get`, `entity.query`, `entity.update`, `entity.delete`, `entity.link`, `entity.unlink` |
| Event | `event.emit`, `event.query` |
| Agent | `agent.chat` |

### Integration Tools

Require an active integration configured in the dashboard.

| Integration | Tools |
|-------------|-------|
| Google Calendar | `calendar.list`, `calendar.create`, `calendar.update`, `calendar.delete`, `calendar.freeBusy` |
| WhatsApp | `whatsapp.send`, `whatsapp.sendTemplate`, `whatsapp.sendInteractive`, `whatsapp.sendMedia`, `whatsapp.listTemplates`, `whatsapp.getConversation`, `whatsapp.getStatus` |
| Airtable | `airtable.listBases`, `airtable.listTables`, `airtable.listRecords`, `airtable.getRecord`, `airtable.createRecords`, `airtable.updateRecords`, `airtable.deleteRecords` |

### Custom Tools

Automations can also execute custom tools defined in the `tools/` directory. If the tool name doesn't match a built-in tool, the automation engine delegates to the custom tool executor. Custom tool handlers run in the sandboxed Hono server on Fly.io.

## Dashboard Management

The dashboard provides automation management at `/triggers`:

- View all configured automations
- See automation run history with status
- View scheduled (pending) runs
- Retry failed runs
- Cancel pending runs
