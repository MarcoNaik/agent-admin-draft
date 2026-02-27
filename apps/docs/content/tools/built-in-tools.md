---
title: "Built-in Tools"
description: "Pre-built tools available to all agents"
section: "Tools"
order: 1
---

Struere provides a set of built-in tools that agents can use to interact with data, events, calendars, WhatsApp, Airtable, and other agents. All built-in tools are **permission-aware** — every invocation builds an `ActorContext` from the calling agent's identity and evaluates policies, scope rules, and field masks before returning results.

Built-in tools fall into two categories:

- **Core tools** — Always available, no external setup required. These interact with Struere's own data layer.
- **Integration tools** — Require an active integration configured in the dashboard. These connect to external services like Google Calendar, WhatsApp, and Airtable.

## Core Tools

| Tool | Category | Description |
|------|----------|-------------|
| `entity.create` | Data | Create a new record of a specified data type |
| `entity.get` | Data | Retrieve a single record by ID |
| `entity.query` | Data | Query records by type with optional filters |
| `entity.update` | Data | Update an existing record's data |
| `entity.delete` | Data | Soft-delete a record |
| `entity.link` | Data | Create a relation between two records |
| `entity.unlink` | Data | Remove a relation between two records |
| `event.emit` | Event | Emit a custom event for audit logging |
| `event.query` | Event | Query historical events with filters |
| `agent.chat` | Agent | Send a message to another agent and get its response |

## Integration Tools

Integration tools connect your agents to external services. They work exactly like core tools (same permission enforcement, same API) but require you to configure the corresponding integration in the dashboard first.

If an agent calls an integration tool and the integration isn't configured, the tool returns a clear error explaining what's missing — not a generic "no handler" error.

| Tool | Integration | Description |
|------|-------------|-------------|
| `calendar.list` | Google Calendar | List calendar events for a user |
| `calendar.create` | Google Calendar | Create a calendar event |
| `calendar.update` | Google Calendar | Update a calendar event |
| `calendar.delete` | Google Calendar | Delete a calendar event |
| `calendar.freeBusy` | Google Calendar | Check free/busy availability |
| `whatsapp.send` | WhatsApp (Kapso) | Send a WhatsApp message |
| `whatsapp.sendTemplate` | WhatsApp (Kapso) | Send a WhatsApp template message |
| `whatsapp.sendInteractive` | WhatsApp (Kapso) | Send an interactive button message |
| `whatsapp.sendMedia` | WhatsApp (Kapso) | Send an image or audio message |
| `whatsapp.listTemplates` | WhatsApp (Kapso) | List available message templates |
| `whatsapp.createTemplate` | WhatsApp (Kapso) | Create a new message template on Meta |
| `whatsapp.deleteTemplate` | WhatsApp (Kapso) | Delete a message template from Meta |
| `whatsapp.getTemplateStatus` | WhatsApp (Kapso) | Check approval status of a template |
| `whatsapp.getConversation` | WhatsApp (Kapso) | Get conversation history |
| `whatsapp.getStatus` | WhatsApp (Kapso) | Check WhatsApp connection status |
| `airtable.listBases` | Airtable | List accessible Airtable bases |
| `airtable.listTables` | Airtable | List tables in an Airtable base |
| `airtable.listRecords` | Airtable | List records with filtering and pagination |
| `airtable.getRecord` | Airtable | Get a single record by ID |
| `airtable.createRecords` | Airtable | Create up to 10 records |
| `airtable.updateRecords` | Airtable | Update up to 10 records |
| `airtable.deleteRecords` | Airtable | Delete up to 10 records |
| `email.send` | Resend | Send a transactional email |
| `payment.create` | Flow.cl | Create a payment link and return the URL |
| `payment.getStatus` | Flow.cl | Check the current status of a payment |

### Setting Up Integrations

Each integration requires configuration via the CLI ([`struere integration`](/cli/integration)) or the dashboard (**Settings > Integrations**):

- **Google Calendar** — Connect a Google account with calendar access. See [Google Calendar integration](/integrations/google-calendar).
- **WhatsApp** — Connect via Kapso with a WhatsApp Business number. See [WhatsApp integration](/integrations/whatsapp).
- **Airtable** — Provide a Personal Access Token: `npx struere integration airtable --token <pat> --test`. See [Airtable integration](/integrations/airtable).
- **Resend** — Configure sender identity: `npx struere integration resend --from-email <email> --test`. See [Resend integration](/integrations/resend).
- **Flow.cl** — Provide API credentials: `npx struere integration flow --api-url <url> --api-key <key> --secret-key <secret> --test`. See [Flow Payments integration](/integrations/flow-payments).

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

