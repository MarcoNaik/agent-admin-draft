---
title: "Data API"
description: "CRUD operations for entities via HTTP"
section: "API Reference"
order: 3
---

# Data API

The Data API lets you create, read, update, and delete entities in your Struere data layer over HTTP. Use it to integrate your entity database with any application, backend service, or automation tool.

## Authentication

Data API endpoints require an API key with the `data` permission. Create one in the Struere dashboard under **API Keys** and enable the **Data** permission.

```
Authorization: Bearer sk_dev_abc123...
```

The API key determines the environment (`development` or `production`). All operations are scoped to that environment.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/entity-types` | List entity types |
| `GET` | `/v1/data/:type` | List entities |
| `GET` | `/v1/data/:type/:id` | Get entity by ID |
| `POST` | `/v1/data/:type` | Create entity |
| `POST` | `/v1/data/:type/query` | Query with filters |
| `POST` | `/v1/data/:type/search` | Full-text search |
| `PATCH` | `/v1/data/:type/:id` | Update entity |
| `DELETE` | `/v1/data/:type/:id` | Delete entity |

## Rate Limits

Data API endpoints are rate-limited separately from Chat:

| Scope | Limit |
|-------|-------|
| Per API key | 60 requests/minute |
| Per organization | 200 requests/minute |

## Response Shape

All entity responses share the same shape:

```json
{
  "id": "k17abc...",
  "type": "customer",
  "status": "active",
  "data": { "name": "Jane", "email": "jane@co.com" },
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | The entity's Convex document ID |
| `type` | `string` | The entity type slug |
| `status` | `string` | Entity status (e.g., `active`, `archived`) |
| `data` | `object` | The entity's data fields |
| `createdAt` | `number` | Creation timestamp (Unix ms) |
| `updatedAt` | `number` | Last update timestamp (Unix ms) |

List, query, and search endpoints return a paginated wrapper:

```json
{
  "data": [ ... ],
  "cursor": "k17abc...",
  "hasMore": true
}
```

## GET /v1/entity-types

List all entity types in the current environment.

### Response

```json
{
  "data": [
    {
      "slug": "customer",
      "name": "Customer",
      "schema": { "name": "string", "email": "string" },
      "searchFields": ["name", "email"]
    }
  ]
}
```

### Examples

#### curl

```bash
curl https://your-deployment.convex.site/v1/entity-types \
  -H "Authorization: Bearer sk_dev_abc123"
```

#### Python

```python
import requests

response = requests.get(
    "https://your-deployment.convex.site/v1/entity-types",
    headers={"Authorization": "Bearer sk_dev_abc123"},
)
types = response.json()["data"]
for t in types:
    print(f"{t['slug']}: {t['name']}")
```

## GET /v1/data/:type

List entities of a given type with cursor-based pagination.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | `50` | Max results per page (1–100) |
| `cursor` | `string` | — | Cursor from a previous response for the next page |
| `status` | `string` | — | Filter by status (e.g., `active`, `archived`) |

### Response

```json
{
  "data": [
    {
      "id": "k17abc...",
      "type": "customer",
      "status": "active",
      "data": { "name": "Jane", "email": "jane@co.com" },
      "createdAt": 1710000000000,
      "updatedAt": 1710000000000
    }
  ],
  "cursor": "k17xyz...",
  "hasMore": true
}
```

### Examples

#### curl

```bash
curl "https://your-deployment.convex.site/v1/data/customer?limit=10" \
  -H "Authorization: Bearer sk_dev_abc123"
```

#### Pagination

```bash
curl "https://your-deployment.convex.site/v1/data/customer?limit=10&cursor=k17xyz..." \
  -H "Authorization: Bearer sk_dev_abc123"
```

#### Python

```python
import requests

BASE = "https://your-deployment.convex.site"
HEADERS = {"Authorization": "Bearer sk_dev_abc123"}

all_customers = []
cursor = None

while True:
    params = {"limit": 50}
    if cursor:
        params["cursor"] = cursor

    response = requests.get(f"{BASE}/v1/data/customer", headers=HEADERS, params=params)
    result = response.json()
    all_customers.extend(result["data"])

    if not result["hasMore"]:
        break
    cursor = result["cursor"]

print(f"Total: {len(all_customers)}")
```

## GET /v1/data/:type/:id

Get a single entity by its ID.

### Response

```json
{
  "id": "k17abc...",
  "type": "customer",
  "status": "active",
  "data": { "name": "Jane", "email": "jane@co.com" },
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

### Examples

#### curl

```bash
curl https://your-deployment.convex.site/v1/data/customer/k17abc... \
  -H "Authorization: Bearer sk_dev_abc123"
```

#### TypeScript

```typescript
const response = await fetch(
  "https://your-deployment.convex.site/v1/data/customer/k17abc...",
  { headers: { Authorization: "Bearer sk_dev_abc123" } }
)
const customer = await response.json()
console.log(customer.data.name)
```

## POST /v1/data/:type

Create a new entity.

### Request

**Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer YOUR_API_KEY` |
| `Content-Type` | `application/json` |

**Body:**

```json
{
  "data": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "plan": "pro"
  },
  "status": "active"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | `object` | Yes | The entity's data fields |
| `status` | `string` | No | Initial status (defaults to `active`) |

### Response (201 Created)

```json
{
  "id": "k17abc...",
  "type": "customer",
  "status": "active",
  "data": { "name": "Jane Doe", "email": "jane@example.com", "plan": "pro" },
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

### Examples

#### curl

```bash
curl -X POST https://your-deployment.convex.site/v1/data/customer \
  -H "Authorization: Bearer sk_dev_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "plan": "pro"
    }
  }'
```

#### Python

```python
import requests

response = requests.post(
    "https://your-deployment.convex.site/v1/data/customer",
    headers={
        "Authorization": "Bearer sk_dev_abc123",
        "Content-Type": "application/json",
    },
    json={
        "data": {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "plan": "pro",
        }
    },
)
customer = response.json()
print(f"Created: {customer['id']}")
```

#### TypeScript

```typescript
const response = await fetch("https://your-deployment.convex.site/v1/data/customer", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_dev_abc123",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    data: { name: "Jane Doe", email: "jane@example.com", plan: "pro" },
  }),
})
const customer = await response.json()
console.log(`Created: ${customer.id}`)
```

## POST /v1/data/:type/query

Query entities with filters. Filters support comparison operators for advanced queries.

### Request

**Body:**

```json
{
  "filters": {
    "plan": "pro",
    "age": { "$gte": 18 },
    "status": { "$in": ["active", "trial"] }
  },
  "status": "active",
  "limit": 25,
  "cursor": "k17xyz..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filters` | `object` | No | Field-level filters (see operators below) |
| `status` | `string` | No | Filter by entity status |
| `limit` | `number` | No | Max results (default 50, max 100) |
| `cursor` | `string` | No | Pagination cursor from previous response |

### Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| (none) | Exact match | `{ "plan": "pro" }` |
| `$in` | Value in array | `{ "plan": { "$in": ["pro", "enterprise"] } }` |
| `$nin` | Value not in array | `{ "plan": { "$nin": ["free"] } }` |
| `$ne` | Not equal | `{ "status": { "$ne": "archived" } }` |
| `$gt` | Greater than | `{ "age": { "$gt": 18 } }` |
| `$gte` | Greater than or equal | `{ "age": { "$gte": 18 } }` |
| `$lt` | Less than | `{ "score": { "$lt": 50 } }` |
| `$lte` | Less than or equal | `{ "score": { "$lte": 100 } }` |

### Response

```json
{
  "data": [ ... ],
  "cursor": "k17xyz...",
  "hasMore": false
}
```

### Examples

#### curl

```bash
curl -X POST https://your-deployment.convex.site/v1/data/customer/query \
  -H "Authorization: Bearer sk_dev_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "plan": "pro",
      "age": { "$gte": 18 }
    },
    "limit": 10
  }'
```

#### Python

```python
import requests

response = requests.post(
    "https://your-deployment.convex.site/v1/data/customer/query",
    headers={
        "Authorization": "Bearer sk_dev_abc123",
        "Content-Type": "application/json",
    },
    json={
        "filters": {"plan": "pro", "age": {"$gte": 18}},
        "limit": 10,
    },
)
result = response.json()
for customer in result["data"]:
    print(customer["data"]["name"])
```

## POST /v1/data/:type/search

Full-text search across an entity type's search fields. Search fields are defined in the entity type's configuration.

### Request

**Body:**

```json
{
  "query": "jane",
  "limit": 10
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | `string` | Yes | Search text |
| `limit` | `number` | No | Max results (default 20, max 100) |

### Response

```json
{
  "data": [
    {
      "id": "k17abc...",
      "type": "customer",
      "status": "active",
      "data": { "name": "Jane Doe", "email": "jane@example.com" },
      "createdAt": 1710000000000,
      "updatedAt": 1710000000000
    }
  ]
}
```

### Examples

#### curl

```bash
curl -X POST https://your-deployment.convex.site/v1/data/customer/search \
  -H "Authorization: Bearer sk_dev_abc123" \
  -H "Content-Type: application/json" \
  -d '{ "query": "jane", "limit": 10 }'
```

#### TypeScript

```typescript
const response = await fetch(
  "https://your-deployment.convex.site/v1/data/customer/search",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer sk_dev_abc123",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "jane", limit: 10 }),
  }
)
const { data } = await response.json()
data.forEach((customer: any) => console.log(customer.data.name))
```

## PATCH /v1/data/:type/:id

Update an entity. Data fields are shallow-merged with the existing data.

### Request

**Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer YOUR_API_KEY` |
| `Content-Type` | `application/json` |

**Body:**

```json
{
  "data": {
    "plan": "enterprise",
    "notes": "Upgraded from pro"
  },
  "status": "active"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | `object` | Yes | Fields to update (shallow merge) |
| `status` | `string` | No | New status value |

### Response

Returns the full updated entity.

```json
{
  "id": "k17abc...",
  "type": "customer",
  "status": "active",
  "data": { "name": "Jane Doe", "email": "jane@example.com", "plan": "enterprise", "notes": "Upgraded from pro" },
  "createdAt": 1710000000000,
  "updatedAt": 1710000050000
}
```

### Examples

#### curl

```bash
curl -X PATCH https://your-deployment.convex.site/v1/data/customer/k17abc... \
  -H "Authorization: Bearer sk_dev_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "data": { "plan": "enterprise" }
  }'
