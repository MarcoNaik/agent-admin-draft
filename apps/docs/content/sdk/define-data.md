---
title: "defineData"
description: "Define data type schemas for your domain"
section: "SDK"
order: 2
---

# defineData

The `defineData` function creates and validates data type schema definitions. Each data type is defined in its own file under the `entity-types/` directory.

```typescript
import { defineData } from 'struere'

export default defineData({
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
| `name` | `string` | Yes | Display name for the data type |
| `slug` | `string` | Yes | URL-safe identifier, used in API queries and tool calls |
| `schema` | `JSONSchema` | Yes | JSON Schema definition for the data |
| `searchFields` | `string[]` | No | Fields indexed for text search (defaults to `[]`) |
| `displayConfig` | `object` | No | Controls how records are displayed in the dashboard |
| `boundToRole` | `string` | No | Binds this data type to a role name for automatic user linking |
| `userIdField` | `string` | No | Field that stores the Clerk user ID (defaults to `"userId"` when `boundToRole` is set) |

### Validation

`defineData` throws errors if:

- `name`, `slug`, or `schema` is missing
- `schema.type` is not `"object"`
- Any nested object property is missing `properties`
- `boundToRole` is an empty string
- `userIdField` is set without `boundToRole`

## JSON Schema

Data type schemas use the JSON Schema format with the following type system:

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
  references?: string
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

## References

Fields with `references` enforce foreign key constraints. When an entity is created or updated, any field with `references` is validated to ensure the referenced entity exists.

```typescript
import { defineData } from 'struere'

export default defineData({
  name: "Session",
  slug: "session",
  schema: {
    type: "object",
    properties: {
      studentId: { type: "string", references: "student" },
      teacherId: { type: "string", references: "teacher" },
      startTime: { type: "number" },
      duration: { type: "number" },
      subject: { type: "string" },
    },
    required: ["studentId", "teacherId", "startTime", "duration"],
  },
})
```

When the agent calls `entity.create` or `entity.update` with a `studentId` or `teacherId` value, the platform validates that:

- The referenced entity exists
- The referenced entity is not deleted
- The referenced entity belongs to the same organization and environment
- The referenced entity is of the correct entity type (e.g., `studentId` must reference a `student` entity)

If any validation fails, the operation throws an error identifying the invalid reference field.

## Display Configuration

The `displayConfig` field controls how records appear in the dashboard:

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

The `boundToRole` and `userIdField` fields create an automatic link between a data type and a user role. When a user with the bound role logs in, they are associated with the matching record:

```typescript
export default defineData({
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

### Student Data Type

```typescript
import { defineData } from 'struere'

export default defineData({
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

### Session Data Type

```typescript
import { defineData } from 'struere'

export default defineData({
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

### Entitlement Data Type (Credits System)

```typescript
import { defineData } from 'struere'

export default defineData({
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
