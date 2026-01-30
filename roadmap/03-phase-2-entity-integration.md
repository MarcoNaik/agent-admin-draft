# Phase 2: Entity System Integration

## Document Purpose

This document details the integration of the permission engine (built in Phase 1) into all entity operations. By the end of this phase, every way to access entity data will be permission-aware.

**Status**: 📋 Planned

**Dependencies**: Phase 1 (Permission Engine Core)

**Estimated Scope**: ~30 modified functions, ~200 lines of permission integration code

---

## Context: Why This Phase Exists

### What Phase 1 Accomplished

Phase 1 created the permission engine with:
- `buildActorContext()` - creates identity context
- `canPerform()` / `assertCanPerform()` - checks policies
- `getScopeFilters()` / `applyScopeFiltersToQuery()` - row-level filtering
- `getFieldMask()` / `applyFieldMask()` - column-level filtering
- `queryEntitiesAsActor()` - high-level secure query

It also added one proof-of-concept query: `entities.listSecure`.

### What's Still Insecure

Despite Phase 1, most entity operations remain insecure:

| Operation | File | Current State |
|-----------|------|---------------|
| `entities.list` | entities.ts | ❌ No permission check |
| `entities.get` | entities.ts | ❌ No permission check |
| `entities.create` | entities.ts | ❌ No permission check |
| `entities.update` | entities.ts | ❌ No permission check |
| `entities.delete` | entities.ts | ❌ No permission check |
| `entities.search` | entities.ts | ❌ No permission check |
| `entities.link` | entities.ts | ❌ No permission check |
| `entities.unlink` | entities.ts | ❌ No permission check |
| `entityTypes.list` | entityTypes.ts | ❌ No permission check |
| `entityTypes.create` | entityTypes.ts | ❌ No permission check |
| `events.list` | events.ts | ❌ No permission check |
| Built-in tools | tools/*.ts | ❌ No permission check |

### The Risk of Partial Security

Having one secure query (`listSecure`) alongside many insecure ones creates a false sense of security:
- Developers might think "we have permissions"
- But 90% of data access still bypasses them
- The dashboard calls the insecure queries
- Built-in tools call insecure operations

**This phase eliminates all insecure data access paths.**

---

## Goals

By the end of Phase 2:

1. **All entity queries are permission-aware** - list, get, search all respect policies, scopes, and masks
2. **All entity mutations check permissions** - create, update, delete require authorization
3. **All entity relations are secured** - link/unlink respect policies
4. **Entity type operations are secured** - only admins can modify schemas
5. **Event queries are secured** - events respect the underlying entity's permissions
6. **Built-in tools use secure operations** - entity.create, entity.query, etc.
7. **No bypass paths exist** - every way to access data goes through permissions

---

## Non-Goals for This Phase

1. **Dashboard UI changes** - The dashboard continues to work, but might show less data for restricted users. UI adaptation comes in Phase 6.

2. **Template compilation security** - That's Phase 3.

3. **Custom tool permissions** - That's Phase 3.

4. **Job actor context** - That's Phase 3.

5. **Performance optimization** - We prioritize correctness. Optimization comes later.

---

## Implementation Plan

### Step 1: Replace Entity Queries

Replace all entity query operations with permission-aware versions.

#### 1.1 Replace `entities.list`

**Current code** (insecure):
```typescript
export const list = query({
  args: { entityTypeId: v.optional(v.id("entityTypes")) },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    let q = ctx.db
      .query("entities")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
    if (args.entityTypeId) {
      q = q.filter((q) => q.eq(q.field("entityTypeId"), args.entityTypeId))
    }
    return await q.collect()
  },
})
```

**New code** (secure):
```typescript
export const list = query({
  args: { entityTypeSlug: v.string() },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })
    return await queryEntitiesAsActor(ctx, actor, args.entityTypeSlug)
  },
})
```

**Why this change?**

- Uses `entityTypeSlug` instead of `entityTypeId` for cleaner API
- Delegates entirely to `queryEntitiesAsActor` which handles all permission logic
- No direct database access in the handler

#### 1.2 Replace `entities.get`

**Current code** (insecure):
```typescript
export const get = query({
  args: { id: v.id("entities") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const entity = await ctx.db.get(args.id)
    if (!entity || entity.organizationId !== auth.organizationId) {
      return null
    }
    return entity
  },
})
```

**New code** (secure):
```typescript
export const get = query({
  args: { id: v.id("entities") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const entity = await ctx.db.get(args.id)
    if (!entity || entity.organizationId !== auth.organizationId) {
      return null
    }
    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType) {
      return null
    }
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })
    return await getEntityAsActor(ctx, actor, entityType.slug, args.id)
  },
})
```

**Why this change?**

- First validates org boundary (defense in depth)
- Then delegates to `getEntityAsActor` for full permission checking
- Returns null (not error) if permission denied - matches REST convention

#### 1.3 Replace `entities.search`

**Current code** (insecure):
```typescript
export const search = query({
  args: { entityTypeId: v.id("entityTypes"), searchText: v.string() },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    return await ctx.db
      .query("entities")
      .withSearchIndex("search_text", (q) =>
        q.search("searchText", args.searchText).eq("organizationId", auth.organizationId)
      )
      .collect()
  },
})
```

**New code** (secure):
```typescript
export const search = query({
  args: { entityTypeSlug: v.string(), searchText: v.string() },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    const canList = await canPerform(ctx, actor, "list", args.entityTypeSlug)
    if (!canList.allowed) {
      return []
    }

    const entityType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", args.entityTypeSlug)
      )
      .first()

    if (!entityType) {
      return []
    }

    const results = await ctx.db
      .query("entities")
      .withSearchIndex("search_text", (q) =>
        q.search("searchText", args.searchText)
          .eq("organizationId", auth.organizationId)
          .eq("entityTypeId", entityType._id)
      )
      .collect()

    const scopeFilters = await getScopeFilters(ctx, actor, args.entityTypeSlug)
    const scopedResults = applyScopeFiltersToQuery(results, scopeFilters)

    const fieldMask = await getFieldMask(ctx, actor, args.entityTypeSlug)
    return scopedResults.map((e) => applyFieldMask(e, fieldMask))
  },
})
```

**Why this change?**

- First checks if actor can list this entity type
- Uses search index for performance (Convex handles this well)
- Then applies scope filters and field masks to results
- Search index can't filter by arbitrary scope rules, so we filter in memory after

### Step 2: Secure Entity Mutations

#### 2.1 Secure `entities.create`

**New code**:
```typescript
export const create = mutation({
  args: {
    entityTypeSlug: v.string(),
    data: v.any(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    await assertCanPerform(ctx, actor, "create", args.entityTypeSlug)

    const entityType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", args.entityTypeSlug)
      )
      .first()

    if (!entityType) {
      throw new Error(`Entity type not found: ${args.entityTypeSlug}`)
    }

    const now = Date.now()
    const entityId = await ctx.db.insert("entities", {
      organizationId: auth.organizationId,
      entityTypeId: entityType._id,
      status: args.status ?? "active",
      data: args.data,
      searchText: buildSearchText(args.data, entityType.searchConfig),
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      entityId,
      eventType: `${args.entityTypeSlug}.created`,
      payload: { data: args.data },
      actorId: actor.actorId,
      actorType: actor.actorType,
      timestamp: now,
    })

    return entityId
  },
})
```

**Why these changes?**

1. **Permission check first**: `assertCanPerform` throws if not allowed
2. **Event emission**: Records who created what for audit
3. **Actor context in event**: Enables audit trail

#### 2.2 Secure `entities.update`

**New code**:
```typescript
export const update = mutation({
  args: {
    id: v.id("entities"),
    data: v.any(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const entity = await ctx.db.get(args.id)

    if (!entity || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    await assertCanPerform(ctx, actor, "update", entityType.slug, entity)

    const scopeFilters = await getScopeFilters(ctx, actor, entityType.slug)
    const canAccessRecord = applyScopeFiltersToQuery([entity], scopeFilters).length > 0
    if (!canAccessRecord) {
      throw new PermissionError(
        "Cannot update entity outside of scope",
        actor,
        "update",
        entityType.slug
      )
    }

    const fieldMask = await getFieldMask(ctx, actor, entityType.slug)
    const allowedData = filterDataByMask(args.data, fieldMask)

    const now = Date.now()
    const mergedData = { ...entity.data, ...allowedData }

    await ctx.db.patch(args.id, {
      data: mergedData,
      status: args.status ?? entity.status,
      searchText: buildSearchText(mergedData, entityType.searchConfig),
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      entityId: args.id,
      eventType: `${entityType.slug}.updated`,
      payload: { changes: allowedData, previousData: entity.data },
      actorId: actor.actorId,
      actorType: actor.actorType,
      timestamp: now,
    })

    return args.id
  },
})

function filterDataByMask(
  data: Record<string, unknown>,
  mask: FieldMaskResult
): Record<string, unknown> {
  if (mask.isWildcard) {
    return data
  }
  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (mask.allowedFields.includes(key) || mask.allowedFields.includes(`data.${key}`)) {
      filtered[key] = value
    }
  }
  return filtered
}
```

**Why these changes?**

1. **Org boundary check first**: Defense in depth
2. **Permission check**: Must have update permission
3. **Scope check**: Must be within actor's visible scope
4. **Input filtering**: Actor can only update fields they're allowed to see
5. **Event with diff**: Records what changed for audit

**Important: Input filtering**

This is a critical security feature. If a teacher can only see `[status, notes]` fields, they should only be able to update those fields. The `filterDataByMask` function ensures actors can't modify fields they can't see.

#### 2.3 Secure `entities.delete`

**New code**:
```typescript
export const remove = mutation({
  args: { id: v.id("entities") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const entity = await ctx.db.get(args.id)

    if (!entity || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
    }

    const entityType = await ctx.db.get(entity.entityTypeId)
    if (!entityType) {
      throw new Error("Entity type not found")
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    await assertCanPerform(ctx, actor, "delete", entityType.slug, entity)

    const scopeFilters = await getScopeFilters(ctx, actor, entityType.slug)
    const canAccessRecord = applyScopeFiltersToQuery([entity], scopeFilters).length > 0
    if (!canAccessRecord) {
      throw new PermissionError(
        "Cannot delete entity outside of scope",
        actor,
        "delete",
        entityType.slug
      )
    }

    const now = Date.now()
    await ctx.db.patch(args.id, {
      status: "deleted",
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      entityId: args.id,
      eventType: `${entityType.slug}.deleted`,
      payload: { previousData: entity.data },
      actorId: actor.actorId,
      actorType: actor.actorType,
      timestamp: now,
    })

    return args.id
  },
})
```

**Why soft delete?**

- Actual deletion (`ctx.db.delete`) loses audit trail
- Soft delete (`status: "deleted"`) preserves history
- Queries filter out deleted entities by default
- Can be hard-deleted later via maintenance job

### Step 3: Secure Entity Relations

#### 3.1 Secure `entities.link`

**New code**:
```typescript
export const link = mutation({
  args: {
    fromEntityId: v.id("entities"),
    toEntityId: v.id("entities"),
    relationType: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    const fromEntity = await ctx.db.get(args.fromEntityId)
    const toEntity = await ctx.db.get(args.toEntityId)

    if (!fromEntity || fromEntity.organizationId !== auth.organizationId) {
      throw new Error("Source entity not found")
    }
    if (!toEntity || toEntity.organizationId !== auth.organizationId) {
      throw new Error("Target entity not found")
    }

    const fromType = await ctx.db.get(fromEntity.entityTypeId)
    const toType = await ctx.db.get(toEntity.entityTypeId)

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    await assertCanPerform(ctx, actor, "update", fromType!.slug, fromEntity)
    await assertCanPerform(ctx, actor, "read", toType!.slug, toEntity)

    const existing = await ctx.db
      .query("entityRelations")
      .withIndex("by_from_to", (q) =>
        q.eq("fromEntityId", args.fromEntityId).eq("toEntityId", args.toEntityId)
      )
      .filter((q) => q.eq(q.field("relationType"), args.relationType))
      .first()

    if (existing) {
      return existing._id
    }

    const relationId = await ctx.db.insert("entityRelations", {
      organizationId: auth.organizationId,
      fromEntityId: args.fromEntityId,
      toEntityId: args.toEntityId,
      relationType: args.relationType,
      metadata: args.metadata ?? {},
      createdAt: Date.now(),
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      entityId: args.fromEntityId,
      eventType: "entity.linked",
      payload: {
        toEntityId: args.toEntityId,
        relationType: args.relationType,
      },
      actorId: actor.actorId,
      actorType: actor.actorType,
      timestamp: Date.now(),
    })

    return relationId
  },
})
```

**Why these permission checks?**

- Linking is an UPDATE to the source entity (you're modifying its relations)
- You must be able to READ the target entity (you're referencing it)
- This prevents:
  - Linking to entities you can't see
  - Modifying entities you don't have access to

### Step 4: Secure Entity Type Operations

Entity type operations are administrative—they change the schema of the system.

#### 4.1 Secure `entityTypes.create`

```typescript
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    schema: v.any(),
    searchConfig: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    await assertCanPerform(ctx, actor, "create", "entityType")

    const existing = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", args.slug)
      )
      .first()

    if (existing) {
      throw new Error(`Entity type with slug "${args.slug}" already exists`)
    }

    return await ctx.db.insert("entityTypes", {
      organizationId: auth.organizationId,
      name: args.name,
      slug: args.slug,
      description: args.description,
      schema: args.schema,
      searchConfig: args.searchConfig,
      createdAt: Date.now(),
    })
  },
})
```

**Why treat entityType as a resource?**

- Entity types are a distinct resource from entities
- Creating an entity type is different from creating an entity
- Typically only admins should be able to modify schemas
- The resource name `"entityType"` is used in policy definitions

### Step 5: Secure Event Queries

Events record changes to entities. Event visibility should match entity visibility.

```typescript
export const list = query({
  args: {
    entityId: v.optional(v.id("entities")),
    entityTypeSlug: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    if (args.entityId) {
      const entity = await ctx.db.get(args.entityId)
      if (!entity || entity.organizationId !== auth.organizationId) {
        return []
      }

      const entityType = await ctx.db.get(entity.entityTypeId)
      if (!entityType) {
        return []
      }

      const canRead = await canPerform(ctx, actor, "read", entityType.slug, entity)
      if (!canRead.allowed) {
        return []
      }

      return await ctx.db
        .query("events")
        .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
        .order("desc")
        .take(args.limit ?? 100)
    }

    if (args.entityTypeSlug) {
      const canList = await canPerform(ctx, actor, "list", args.entityTypeSlug)
      if (!canList.allowed) {
        return []
      }

      const entityType = await ctx.db
        .query("entityTypes")
        .withIndex("by_org_slug", (q) =>
          q.eq("organizationId", auth.organizationId).eq("slug", args.entityTypeSlug)
        )
        .first()

      if (!entityType) {
        return []
      }

      const events = await ctx.db
        .query("events")
        .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
        .filter((q) => q.eq(q.field("eventType").split(".")[0], args.entityTypeSlug))
        .order("desc")
        .take(args.limit ?? 100)

      const entityIds = [...new Set(events.map((e) => e.entityId))]
      const visibleEntityIds = await filterVisibleEntityIds(ctx, actor, args.entityTypeSlug, entityIds)

      return events.filter((e) => visibleEntityIds.has(e.entityId))
    }

    return []
  },
})

async function filterVisibleEntityIds(
  ctx: QueryCtx,
  actor: ActorContext,
  entityTypeSlug: string,
  entityIds: Id<"entities">[]
): Promise<Set<Id<"entities">>> {
  const scopeFilters = await getScopeFilters(ctx, actor, entityTypeSlug)
  if (scopeFilters.length === 0 && actor.actorType !== "system") {
    return new Set(entityIds)
  }

  const visible = new Set<Id<"entities">>()
  for (const entityId of entityIds) {
    const entity = await ctx.db.get(entityId)
    if (entity) {
      const scoped = applyScopeFiltersToQuery([entity], scopeFilters)
      if (scoped.length > 0) {
        visible.add(entityId)
      }
    }
  }
  return visible
}
```

**Why filter events by entity visibility?**

- Events contain entity data (in payload)
- If you can't see the entity, you shouldn't see its events
- This prevents information leakage through audit trails

**Important: Event payload masking**

For complete security, event payloads should also be field-masked. This is a refinement to add:

```typescript
const fieldMask = await getFieldMask(ctx, actor, entityTypeSlug)
const maskedEvents = events.map(e => ({
  ...e,
  payload: applyFieldMaskToPayload(e.payload, fieldMask)
}))
```

### Step 6: Update Built-in Tools

Built-in tools (`tools/entities.ts`) call entity operations. They must use the secure versions.

**Current code** (insecure):
```typescript
export const entityCreate = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    type: v.string(),
    data: v.any(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entityType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", args.type)
      )
      .first()

    if (!entityType) {
      throw new Error(`Entity type not found: ${args.type}`)
    }

    const entityId = await ctx.db.insert("entities", {
      organizationId: args.organizationId,
      entityTypeId: entityType._id,
      status: args.status ?? "active",
      data: args.data,
      // ... no permission check!
    })
  },
})
```

**New code** (secure):
```typescript
export const entityCreate = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    type: v.string(),
    data: v.any(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await buildActorContext(ctx, {
      organizationId: args.organizationId,
      actorType: args.actorType as ActorType,
      actorId: args.actorId,
    })

    await assertCanPerform(ctx, actor, "create", args.type)

    const entityType = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", args.type)
      )
      .first()

    if (!entityType) {
      throw new Error(`Entity type not found: ${args.type}`)
    }

    const now = Date.now()
    const entityId = await ctx.db.insert("entities", {
      organizationId: args.organizationId,
      entityTypeId: entityType._id,
      status: args.status ?? "active",
      data: args.data,
      searchText: buildSearchText(args.data, entityType.searchConfig),
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("events", {
      organizationId: args.organizationId,
      entityId,
      eventType: `${args.type}.created`,
      payload: { data: args.data },
      actorId: actor.actorId,
      actorType: actor.actorType,
      timestamp: now,
    })

    return { id: entityId }
  },
})
```

**Key change**: The tool receives `actorId` and `actorType` from the agent execution, builds an ActorContext, and checks permissions before operating.

---

## Testing Strategy

### Unit Tests

1. **Query returns only scoped records**
   - Create 5 sessions for different teachers
   - Query as teacher A
   - Assert only teacher A's sessions returned

2. **Query returns only allowed fields**
   - Create session with all fields
   - Query as teacher (limited field mask)
   - Assert payment fields not present

3. **Create fails without permission**
   - Create actor with no create policy
   - Attempt create
   - Assert PermissionError thrown

4. **Update filters input fields**
   - Create teacher with limited field mask
   - Attempt to update payment field
   - Assert payment field not in result

5. **Delete respects scope**
   - Create session for teacher A
   - Attempt delete as teacher B
   - Assert PermissionError thrown

### Integration Tests

1. **End-to-end teacher flow**
   - Create org, teacher user, teacher role
   - Create policies for session:list, session:read, session:update
   - Create scope rule: teacherId == actor.userId
   - Create field mask: [id, studentName, startTime, status]
   - Create sessions for multiple teachers
   - Query as teacher → only own sessions with limited fields
   - Update own session → success
   - Update other's session → error

2. **Admin sees everything**
   - Create admin role with wildcard policies
   - Query all entity types → all records, all fields
   - Update any record → success

3. **Built-in tools respect permissions**
   - Execute entity.query tool as teacher
   - Assert tool returns scoped, masked data

### Manual Testing Checklist

- [ ] Dashboard loads without errors (may show less data for restricted users)
- [ ] API queries return correct data per role
- [ ] Create/update/delete work for permitted users
- [ ] Create/update/delete fail for unpermitted users
- [ ] Events are created for all mutations
- [ ] Event queries respect entity visibility

---

## Migration Plan

### Backward Compatibility

To avoid breaking existing functionality during migration:

1. **Keep old queries temporarily** - Rename to `listInsecure`, `getInsecure` etc.
2. **Create new secure queries** - `list`, `get` etc.
3. **Update dashboard to use secure queries** - One page at a time
4. **Remove insecure queries** - After all callers migrated

### Data Migration

No data migration needed. Permission tables already exist. The only change is code that reads them.

### Feature Flags (Optional)

If gradual rollout is needed:

```typescript
const ENABLE_PERMISSIONS = process.env.ENABLE_PERMISSIONS === "true"

export const list = query({
  handler: async (ctx, args) => {
    if (!ENABLE_PERMISSIONS) {
      return await listInsecure(ctx, args)
    }
    return await listSecure(ctx, args)
  },
})
```

---

## Success Criteria

Phase 2 is complete when:

1. ✅ `entities.list` respects policies, scope rules, and field masks
2. ✅ `entities.get` respects policies, scope rules, and field masks
3. ✅ `entities.search` respects policies, scope rules, and field masks
4. ✅ `entities.create` requires permission and emits event
5. ✅ `entities.update` requires permission, filters input, emits event
6. ✅ `entities.delete` requires permission, soft deletes, emits event
7. ✅ `entities.link` requires update on source, read on target
8. ✅ `entityTypes.create/update/delete` require admin permission
9. ✅ `events.list` respects underlying entity visibility
10. ✅ Built-in tools (`entity.create`, `entity.query`, etc.) use secure operations
11. ✅ All tests pass
12. ✅ Dashboard continues to function (may show less data per role)

---

## Files Modified

| Path | Changes |
|------|---------|
| `platform/convex/entities.ts` | Replace all queries/mutations with secure versions |
| `platform/convex/entityTypes.ts` | Add permission checks |
| `platform/convex/events.ts` | Add entity visibility filtering |
| `platform/convex/tools/entities.ts` | Use secure operations with actor context |
| `platform/convex/tools/events.ts` | Use secure operations |

---

## Known Limitations

1. **Performance**: Some queries fetch all records then filter. Optimization in later phase.

2. **Complex scope rules**: Only field_match implemented. Relation patterns in Phase 4.

3. **Event payload masking**: Events may contain unmasked data. Refinement needed.

4. **Bulk operations**: No bulk create/update with permissions. Add if needed.

---

## What's Next: Phase 3

Phase 3 secures the remaining data access paths:

- **Template compilation** - Prompt construction uses permission-aware queries
- **Tool permissions** - Check toolPermissions table before executing tools
- **Job actor context** - Jobs store and restore actor identity
- **Custom tool execution** - Pass actor context to tool executor

See [04-phase-3-template-tool-security.md](./04-phase-3-template-tool-security.md) for details.