```

#### Python

```python
import requests

response = requests.patch(
    "https://your-deployment.convex.site/v1/data/customer/k17abc...",
    headers={
        "Authorization": "Bearer sk_dev_abc123",
        "Content-Type": "application/json",
    },
    json={"data": {"plan": "enterprise"}},
)
updated = response.json()
print(f"Updated plan: {updated['data']['plan']}")
```

## DELETE /v1/data/:type/:id

Soft-delete an entity. The entity's status is set to `deleted` and it will no longer appear in list or query results.

### Response

```json
{
  "success": true
}
```

### Examples

#### curl

```bash
curl -X DELETE https://your-deployment.convex.site/v1/data/customer/k17abc... \
  -H "Authorization: Bearer sk_dev_abc123"
```

#### TypeScript

```typescript
const response = await fetch(
  "https://your-deployment.convex.site/v1/data/customer/k17abc...",
  {
    method: "DELETE",
    headers: { Authorization: "Bearer sk_dev_abc123" },
  }
)
const result = await response.json()
console.log(result.success)
```

## Error Handling

### Status Codes

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| `200` | Success | Request completed |
| `201` | Created | Entity created (POST) |
| `400` | Bad Request | Missing required fields, invalid path |
| `401` | Unauthorized | Missing or invalid API key |
| `403` | Forbidden | API key lacks `data` permission, or entity outside permission scope |
| `404` | Not Found | Entity or entity type not found |
| `429` | Too Many Requests | Rate limit exceeded (check `Retry-After` header) |
| `500` | Internal Error | Server-side failure |

### Error Response Format

```json
{
  "error": "Error description"
}
```

Rate limit errors include a `Retry-After` header with the number of seconds to wait:

```json
{
  "error": "Rate limit exceeded",
  "retryAt": 1710000060000
}
```

### Handling Errors in Code

**TypeScript:**

```typescript
const response = await fetch("https://your-deployment.convex.site/v1/data/customer", {
  headers: { Authorization: "Bearer sk_dev_abc123" },
})

if (!response.ok) {
  const error = await response.json()
  switch (response.status) {
    case 401:
      throw new Error("Invalid API key")
    case 403:
      throw new Error("Missing data permission")
    case 404:
      throw new Error("Not found")
    case 429:
      const retryAfter = response.headers.get("Retry-After")
      throw new Error(`Rate limited, retry in ${retryAfter}s`)
    default:
      throw new Error(`Error: ${error.error}`)
  }
}

const data = await response.json()
```

**Python:**

```python
import requests
import time

response = requests.get(
    "https://your-deployment.convex.site/v1/data/customer",
    headers={"Authorization": "Bearer sk_dev_abc123"},
)

if response.status_code == 429:
    retry_after = int(response.headers.get("Retry-After", 5))
    time.sleep(retry_after)
elif response.status_code == 401:
    raise Exception("Invalid API key")
elif response.status_code == 403:
    raise Exception("API key lacks data permission")
elif response.status_code >= 400:
    raise Exception(f"Error: {response.json()['error']}")

data = response.json()
```
