---
title: "Airtable"
description: "Read and write Airtable records from your agents"
section: "Integrations"
order: 5
---

# Airtable

Struere integrates with Airtable via Personal Access Tokens (PAT), giving agents the ability to list bases, browse table schemas, and perform full CRUD on records.

## Setup

### 1. Create an Airtable Personal Access Token

Go to [airtable.com/create/tokens](https://airtable.com/create/tokens) and create a new token. Grant the scopes your agents need:

| Scope | Required for |
|-------|-------------|
| `data.records:read` | `airtable.listRecords`, `airtable.getRecord` |
| `data.records:write` | `airtable.createRecords`, `airtable.updateRecords`, `airtable.deleteRecords` |
| `schema.bases:read` | `airtable.listBases`, `airtable.listTables` |

Select the specific bases the token should have access to, or grant access to all bases.

### 2. Configure in the dashboard

Navigate to **Settings > Integrations > Airtable**, paste your PAT, and click **Save**. Then click **Test Connection** to verify the token is valid.

### 3. Add Airtable tools to your agent

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Data Manager",
  slug: "data-manager",
  tools: [
    "airtable.listBases",
    "airtable.listTables",
    "airtable.listRecords",
    "airtable.getRecord",
    "airtable.createRecords",
    "airtable.updateRecords",
    "airtable.deleteRecords",
  ],
  systemPrompt: `You manage data in Airtable for {{organizationName}}.

When the user asks about data, query the relevant Airtable base and table.
When creating or updating records, confirm the changes with the user first.`,
  model: { provider: "xai", name: "grok-4-1-fast" },
})
```

## Available Tools

### airtable.listBases

Lists all Airtable bases accessible with the configured token.

**Parameters:** None.

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

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID (e.g., `"appXXXXXXXXXXXXXX"`) |

**Returns:**

```typescript
{
  tables: Array<{
    id: string
    name: string
    fields: Array<{
      id: string
      name: string
      type: string
    }>
  }>
}
```

---

### airtable.listRecords

Lists records from an Airtable table with optional filtering, sorting, and pagination.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID |
| `tableIdOrName` | `string` | Yes | Table ID or name |
| `pageSize` | `number` | No | Records per page (max 100) |
| `offset` | `string` | No | Pagination offset from a previous response |
| `filterByFormula` | `string` | No | Airtable formula filter (e.g., `"{Status} = 'Active'"`) |
| `sort` | `array` | No | Sort configuration: `[{ field: "Name", direction: "asc" }]` |
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

When `offset` is present in the response, pass it back to fetch the next page.

---

### airtable.getRecord

Gets a single record by ID.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID |
| `tableIdOrName` | `string` | Yes | Table ID or name |
| `recordId` | `string` | Yes | Record ID (e.g., `"recXXXXXXXXXXXXXX"`) |

**Returns:**

```typescript
{
  id: string
  fields: Record<string, unknown>
  createdTime: string
}
```

---

### airtable.createRecords

Creates up to 10 records in a single request.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID |
| `tableIdOrName` | `string` | Yes | Table ID or name |
| `records` | `array` | Yes | Array of `{ fields: { ... } }` objects (max 10) |

**Example:**

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

**Returns:**

```typescript
{
  records: Array<{
    id: string
    fields: Record<string, unknown>
    createdTime: string
  }>
}
```

---

### airtable.updateRecords

Updates up to 10 records in a single request. Only the specified fields are updated; unspecified fields are left unchanged.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID |
| `tableIdOrName` | `string` | Yes | Table ID or name |
| `records` | `array` | Yes | Array of `{ id: "recXXX", fields: { ... } }` objects (max 10) |

**Example:**

```json
{
  "baseId": "appABC123",
  "tableIdOrName": "Customers",
  "records": [
    { "id": "recXYZ789", "fields": { "Status": "Active" } }
  ]
}
```

**Returns:**

```typescript
{
  records: Array<{
    id: string
    fields: Record<string, unknown>
    createdTime: string
  }>
}
```

---

### airtable.deleteRecords

Deletes up to 10 records by ID.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `baseId` | `string` | Yes | Airtable base ID |
| `tableIdOrName` | `string` | Yes | Table ID or name |
| `recordIds` | `string[]` | Yes | Array of record IDs to delete (max 10) |

**Returns:**

```typescript
{
  records: Array<{
    id: string
    deleted: boolean
  }>
}
```

## Batch Limits

All write operations (create, update, delete) are limited to **10 records per request**. This matches the Airtable API limit. For larger operations, the agent should batch records into groups of 10.

## Common Patterns

### Syncing Entities to Airtable

An agent can sync Struere entities to an Airtable table for reporting:

```
User: "Sync all active students to the Students table in Airtable"

Agent flow:
1. entity.query — get all active student entities
2. airtable.listTables — verify the Students table exists and get field names
3. airtable.createRecords — batch create records (10 at a time)
```

### Importing from Airtable

```
User: "Import the leads from our Airtable CRM"

Agent flow:
1. airtable.listRecords — fetch records with pagination
2. entity.create — create Struere entities for each record
```

### Filtering Records

Use Airtable formulas to filter server-side:

```json
{
  "baseId": "appABC123",
  "tableIdOrName": "Tasks",
  "filterByFormula": "AND({Status} = 'Open', {Priority} = 'High')",
  "sort": [{ "field": "Created", "direction": "desc" }],
  "pageSize": 20
}
```

## Environment Scoping

The Airtable integration configuration is environment-scoped. You can use different PATs (or the same PAT) for development and production environments. Configure each environment separately in the dashboard.