## Data Tools

### entity.create

Creates a new record of a specified data type. Emits a `{type}.created` event and fires any matching automations.

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
| `type` | `string` | Yes | The data type slug (e.g., `"teacher"`, `"student"`) |
| `data` | `object` | Yes | The record's data fields, matching the data type schema |
| `status` | `string` | No | Initial status. Defaults to `"active"` |

**Returns:**

```typescript
{ id: string }
```

**Example agent usage:**

The agent receives a request to create a new student and calls `entity.create` with the appropriate data type:

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

Retrieves a single record by its ID. The response is filtered through scope rules and field masks.

**Parameters:**

```typescript
{
  id: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The record ID to retrieve |

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

The `data` field will have hidden fields removed based on the actor's field masks. If the record is outside the actor's scope, a permission error is thrown.

---

### entity.query

Queries records by type with optional filters. Results are scope-filtered and field-masked.

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
| `type` | `string` | Yes | The data type slug to query |
| `filters` | `object` | No | Key-value filters applied to record `data` fields |
| `status` | `string` | No | Filter by record status |
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

Updates an existing record's data fields. The update is merged with existing data. Emits a `{type}.updated` event and fires matching automations.

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
| `id` | `string` | Yes | The record ID to update |
| `type` | `string` | No | Data type slug for validation. If provided, the update will fail if the record is not of this type. |
| `data` | `object` | Yes | Fields to update (merged with existing data) |
| `status` | `string` | No | New status value |

Field masks are applied to the update — the actor can only modify fields their role permits. Fields outside the actor's mask are silently ignored.

**Returns:**

```typescript
{ success: boolean }
```

---

### entity.delete

Soft-deletes a record by setting its status to `"deleted"` and recording a `deletedAt` timestamp. Emits a `{type}.deleted` event and fires matching automations.

**Parameters:**

```typescript
{
  id: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The record ID to delete |

**Returns:**

```typescript
{ success: boolean }
```

---

### entity.link

Creates a typed relation between two records. Requires `update` permission on the source record and `read` permission on the target record. Emits an `entity.linked` event.

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
| `fromId` | `string` | Yes | The source record ID |
| `toId` | `string` | Yes | The target record ID |
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

Removes a relation between two records. Requires `update` permission on the source record and `read` permission on the target record. Emits an `entity.unlinked` event.

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
| `fromId` | `string` | Yes | The source record ID |
| `toId` | `string` | Yes | The target record ID |
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
| `entityId` | `string` | No | The related record ID, if applicable |
| `entityTypeSlug` | `string` | No | The data type slug, used for visibility filtering |
| `payload` | `object` | No | Arbitrary event data |

**Returns:**

```typescript
{ id: string }
```

---

### event.query

Queries historical events with optional filters. Results are visibility-filtered based on the actor's permissions on related records.

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
| `entityId` | `string` | No | Filter by related record ID |
| `entityTypeSlug` | `string` | No | Filter by data type slug |
| `since` | `number` | No | Unix timestamp in milliseconds; only return events after this time |
| `limit` | `number` | No | Maximum number of results. Defaults to `50` |

When an `entityId` is specified, the actor must have `read` permission on that record and the record must be within the actor's scope. When querying by `eventType` or without filters, events associated with records outside the actor's scope are automatically excluded.

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

## Airtable Tools

Airtable tools allow agents to read and write records in Airtable bases. Requires an Airtable integration to be configured with a Personal Access Token.

### airtable.listBases

Lists all Airtable bases accessible with the configured token.

**Parameters:**

No parameters required.

**Returns:**

```typescript
{
  bases: Array<{
    id: string
    name: string
    permissionLevel: string
  }>
}
```

---

### airtable.listTables

Lists all tables in an Airtable base, including field definitions.

**Parameters:**

```typescript
{
  baseId: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID (e.g., `"appXXXXXXXXXXXXXX"`) |

---

### airtable.listRecords

Lists records from an Airtable table with optional filtering, sorting, and pagination.

**Parameters:**

```typescript
{
  baseId: string
  tableIdOrName: string
  pageSize?: number
  offset?: string
  filterByFormula?: string
  sort?: Array<{ field: string; direction?: "asc" | "desc" }>
  fields?: string[]
  view?: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID |
| `tableIdOrName` | `string` | Yes | Table ID or name |
| `pageSize` | `number` | No | Records per page (max 100) |
| `offset` | `string` | No | Pagination offset from a previous response |
| `filterByFormula` | `string` | No | Airtable formula filter (e.g., `"{Status} = 'Active'"`) |
| `sort` | `array` | No | Sort config: `[{ field: "Name", direction: "asc" }]` |
| `fields` | `string[]` | No | Only return specific field names |
| `view` | `string` | No | Name or ID of an Airtable view |

**Returns:**

```typescript
{
  records: Array<{
    id: string
    fields: Record<string, unknown>
    createdTime: string
  }>
  offset?: string
}
```

When `offset` is present, pass it back to fetch the next page.

---

### airtable.getRecord

Gets a single record by ID.

**Parameters:**

```typescript
{
  baseId: string
  tableIdOrName: string
  recordId: string
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID |
| `tableIdOrName` | `string` | Yes | Table ID or name |
| `recordId` | `string` | Yes | Record ID (e.g., `"recXXXXXXXXXXXXXX"`) |

---

### airtable.createRecords

Creates up to 10 records in a single request.

**Parameters:**

```typescript
{
  baseId: string
  tableIdOrName: string
  records: Array<{ fields: Record<string, unknown> }>
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID |
| `tableIdOrName` | `string` | Yes | Table ID or name |
| `records` | `array` | Yes | Array of `{ fields: { ... } }` objects (max 10) |

**Example agent usage:**

```json
{
  "baseId": "appABC123",
  "tableIdOrName": "Customers",
  "records": [
    { "fields": { "Name": "Alice", "Email": "alice@example.com" } },
    { "fields": { "Name": "Bob", "Email": "bob@example.com" } }
  ]
}
```

---

### airtable.updateRecords

Updates up to 10 records in a single request. Only specified fields are changed.

**Parameters:**

```typescript
{
  baseId: string
  tableIdOrName: string
  records: Array<{ id: string; fields: Record<string, unknown> }>
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID |
| `tableIdOrName` | `string` | Yes | Table ID or name |
| `records` | `array` | Yes | Array of `{ id, fields }` objects (max 10) |

---

### airtable.deleteRecords

Deletes up to 10 records by ID.

**Parameters:**

```typescript
{
  baseId: string
  tableIdOrName: string
  recordIds: string[]
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID |
| `tableIdOrName` | `string` | Yes | Table ID or name |
| `recordIds` | `string[]` | Yes | Array of record IDs to delete (max 10) |

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
| `context` | `object` | No | Additional context passed to the target agent's thread context params |

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

## Payment Tools

Payment tools let agents create payment links via Flow.cl and check payment status. They require the Flow integration to be configured in the dashboard.

### `payment.create`

Creates a payment entity, calls the Flow API to generate a payment link, and returns the link URL.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | `number` | Yes | Payment amount |
| `description` | `string` | Yes | Description of the payment |
| `currency` | `string` | No | Currency code (defaults to `"CLP"` or the config default) |
| `customerEmail` | `string` | Yes | Customer email address (required by Flow's API) |
| `entityId` | `string` | No | Optional entity ID to link the payment to |

**Returns:**

```json
{
  "paymentId": "ent_abc123",
  "paymentLinkUrl": "https://www.flow.cl/app/web/pay.php?token=xyz",
  "flowOrderId": "12345"
}
```

**Example agent config:**

```typescript
export default defineAgent({
  name: "Billing Agent",
  slug: "billing",
  version: "0.1.0",
  systemPrompt: "You help users make payments. When a user wants to pay, create a payment link.",
  tools: ["payment.create", "payment.getStatus", "entity.query"],
})
```

### `payment.getStatus`

Checks the current status of a payment entity. If the payment has a Flow provider reference, it also queries the Flow API for live status.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entityId` | `string` | Yes | Payment entity ID to check |

**Returns:**

```json
{
  "entityId": "ent_abc123",
  "status": "pending",
  "flowStatus": 1,
  "flowStatusMessage": "Pending payment",
  "paymentLinkUrl": "https://www.flow.cl/app/web/pay.php?token=xyz",
  "amount": 5000,
  "currency": "CLP"
}
```
