---
title: "defineEntityType"
description: "Define entity type schemas for your domain"
section: "SDK"
order: 2
---

# defineEntityType

The `defineEntityType` function creates and validates entity type schema definitions. Each entity type is defined in its own file under the `entity-types/` directory.

```typescript
import { defineEntityType } from 'struere'

export default defineEntityType({
  name: "Teacher",
  slug: "teacher",
  schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Full name" },
      email: { type: "string", format: "email", description: "Email address" },
      subjects: {
        type: "array",
        items: { type: "string" },
        description: "Subjects they can teach",
      },
      hourlyRate: { type: "number", description: "Rate per hour in cents" },
    },
    required: ["name", "email"],
  },
  searchFields: ["name", "email"],
  displayConfig: {
    titleField: "name",
    subtitleField: "email",
  },
})
```

## EntityTypeConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Display name for the entity type |
| `slug` | `string` | Yes | URL-safe identifier, used in API queries and tool calls |
| `schema` | `JSONSchema` | Yes | JSON Schema definition for entity data |
| `searchFields` | `string[]` | No | Fields indexed for text search (defaults to `[]`) |
| `displayConfig` | `object` | No | Controls how entities are displayed in the dashboard |
| `boundToRole` | `string` | No | Binds this entity type to a role name for automatic user linking |
| `userIdField` | `string` | No | Field that stores the Clerk user ID (defaults to `"userId"` when `boundToRole` is set) |

### Validation

`defineEntityType` throws errors if:

- `name`, `slug`, or `schema` is missing
- `schema.type` is not `"object"`
- Any nested object property is missing `properties`
- `boundToRole` is an empty string
- `userIdField` is set without `boundToRole`

## JSON Schema

Entity schemas use the JSON Schema format with the following type system:

```typescript
interface JSONSchema {
  type: 'object'
  properties: Record<string, JSONSchemaProperty>
  required?: string[]
}

interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  format?: string
  enum?: string[]
  items?: JSONSchemaProperty
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
}
```

The root schema must always be `type: "object"`. Nested objects must declare their `properties`.

### Supported Property Types

**String fields:**

```typescript
{
  name: { type: "string", description: "Full name" },
  email: { type: "string", format: "email" },
  status: {
    type: "string",
    enum: ["active", "inactive", "suspended"],
  },
}
```

**Number fields:**

```typescript
{
  hourlyRate: { type: "number", description: "Rate in cents" },
  age: { type: "number" },
}
```

**Boolean fields:**

```typescript
{
  isActive: { type: "boolean", description: "Whether the record is active" },
}
```

**Array fields:**

```typescript
{
  subjects: {
    type: "array",
    items: { type: "string" },
    description: "List of subjects",
  },
  tags: {
    type: "array",
    items: { type: "string", enum: ["math", "science", "english"] },
  },
}
```

**Nested object fields:**

```typescript
{
  address: {
    type: "object",
    properties: {
      street: { type: "string" },
      city: { type: "string" },
      postalCode: { type: "string" },
    },
    required: ["street", "city"],
  },
}
```

## Display Configuration

The `displayConfig` field controls how entities appear in the dashboard:

```typescript
displayConfig: {
  titleField: "name",
  subtitleField: "email",
  descriptionField: "notes",
}
```

| Field | Description |
|-------|-------------|
| `titleField` | Primary display field (shown as heading) |
| `subtitleField` | Secondary display field (shown below title) |
| `descriptionField` | Extended description field |

## Search Fields

The `searchFields` array specifies which fields are indexed for text search via `entity.query`:

```typescript
searchFields: ["name", "email", "phone"]
```

When an agent uses `entity.query` with a search term, only these fields are matched.

## Role Binding

The `boundToRole` and `userIdField` fields create an automatic link between an entity type and a user role. When a user with the bound role logs in, they are associated with the matching entity:

```typescript
export default defineEntityType({
  name: "Teacher",
  slug: "teacher",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string", format: "email" },
      userId: { type: "string", description: "Clerk user ID" },
    },
    required: ["name", "email"],
  },
  boundToRole: "teacher",
  userIdField: "userId",
})
```

When `boundToRole` is set and `userIdField` is omitted, it defaults to `"userId"`.

## Full Examples

### Student Entity Type

```typescript
import { defineEntityType } from 'struere'

export default defineEntityType({
  name: "Student",
  slug: "student",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      grade: { type: "string" },
      subjects: {
        type: "array",
        items: { type: "string" },
      },
      notes: { type: "string" },
      guardianId: { type: "string" },
      preferredTeacherId: { type: "string" },
    },
    required: ["name"],
  },
  searchFields: ["name"],
  displayConfig: {
    titleField: "name",
    subtitleField: "grade",
  },
})
```

### Session Entity Type

```typescript
import { defineEntityType } from 'struere'

export default defineEntityType({
  name: "Session",
  slug: "session",
  schema: {
    type: "object",
    properties: {
      teacherId: { type: "string" },
      studentId: { type: "string" },
      guardianId: { type: "string" },
      startTime: { type: "number", description: "Unix timestamp" },
      duration: { type: "number", description: "Duration in minutes" },
      subject: { type: "string" },
      status: {
        type: "string",
        enum: [
          "pending_payment",
          "scheduled",
          "in_progress",
          "completed",
          "cancelled",
          "no_show",
        ],
      },
      notes: { type: "string" },
      teacherReport: { type: "string" },
    },
    required: ["teacherId", "studentId", "guardianId", "startTime", "duration"],
  },
  searchFields: ["subject"],
  displayConfig: {
    titleField: "subject",
    subtitleField: "status",
  },
})
```

### Entitlement Entity Type (Credits System)

```typescript
import { defineEntityType } from 'struere'

export default defineEntityType({
  name: "Entitlement",
  slug: "entitlement",
  schema: {
    type: "object",
    properties: {
      guardianId: { type: "string" },
      studentId: { type: "string" },
      totalCredits: { type: "number" },
      remainingCredits: { type: "number" },
      expiresAt: { type: "number", description: "Unix timestamp" },
    },
    required: ["guardianId", "studentId", "totalCredits", "remainingCredits"],
  },
  displayConfig: {
    titleField: "remainingCredits",
    subtitleField: "totalCredits",
  },
})
```
