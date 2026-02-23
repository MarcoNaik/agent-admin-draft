---
title: "Google Calendar"
description: "Connect Google Calendar for scheduling, availability checks, and event management"
section: "Integrations"
order: 3
---

# Google Calendar

Struere integrates with Google Calendar through OAuth2, giving agents the ability to list, create, update, and delete calendar events and check availability.

## Setup

### 1. Connect Google Calendar

In the dashboard, navigate to **Integrations > Google Calendar** and click **Connect**. This initiates an OAuth2 flow with Google.

### 2. Grant permissions

Authorize Struere to access your Google Calendar. The connection is stored in the `calendarConnections` table, scoped to the current environment.

### 3. Add calendar tools to your agent

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Scheduler",
  slug: "scheduler",
  tools: [
    "calendar.list",
    "calendar.create",
    "calendar.update",
    "calendar.delete",
    "calendar.freeBusy",
    "entity.query",
  ],
  systemPrompt: `You are a scheduling assistant for {{organizationName}}.
Current time: {{currentTime}}

When booking:
1. Check availability with calendar.freeBusy
2. Create the event with calendar.create
3. Record the session entity with entity.create`,
  model: { provider: "xai", name: "grok-4-1-fast" },
})
```

## Available Tools

### calendar.list

List calendar events within a time range.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `timeMin` | `string` | No | Start of range (ISO 8601) |
| `timeMax` | `string` | No | End of range (ISO 8601) |
| `maxResults` | `number` | No | Maximum events to return |

### calendar.create

Create a new calendar event.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `summary` | `string` | Yes | Event title |
| `description` | `string` | No | Event description |
| `startTime` | `string` | Yes | Start time (ISO 8601) |
| `endTime` | `string` | No | End time (ISO 8601). Provide either `endTime` or `durationMinutes` |
| `durationMinutes` | `number` | No | Duration in minutes. Used if `endTime` is not provided |
| `attendees` | `string[]` | No | Email addresses of attendees |
| `location` | `string` | No | Event location |

### calendar.update

Update an existing calendar event.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `eventId` | `string` | Yes | Google Calendar event ID |
| `summary` | `string` | No | Updated title |
| `description` | `string` | No | Updated description |
| `startTime` | `string` | No | Updated start time |
| `endTime` | `string` | No | Updated end time |
| `attendees` | `string[]` | No | Updated attendees |

### calendar.delete

Delete a calendar event.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `eventId` | `string` | Yes | Google Calendar event ID |

### calendar.freeBusy

Check availability across calendars for a time range.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `timeMin` | `string` | Yes | Start of range (ISO 8601) |
| `timeMax` | `string` | Yes | End of range (ISO 8601) |

Returns busy time slots within the range, allowing agents to find open slots before booking.

## Common Patterns

### Booking with Availability Check

```
User: "Book a session with Alice on Tuesday at 2 PM"

Agent flow:
1. calendar.freeBusy — check if 2 PM Tuesday is available
2. If busy → suggest alternative times from the free slots
3. If free → calendar.create with the event details
4. entity.create — record the session in Struere
```

### Timezone Handling

All times are in ISO 8601 format. The Google Calendar API respects the timezone in the ISO string. If no timezone offset is provided, the calendar's default timezone is used.

```
"2025-03-15T14:00:00-05:00"  ← Eastern Time
"2025-03-15T14:00:00Z"        ← UTC
"2025-03-15T14:00:00+09:00"  ← Japan Standard Time
```

Instruct your agent about timezone expectations in the system prompt to avoid confusion.

## Environment Scoping

Calendar connections are environment-scoped. A connection created in development is not available in production. Connect Google Calendar separately in each environment where you need it.
