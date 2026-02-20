---
title: "Built-in Tools"
description: "Pre-built tools available to all agents"
section: "Tools"
order: 1
---

Struere provides a set of built-in tools that agents can use to interact with entities, events, calendars, WhatsApp, and other agents. All built-in tools are **permission-aware** — every invocation builds an `ActorContext` from the calling agent's identity and evaluates policies, scope rules, and field masks before returning results.

## Tool Reference

| Tool | Category | Description |
|------|----------|-------------|
| `entity.create` | Entity | Create a new entity of a specified type |
| `entity.get` | Entity | Retrieve a single entity by ID |
| `entity.query` | Entity | Query entities by type with optional filters |
| `entity.update` | Entity | Update an existing entity's data |
| `entity.delete` | Entity | Soft-delete an entity |
| `entity.link` | Entity | Create a relation between two entities |
| `entity.unlink` | Entity | Remove a relation between two entities |
| `event.emit` | Event | Emit a custom event for audit logging |
| `event.query` | Event | Query historical events with filters |
| `calendar.list` | Calendar | List calendar events for a user |
| `calendar.create` | Calendar | Create a calendar event |
| `calendar.update` | Calendar | Update a calendar event |
| `calendar.delete` | Calendar | Delete a calendar event |
| `calendar.freeBusy` | Calendar | Check free/busy availability |
| `whatsapp.send` | WhatsApp | Send a WhatsApp message |
| `whatsapp.sendTemplate` | WhatsApp | Send a WhatsApp template message |
| `whatsapp.sendInteractive` | WhatsApp | Send an interactive button message |
| `whatsapp.sendMedia` | WhatsApp | Send an image or audio message |
| `whatsapp.listTemplates` | WhatsApp | List available message templates |
| `whatsapp.createTemplate` | WhatsApp | Create a new message template on Meta |
| `whatsapp.deleteTemplate` | WhatsApp | Delete a message template from Meta |
| `whatsapp.getTemplateStatus` | WhatsApp | Check approval status of a template |
| `whatsapp.getConversation` | WhatsApp | Get conversation history |
| `whatsapp.getStatus` | WhatsApp | Check WhatsApp connection status |
| `agent.chat` | Agent | Send a message to another agent and get its response |

## Enabling Tools

