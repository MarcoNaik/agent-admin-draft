---
title: "defineTrigger"
description: "Define event-driven automation rules"
section: "SDK"
order: 5
---

# defineTrigger

The `defineTrigger` function creates event-driven automation rules that fire when entities are created, updated, or deleted. Each trigger is defined in its own file under the `triggers/` directory.

```typescript
import { defineTrigger } from 'struere'

export default defineTrigger({
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
        payload: { teacher: "{{steps.teacher.data.name}}" },
      },
    },
  ],
})
```

## TriggerConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Display name for the trigger |
| `slug` | `string` | Yes | Unique identifier for the trigger |
| `description` | `string` | No | Human-readable description |
| `on` | `object` | Yes | Event configuration that activates the trigger |
| `on.entityType` | `string` | Yes | Entity type slug to watch |
| `on.action` | `'created' \| 'updated' \| 'deleted'` | Yes | Entity lifecycle event |
| `on.condition` | `object` | No | Optional filter on entity data fields |
| `schedule` | `TriggerSchedule` | No | Delay or schedule execution for a future time |
| `retry` | `TriggerRetry` | No | Retry configuration for failed executions |
| `actions` | `TriggerAction[]` | Yes | Ordered list of steps to execute (at least one required) |

### Validation

`defineTrigger` throws errors if:

- `name`, `slug`, or `on` is missing
- `on.entityType` is missing
- `on.action` is not one of `"created"`, `"updated"`, `"deleted"`
- `actions` is empty or missing
- Any action is missing `tool` or has non-object `args`
- `schedule.delay` and `schedule.at` are both set
- `schedule.delay` is not a positive number
- `retry.maxAttempts` is less than 1
- `retry.backoffMs` is not a positive number

## TriggerAction

Each action step executes a tool with the given arguments.

```typescript
interface TriggerAction {
  tool: string
  args: Record<string, unknown>
  as?: string
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tool` | `string` | Any built-in tool (e.g., `entity.create`, `whatsapp.send`, `agent.chat`) or custom tool name |
| `args` | `object` | Arguments passed to the tool, supports template variables |
| `as` | `string` | Optional name for referencing this step's result in later steps |

Actions execute in order. If any action fails, the trigger stops (fail-fast behavior).

### Available Tools

| Category | Tools |
|----------|-------|
| Entity | `entity.create`, `entity.get`, `entity.query`, `entity.update`, `entity.delete`, `entity.link`, `entity.unlink` |
| Event | `event.emit`, `event.query` |
| Calendar | `calendar.list`, `calendar.create`, `calendar.update`, `calendar.delete`, `calendar.freeBusy` |
| WhatsApp | `whatsapp.send`, `whatsapp.sendTemplate`, `whatsapp.sendInteractive`, `whatsapp.sendMedia`, `whatsapp.listTemplates`, `whatsapp.getConversation`, `whatsapp.getStatus` |
| Agent | `agent.chat` |
| Custom | Any custom tool defined in the `tools/` directory |

## Template Variables

Trigger action arguments support `{{variable}}` template syntax for dynamic value resolution.

### Trigger Context Variables

| Variable | Description |
|----------|-------------|
| `{{trigger.entityId}}` | ID of the entity that triggered the event |
| `{{trigger.entityType}}` | Entity type slug |
| `{{trigger.action}}` | The action that occurred (`"created"`, `"updated"`, `"deleted"`) |
| `{{trigger.data.X}}` | Field `X` from the entity's current data |
| `{{trigger.previousData.X}}` | Field `X` from the entity's data before the update (only for `"updated"` actions) |

### Step Reference Variables

| Variable | Description |
|----------|-------------|
| `{{steps.NAME.X}}` | Access field `X` from the result of step named `NAME` (set via `as` field) |

### Template Example

```typescript
actions: [
  {
    tool: "entity.get",
    args: { id: "{{trigger.data.teacherId}}" },
    as: "teacher",
  },
  {
    tool: "entity.get",
    args: { id: "{{trigger.data.guardianId}}" },
    as: "guardian",
  },
  {
    tool: "event.emit",
    args: {
      eventType: "session.booked",
      entityId: "{{trigger.entityId}}",
      payload: {
        teacherName: "{{steps.teacher.data.name}}",
        guardianName: "{{steps.guardian.data.name}}",
      },
    },
  },
]
```

## Conditions

The `on.condition` field filters which entity mutations trigger the actions. Only entities whose data matches all condition fields will activate the trigger:

```typescript
on: {
  entityType: "session",
  action: "updated",
  condition: { "data.status": "completed" },
}
```

This trigger only fires when a session is updated and its `status` field is `"completed"`.

## Scheduled Triggers

Triggers can be scheduled to run at a future time instead of executing immediately.

```typescript
interface TriggerSchedule {
  delay?: number
  at?: string
  offset?: number
  cancelPrevious?: boolean
}
```