Specify which tools an agent can use in its definition:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Support Agent",
  slug: "support",
  version: "0.1.0",
  systemPrompt: "You help customers with their requests.",
  model: { provider: "anthropic", name: "claude-sonnet-4" },
  tools: [
    "entity.create",
    "entity.query",
    "entity.update",
    "event.emit",
    "agent.chat",
  ],
})
```

## Permission Enforcement

Every tool call goes through the full permission pipeline:

1. **ActorContext resolution** — The agent's roles are eagerly resolved for its environment
2. **Policy evaluation** — `assertCanPerform()` checks if the actor has a matching allow policy (deny overrides allow)
3. **Scope filtering** — Row-level security filters results to only records the actor can access
4. **Field masking** — Column-level security strips unauthorized fields from responses

If a permission check fails, the tool returns an error to the agent, which can then inform the user.

## Entity Tools

### entity.create

Creates a new entity of a specified type. Emits a `{type}.created` event and fires any matching triggers.

**Parameters:**

```typescript
{
  type: string
  data: object
  status?: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | `string` | Yes | The entity type slug (e.g., `"teacher"`, `"student"`) |
| `data` | `object` | Yes | The entity's data fields, matching the entity type schema |
| `status` | `string` | No | Initial status. Defaults to `"active"` |

**Returns:**

```typescript
{ id: string }
```

**Example agent usage:**

The agent receives a request to create a new student and calls `entity.create` with the appropriate data:

```json
{
  "type": "student",
  "data": {
    "name": "Alice Johnson",
    "grade": "10th",
    "subjects": ["math", "physics"]
  }
}
```

---

### entity.get

Retrieves a single entity by its ID. The response is filtered through scope rules and field masks.

**Parameters:**

```typescript
{
  id: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The entity ID to retrieve |

**Returns:**

```typescript
{
  id: string
  type: string
  status: string
  data: object
  createdAt: number
  updatedAt: number
}
```

The `data` field will have hidden fields removed based on the actor's field masks. If the entity is outside the actor's scope, a permission error is thrown.

---

### entity.query

Queries entities by type with optional filters. Results are scope-filtered and field-masked.

**Parameters:**

```typescript
{
  type: string
  filters?: object
  status?: string
  limit?: number
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | `string` | Yes | The entity type slug to query |
| `filters` | `object` | No | Key-value filters applied to entity `data` fields |
| `status` | `string` | No | Filter by entity status |
| `limit` | `number` | No | Maximum number of results. Defaults to `100` |

**Filter operators:**

Filters support both exact match and operator-based filtering:

```json
{
  "type": "session",
  "filters": {
    "subject": "math",
    "grade": { "_op_in": ["9th", "10th", "11th"] },
    "hourlyRate": { "_op_gte": 50, "_op_lte": 100 }
  },
  "status": "active",
  "limit": 25
}
```

Available operators:

| Operator | Description |
|----------|-------------|
| `_op_in` | Value is in the provided array |
| `_op_nin` | Value is not in the provided array |
| `_op_ne` | Value is not equal to |
| `_op_gt` | Greater than (numeric) |
| `_op_gte` | Greater than or equal (numeric) |
| `_op_lt` | Less than (numeric) |
| `_op_lte` | Less than or equal (numeric) |

**Returns:**

```typescript
Array<{
  id: string
  type: string
  status: string
  data: object
  createdAt: number
  updatedAt: number
}>
```

---

### entity.update

Updates an existing entity's data fields. The update is merged with existing data. Emits a `{type}.updated` event and fires matching triggers.

**Parameters:**

```typescript
{
  id: string
  type?: string
  data: object
  status?: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The entity ID to update |
| `type` | `string` | No | Entity type slug for validation. If provided, the update will fail if the entity is not of this type. |
| `data` | `object` | Yes | Fields to update (merged with existing data) |
| `status` | `string` | No | New status value |

Field masks are applied to the update — the actor can only modify fields their role permits. Fields outside the actor's mask are silently ignored.

**Returns:**

```typescript
{ success: boolean }
```

---

### entity.delete

Soft-deletes an entity by setting its status to `"deleted"` and recording a `deletedAt` timestamp. Emits a `{type}.deleted` event and fires matching triggers.

**Parameters:**

```typescript
{
  id: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The entity ID to delete |

**Returns:**

```typescript
{ success: boolean }
```

---

### entity.link

Creates a typed relation between two entities. Requires `update` permission on the source entity and `read` permission on the target entity. Emits an `entity.linked` event.

**Parameters:**

```typescript
{
  fromId: string
  toId: string
  relationType: string
  metadata?: object
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromId` | `string` | Yes | The source entity ID |
| `toId` | `string` | Yes | The target entity ID |
| `relationType` | `string` | Yes | The relation type label (e.g., `"teaches"`, `"guardian_of"`) |
| `metadata` | `object` | No | Arbitrary metadata to attach to the relation |

If the relation already exists, the existing relation ID is returned with `existing: true`.

**Returns:**

```typescript
{
  id: string
  existing: boolean
}
```

---

### entity.unlink

Removes a relation between two entities. Requires `update` permission on the source entity and `read` permission on the target entity. Emits an `entity.unlinked` event.

**Parameters:**

```typescript
{
  fromId: string
  toId: string
  relationType: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromId` | `string` | Yes | The source entity ID |
| `toId` | `string` | Yes | The target entity ID |
| `relationType` | `string` | Yes | The relation type to remove |

**Returns:**

```typescript
{ success: boolean }
```

## Event Tools

### event.emit

Emits a custom event for audit logging and tracking. Events are scoped to the current environment.

**Parameters:**

```typescript
{
  eventType: string
  entityId?: string
  entityTypeSlug?: string
  payload?: object
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventType` | `string` | Yes | The event type identifier (e.g., `"session.notification"`, `"payment.reminder"`) |
| `entityId` | `string` | No | The related entity ID, if applicable |
| `entityTypeSlug` | `string` | No | The entity type slug, used for visibility filtering |
| `payload` | `object` | No | Arbitrary event data |

**Returns:**

```typescript
{ id: string }
```

---

### event.query

Queries historical events with optional filters. Results are visibility-filtered based on the actor's permissions on related entities.

**Parameters:**

```typescript
{
  eventType?: string
  entityId?: string
  entityTypeSlug?: string
  since?: number
  limit?: number
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventType` | `string` | No | Filter by event type |
| `entityId` | `string` | No | Filter by related entity ID |
| `entityTypeSlug` | `string` | No | Filter by entity type slug |
| `since` | `number` | No | Unix timestamp in milliseconds; only return events after this time |
| `limit` | `number` | No | Maximum number of results. Defaults to `50` |

When an `entityId` is specified, the actor must have `read` permission on that entity and the entity must be within the actor's scope. When querying by `eventType` or without filters, events associated with entities outside the actor's scope are automatically excluded.

**Returns:**

```typescript
Array<{
  _id: string
  eventType: string
  entityId?: string
  entityTypeSlug?: string
  actorId: string
  actorType: string
  payload: object
  timestamp: number
}>
```

## Calendar Tools

Calendar tools integrate with Google Calendar to manage events for users in your organization. Requires a Google Calendar integration to be configured.

### calendar.list

Lists calendar events for a user within a time range.

**Parameters:**

```typescript
{
  userId: string
  timeMin: string
  timeMax: string
  maxResults?: number
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | Yes | The user ID whose calendar to query |
| `timeMin` | `string` | Yes | Start of time range (ISO 8601 format) |
| `timeMax` | `string` | Yes | End of time range (ISO 8601 format) |
| `maxResults` | `number` | No | Maximum events to return |

---

### calendar.create

Creates a new calendar event for a user.

**Parameters:**

```typescript
{
  userId: string
  summary: string
  startTime: string
  endTime?: string
  durationMinutes?: number
  description?: string
  attendees?: string[]
  timeZone?: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | Yes | The user ID whose calendar to create the event on |
| `summary` | `string` | Yes | Event title |
| `startTime` | `string` | Yes | Event start time (ISO 8601 format) |
| `endTime` | `string` | No | Event end time (ISO 8601 format). Provide either `endTime` or `durationMinutes`. |
| `durationMinutes` | `number` | No | Duration in minutes. Used to calculate `endTime` if not provided. |
| `description` | `string` | No | Event description |
| `attendees` | `string[]` | No | List of attendee email addresses |
| `timeZone` | `string` | No | IANA timezone (e.g., `"America/Santiago"`) |

---

### calendar.update

Updates an existing calendar event.

**Parameters:**

```typescript
{
  userId: string
  eventId: string
  summary?: string
  startTime?: string
  endTime?: string
  description?: string
  attendees?: string[]
  status?: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | Yes | The user ID who owns the calendar event |
| `eventId` | `string` | Yes | The calendar event ID to update |
| `summary` | `string` | No | New event title |
| `startTime` | `string` | No | New start time (ISO 8601 format) |
| `endTime` | `string` | No | New end time (ISO 8601 format) |
| `description` | `string` | No | New description |
| `attendees` | `string[]` | No | Updated attendee list |
| `status` | `string` | No | Event status (e.g., `"cancelled"`) |

---

### calendar.delete

Deletes a calendar event.

**Parameters:**

```typescript
{
  userId: string
  eventId: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | Yes | The user ID who owns the calendar event |
| `eventId` | `string` | Yes | The calendar event ID to delete |

---

### calendar.freeBusy

Checks a user's free/busy availability within a time range.

**Parameters:**

```typescript
{
  userId: string
  timeMin: string
  timeMax: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | Yes | The user ID to check availability for |
| `timeMin` | `string` | Yes | Start of time range (ISO 8601 format) |
| `timeMax` | `string` | Yes | End of time range (ISO 8601 format) |

## WhatsApp Tools

WhatsApp tools allow agents to send messages and retrieve conversation history. Requires a WhatsApp integration to be configured for the organization.

### whatsapp.send

Sends a text message to a WhatsApp number.

**Parameters:**

```typescript
{
  to: string
  text: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | `string` | Yes | Recipient phone number (E.164 format, e.g., `"+56912345678"`) |
| `text` | `string` | Yes | Message text to send |

**Returns:**

```typescript
{
  messageId: string
  to: string
  status: "sent"
}
```

---

### whatsapp.sendTemplate

Sends a pre-approved WhatsApp template message. Templates must be created and approved in the Meta Business Manager before use.

**Parameters:**

```typescript
{
  to: string
  templateName: string
  language: string
  components?: Array<{
    type: string
    parameters: Array<{
      type: string
      text?: string
      parameterName?: string
    }>
  }>
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | `string` | Yes | Recipient phone number (E.164 format) |
| `templateName` | `string` | Yes | Name of the approved template |
| `language` | `string` | Yes | Template language code (e.g., `"en_US"`, `"es"`) |
| `components` | `array` | No | Template component parameters for dynamic content |

**Returns:**

```typescript
{
  messageId: string
  to: string
  status: "sent"
}
```

---

### whatsapp.sendInteractive

Sends an interactive message with reply buttons. Supports 1-3 buttons per message.

**Parameters:**

```typescript
{
  to: string
  bodyText: string
  buttons: Array<{ id: string; title: string }>
  footerText?: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | `string` | Yes | Recipient phone number (E.164 format) |
| `bodyText` | `string` | Yes | Message body text |
| `buttons` | `array` | Yes | Array of 1-3 buttons, each with `id` and `title` |
| `footerText` | `string` | No | Optional footer text displayed below buttons |

**Returns:**

```typescript
{
  messageId: string
  to: string
  status: "sent"
}
```

---

### whatsapp.sendMedia

Sends an image or audio message to a WhatsApp number.

**Parameters:**

```typescript
{
  to: string
  mediaUrl: string
  mediaType: "image" | "audio"
  caption?: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | `string` | Yes | Recipient phone number (E.164 format) |
| `mediaUrl` | `string` | Yes | Public URL of the media file |
| `mediaType` | `string` | Yes | Type of media: `"image"` or `"audio"` |
| `caption` | `string` | No | Caption text (only applies to images) |

**Returns:**

```typescript
{
  messageId: string
  to: string
  status: "sent"
}
```

---

### whatsapp.listTemplates

Lists all approved message templates available for the organization's WhatsApp connection.

**Parameters:**

No parameters required.

**Returns:**

```typescript
Array<{
  name: string
  language: string
  status: string
  category: string
  components: Array<object>
}>
```

---

### whatsapp.createTemplate

Creates a new message template on Meta via the Kapso proxy. Templates require Meta approval before they can be sent.

**Parameters:**

```typescript
{
  connectionId: Id<"whatsappConnections">
  environment: "development" | "production"
  name: string
  language: string
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION"
  components: Array<object>
  allowCategoryChange?: boolean
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `connectionId` | `Id<"whatsappConnections">` | Yes | WhatsApp connection to create template for |
| `environment` | `string` | Yes | Environment scope |
| `name` | `string` | Yes | Template name (lowercase, underscores only) |
| `language` | `string` | Yes | Language code (e.g., `en_US`) |
| `category` | `string` | Yes | Template category |
| `components` | `Array<object>` | Yes | Template components (HEADER, BODY, FOOTER, BUTTONS) |
| `allowCategoryChange` | `boolean` | No | Allow Meta to reassign the category |

**Returns:**

```typescript
{
  id: string
  status: string
  category: string
}
```

---

### whatsapp.deleteTemplate

Deletes a message template from Meta. This action is irreversible.

**Parameters:**

```typescript
{
  connectionId: Id<"whatsappConnections">
  environment: "development" | "production"
  name: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `connectionId` | `Id<"whatsappConnections">` | Yes | WhatsApp connection |
| `environment` | `string` | Yes | Environment scope |
| `name` | `string` | Yes | Template name to delete |

**Returns:**

```typescript
{
  success: boolean
}
```

---

### whatsapp.getTemplateStatus

Checks the current approval status and details of a specific template by name.

**Parameters:**

```typescript
{
  connectionId: Id<"whatsappConnections">
  environment: "development" | "production"
  name: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `connectionId` | `Id<"whatsappConnections">` | Yes | WhatsApp connection |
| `environment` | `string` | Yes | Environment scope |
| `name` | `string` | Yes | Template name to check |

**Returns:**

Template data from Meta including name, status (`APPROVED`, `PENDING`, `REJECTED`, `PAUSED`), category, language, and components.

---

### whatsapp.getConversation

Retrieves the message history with a specific phone number.

**Parameters:**

```typescript
{
  phoneNumber: string
  limit?: number
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phoneNumber` | `string` | Yes | Phone number to get conversation for |
| `limit` | `number` | No | Maximum messages to return |

---

### whatsapp.getStatus

Checks the WhatsApp connection status for the current organization.

**Parameters:**

No parameters required.

**Returns:**

```typescript
{
  connected: boolean
  status: string
  phoneNumber?: string
  lastConnectedAt?: number
}
```

## Agent Tools

### agent.chat

Sends a message to another agent within the same organization and environment, and returns its response. This enables multi-agent workflows where a coordinator agent can delegate specialized tasks to other agents.

**Parameters:**

```typescript
{
  agent: string
  message: string
  context?: object
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent` | `string` | Yes | The target agent's slug |
| `message` | `string` | Yes | The message to send to the target agent |
| `context` | `object` | No | Additional context passed to the target agent's thread metadata |

**Returns:**

```typescript
{
  response: string
  threadId: string
  agentSlug: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}
```

### Safety Mechanisms

The `agent.chat` tool includes several protections against runaway execution:

| Mechanism | Behavior |
|-----------|----------|
| **Depth limit** | Maximum delegation depth of **3**. If agent A calls agent B which calls agent C which calls agent D, agent D's call will be rejected. |
| **Cycle detection** | An agent cannot call itself. If agent A tries to invoke `agent.chat` with its own slug, the call is rejected immediately. |
| **Iteration cap** | Each agent in the chain has an independent limit of **10** LLM loop iterations, preventing any single agent from running indefinitely. |
| **Action timeout** | Convex's built-in action timeout applies to the entire chain, providing an upper bound on total execution time. |

### Thread Linking

All threads created during a multi-agent conversation share the same `conversationId`. Child threads store a `parentThreadId` linking back to the parent thread. Thread metadata includes:

```typescript
{
  conversationId: string
  parentAgentSlug: string
  depth: number
  parentContext: object
}
```

### Multi-Agent Example

A coordinator agent that delegates to specialized agents:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Coordinator",
  slug: "coordinator",
  version: "0.1.0",
  systemPrompt: `You are a coordinator that routes requests to specialized agents.

For scheduling questions, delegate to the scheduler agent.
For billing questions, delegate to the billing agent.
For general questions, answer directly.`,
  model: { provider: "anthropic", name: "claude-sonnet-4" },
  tools: ["entity.query", "agent.chat"],
})
```

When the coordinator receives a scheduling request, it calls:

```json
{
  "agent": "scheduler",
  "message": "The guardian wants to book a math session for Tuesday at 3 PM.",
  "context": {
    "guardianId": "ent_abc123",
    "studentId": "ent_def456"
  }
}
```

The scheduler agent runs its own LLM loop with its own tools and permissions, then returns its response to the coordinator.