| Field | Type | Description |
|-------|------|-------------|
| `delay` | `number` | Delay in milliseconds before execution |
| `at` | `string` | Template expression resolving to an ISO timestamp or Unix timestamp |
| `offset` | `number` | Offset in milliseconds to add to the `at` time (can be negative) |
| `cancelPrevious` | `boolean` | Cancel any pending scheduled run for the same entity before scheduling |

`delay` and `at` are mutually exclusive.

### Schedule Examples

Send a reminder 1 hour before a session starts:

```typescript
export default defineTrigger({
  name: "Session Reminder",
  slug: "session-reminder",
  on: {
    entityType: "session",
    action: "created",
    condition: { "data.status": "scheduled" },
  },
  schedule: {
    at: "{{trigger.data.startTime}}",
    offset: -3600000,
    cancelPrevious: true,
  },
  actions: [
    {
      tool: "entity.get",
      args: { id: "{{trigger.data.guardianId}}" },
      as: "guardian",
    },
    {
      tool: "event.emit",
      args: {
        eventType: "session.reminder",
        entityId: "{{trigger.entityId}}",
        payload: { guardianName: "{{steps.guardian.data.name}}" },
      },
    },
  ],
})
```

Delay notification by 5 minutes:

```typescript
schedule: {
  delay: 300000,
}
```

### Trigger Runs

Scheduled triggers create records in the `triggerRuns` table with status tracking:

| Status | Description |
|--------|-------------|
| `pending` | Scheduled but not yet executed |
| `running` | Currently executing |
| `completed` | Successfully finished |
| `failed` | Failed but may be retried |
| `dead` | Failed and exhausted all retry attempts |

## Retry Configuration

Failed triggers can be retried with exponential backoff.

```typescript
interface TriggerRetry {
  maxAttempts?: number
  backoffMs?: number
}
```

| Field | Type | Description |
|-------|------|-------------|
| `maxAttempts` | `number` | Maximum number of retry attempts (minimum 1) |
| `backoffMs` | `number` | Base delay in milliseconds between retries |

```typescript
retry: {
  maxAttempts: 3,
  backoffMs: 5000,
}
```

This retries up to 3 times with 5-second base backoff between attempts.

## Execution Behavior

- Triggers execute **asynchronously** (scheduled after the originating mutation completes)
- Triggers run as the **system actor** with full permissions
- Actions execute in **fail-fast** order (first failure stops the chain)
- Successful triggers emit a `trigger.executed` event
- Failed triggers emit a `trigger.failed` event
- Triggers fire from **all mutation sources**: dashboard CRUD, agent tool calls, and API mutations

## Full Examples

### Notify Guardian on Session Completion

```typescript
import { defineTrigger } from 'struere'

export default defineTrigger({
  name: "Notify on Completion",
  slug: "notify-on-completion",
  on: {
    entityType: "session",
    action: "updated",
    condition: { "data.status": "completed" },
  },
  actions: [
    {
      tool: "entity.get",
      args: { id: "{{trigger.data.guardianId}}" },
      as: "guardian",
    },
    {
      tool: "event.emit",
      args: {
        eventType: "session.completed",
        entityId: "{{trigger.entityId}}",
        payload: {
          guardianName: "{{steps.guardian.data.name}}",
          subject: "{{trigger.data.subject}}",
        },
      },
    },
  ],
})
```

### Auto-Deduct Credits on Completion

```typescript
import { defineTrigger } from 'struere'

export default defineTrigger({
  name: "Deduct Credits",
  slug: "deduct-credits",
  on: {
    entityType: "session",
    action: "updated",
    condition: { "data.status": "completed" },
  },
  retry: {
    maxAttempts: 3,
    backoffMs: 2000,
  },
  actions: [
    {
      tool: "entity.query",
      args: {
        type: "entitlement",
        filters: { "data.studentId": "{{trigger.data.studentId}}" },
        limit: 1,
      },
      as: "entitlements",
    },
    {
      tool: "event.emit",
      args: {
        eventType: "credits.deducted",
        entityId: "{{trigger.entityId}}",
        payload: {
          studentId: "{{trigger.data.studentId}}",
        },
      },
    },
  ],
})
```

### Scheduled Follow-Up

```typescript
import { defineTrigger } from 'struere'

export default defineTrigger({
  name: "Post-Session Follow-Up",
  slug: "post-session-followup",
  on: {
    entityType: "session",
    action: "updated",
    condition: { "data.status": "completed" },
  },
  schedule: {
    delay: 86400000,
  },
  retry: {
    maxAttempts: 2,
    backoffMs: 60000,
  },
  actions: [
    {
      tool: "event.emit",
      args: {
        eventType: "session.followup",
        entityId: "{{trigger.entityId}}",
        payload: {
          teacherId: "{{trigger.data.teacherId}}",
          studentId: "{{trigger.data.studentId}}",
        },
      },
    },
  ],
})
```
