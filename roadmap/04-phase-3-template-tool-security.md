# Phase 3: Template & Tool Security

## Document Purpose

This document details the security hardening of template compilation and tool execution—the two paths through which agents access data. By the end of this phase, there are no privileged data access paths in the system.

**Status**: 📋 Planned

**Dependencies**: Phase 2 (Entity System Integration)

**Estimated Scope**: Template engine refactor (~300 lines), tool permission integration (~200 lines), job context (~150 lines)

---

## Context: Why This Phase Is Critical

### The Security Model So Far

After Phase 2, we have:
- ✅ Entity queries respect permissions
- ✅ Entity mutations require authorization
- ✅ Built-in tools use secure operations

But we have NOT secured:
- ❌ Template compilation (prompt construction)
- ❌ Tool permission checking (which tools can the actor use?)
- ❌ Job execution context (who initiated the job?)

### Why Template Security Is Non-Negotiable

Consider this system prompt template:

```
You are a tutoring assistant for {{org.name}}.

Today's sessions:
{{entity.query({ type: "session" })}}

Contact the guardian at {{entity.get({ id: currentSessionId }).guardianPhone}} if needed.
```

If template compilation has direct database access (bypassing permissions):
- A teacher's agent sees ALL sessions (not just theirs)
- A teacher's agent sees `guardianPhone` (even if field-masked)
- The LLM has this data in its context and can output it

**Template compilation is the most dangerous security gap because data that enters the prompt cannot be filtered afterward.**

### The Template Security Principle

From Phase 0:

> Template compilation must not have a privileged data path.
> It can only access data via permission-aware helpers.

This means every template function (`entity.query`, `entity.get`, etc.) must:
1. Know who is executing the template (actor context)
2. Call the same permission-aware functions as tools and dashboard
3. Return only data the actor is allowed to see

### Why Tool Permission Checking Matters

The platform has a `toolPermissions` table that defines:
- Which tools an agent can use
- Under what identity mode (inherit/system/configured)
- What actions are allowed/denied

Currently, this table is never consulted. Any agent can use any tool.

**Example risk**: An agent configured for "read-only" operations could still call `entity.delete` because tool permissions aren't enforced.

### Why Job Context Matters

Jobs are scheduled actions that execute later. They need to:
1. Know who initiated them (for audit and permissions)
2. Execute with appropriate permissions (not god mode)
3. Record actions under the correct actor

Currently, jobs run without any actor context.

---

## Goals

By the end of Phase 3:

1. **Template compilation is permission-aware** - All template functions use the actor's permissions
2. **Tool permissions are enforced** - Agents can only use tools they're authorized for
3. **Jobs have actor context** - Enqueued jobs store the initiator, execution respects permissions
4. **Custom tools receive actor context** - Tool executor knows who is executing
5. **No privileged data paths exist** - Every data access goes through permissions

---

## Non-Goals for This Phase

1. **Template syntax changes** - We keep existing template syntax, just change how it resolves
2. **New tool types** - We secure existing tools, not add new ones
3. **Job scheduling UI** - That's a later feature
4. **Performance optimization** - Correctness first

---

## Implementation Plan

### Step 1: Refactor Template Engine for Permission-Aware Resolution

The template engine currently resolves functions without actor context.

**Current implementation** (`lib/templateEngine.ts`):
```typescript
async function resolveFunction(
  name: string,
  args: unknown,
  context: TemplateContext
): Promise<unknown> {
  if (name === "entity.query") {
    // Direct database access - NO PERMISSION CHECK
    return await ctx.db.query("entities")
      .withIndex("by_org", q => q.eq("organizationId", context.organizationId))
      .filter(q => q.eq(q.field("entityTypeId"), args.type))
      .collect()
  }
  // ...
}
```

**New implementation**:
```typescript
interface TemplateContext {
  organizationId: Id<"organizations">
  userId?: Id<"users">
  threadId?: Id<"threads">
  agentId: Id<"agents">
  actor: ActorContext  // NEW: Actor context for permissions
  agent: AgentMetadata
  thread: ThreadMetadata
  message: string
  timestamp: number
}

async function resolveFunction(
  ctx: QueryCtx,
  name: string,
  args: unknown,
  context: TemplateContext
): Promise<unknown> {
  if (name === "entity.query") {
    // Use permission-aware query
    const queryArgs = args as { type: string; filters?: Record<string, unknown> }
    return await queryEntitiesAsActor(ctx, context.actor, queryArgs.type)
  }

  if (name === "entity.get") {
    const getArgs = args as { type: string; id: Id<"entities"> }
    return await getEntityAsActor(ctx, context.actor, getArgs.type, getArgs.id)
  }

  if (name === "view") {
    const viewArgs = args as { name: string; limit?: number }
    return await resolveViewAsActor(ctx, context.actor, viewArgs.name, viewArgs.limit)
  }

  throw new Error(`Unknown template function: ${name}`)
}
```

**Key changes**:
1. `TemplateContext` now includes `actor: ActorContext`
2. Template functions call permission-aware helpers (same as tools)
3. No direct database access in template resolution

#### 1.1 Update Template Compilation Entry Point

**File**: `platform/convex/lib/templateEngine.ts`

```typescript
export async function compileSystemPrompt(
  ctx: QueryCtx,
  template: string,
  context: TemplateContext
): Promise<string> {
  let result = template

  const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g
  const matches = [...template.matchAll(variableRegex)]

  for (const match of matches) {
    const expression = match[1].trim()
    const value = await resolveExpression(ctx, expression, context)
    result = result.replace(match[0], formatValue(value))
  }

  return result
}

async function resolveExpression(
  ctx: QueryCtx,
  expression: string,
  context: TemplateContext
): Promise<unknown> {
  if (expression.includes("(")) {
    const functionMatch = expression.match(/^(\w+(?:\.\w+)?)\s*\((.*)\)$/s)
    if (functionMatch) {
      const [, funcName, argsStr] = functionMatch
      const args = parseArgs(argsStr)
      return await resolveFunction(ctx, funcName, args, context)
    }
  }

  return resolveVariable(expression, context)
}

function resolveVariable(path: string, context: TemplateContext): unknown {
  const parts = path.split(".")
  let current: unknown = context

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}
```

#### 1.2 Update Agent Execution to Pass Actor Context

**File**: `platform/convex/agent.ts`

The `chat` action compiles the system prompt. It must pass actor context:

```typescript
export const chat = internalAction({
  args: {
    organizationId: v.id("organizations"),
    agentId: v.id("agents"),
    threadId: v.id("threads"),
    message: v.string(),
    actorId: v.string(),
    actorType: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await buildActorContext(ctx, {
      organizationId: args.organizationId,
      actorType: args.actorType as ActorType,
      actorId: args.actorId,
    })

    const agent = await ctx.runQuery(internal.agents.getInternal, { id: args.agentId })
    const config = await ctx.runQuery(internal.agents.getConfig, { agentId: args.agentId })

    const templateContext: TemplateContext = {
      organizationId: args.organizationId,
      userId: args.actorType === "user" ? args.actorId as Id<"users"> : undefined,
      threadId: args.threadId,
      agentId: args.agentId,
      actor,  // Pass actor context
      agent: {
        name: agent.name,
        slug: agent.slug,
      },
      thread: await getThreadMetadata(ctx, args.threadId),
      message: args.message,
      timestamp: Date.now(),
    }

    const systemPrompt = await compileSystemPrompt(ctx, config.systemPrompt, templateContext)

    // Continue with LLM call...
  },
})
```

#### 1.3 Handle Permission Errors in Templates

Templates should handle permission errors gracefully, not crash:

```typescript
async function resolveFunction(
  ctx: QueryCtx,
  name: string,
  args: unknown,
  context: TemplateContext
): Promise<unknown> {
  try {
    if (name === "entity.query") {
      const queryArgs = args as { type: string }
      return await queryEntitiesAsActor(ctx, context.actor, queryArgs.type)
    }
    // ...
  } catch (error) {
    if (error instanceof PermissionError) {
      return []
    }
    throw error
  }
}
```

**Why return empty array instead of throwing?**

- Templates are part of the prompt, not user-visible error messages
- An empty result is better than a broken prompt
- The permission denial is still logged for debugging
- This matches how secure APIs return empty results for unauthorized queries

### Step 2: Implement Tool Permission Checking

Tool permissions control which tools an agent (or actor) can use.

**Current state**: The `toolPermissions` table exists but is never checked.

**File**: `platform/convex/lib/permissions/tools.ts`

```typescript
import { QueryCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import { ActorContext, PermissionResult } from "./types"

export interface ToolPermissionResult {
  allowed: boolean
  reason?: string
  identityMode: "inherit" | "system" | "configured"
  configuredRoleId?: Id<"roles">
}

export async function canUseTool(
  ctx: QueryCtx,
  actor: ActorContext,
  agentId: Id<"agents">,
  toolName: string
): Promise<ToolPermissionResult> {
  const toolPermission = await ctx.db
    .query("toolPermissions")
    .withIndex("by_org", (q) => q.eq("organizationId", actor.organizationId))
    .filter((q) =>
      q.and(
        q.eq(q.field("agentId"), agentId),
        q.eq(q.field("toolName"), toolName)
      )
    )
    .first()

  if (!toolPermission) {
    return {
      allowed: true,
      reason: "No explicit permission defined (default allow)",
      identityMode: "inherit",
    }
  }

  for (const roleId of actor.roleIds) {
    if (toolPermission.allowedRoles?.includes(roleId)) {
      return {
        allowed: true,
        identityMode: toolPermission.identityMode ?? "inherit",
        configuredRoleId: toolPermission.configuredRoleId,
      }
    }
  }

  if (toolPermission.allowedRoles?.length === 0 || !toolPermission.allowedRoles) {
    return {
      allowed: true,
      identityMode: toolPermission.identityMode ?? "inherit",
      configuredRoleId: toolPermission.configuredRoleId,
    }
  }

  return {
    allowed: false,
    reason: `Tool ${toolName} requires one of roles: ${toolPermission.allowedRoles.join(", ")}`,
    identityMode: "inherit",
  }
}

export async function getToolIdentity(
  ctx: QueryCtx,
  actor: ActorContext,
  agentId: Id<"agents">,
  toolName: string
): Promise<ActorContext> {
  const permission = await canUseTool(ctx, actor, agentId, toolName)

  if (!permission.allowed) {
    throw new PermissionError(
      permission.reason ?? "Tool not allowed",
      actor,
      "execute",
      toolName
    )
  }

  switch (permission.identityMode) {
    case "inherit":
      return actor

    case "system":
      return {
        organizationId: actor.organizationId,
        actorType: "system",
        actorId: "system",
        roleIds: await getSystemRoleIds(ctx, actor.organizationId),
      }

    case "configured":
      if (!permission.configuredRoleId) {
        throw new Error(`Tool ${toolName} configured for specific role but none specified`)
      }
      return {
        ...actor,
        roleIds: [permission.configuredRoleId],
      }

    default:
      return actor
  }
}

async function getSystemRoleIds(
  ctx: QueryCtx,
  organizationId: Id<"organizations">
): Promise<Id<"roles">[]> {
  const systemRole = await ctx.db
    .query("roles")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("isSystem"), true))
    .first()

  return systemRole ? [systemRole._id] : []
}
```

**Key concepts**:

1. **`canUseTool`**: Checks if the actor can use a specific tool
2. **`getToolIdentity`**: Returns the actor context the tool should execute under
3. **Identity modes**:
   - `inherit`: Tool runs as the calling actor
   - `system`: Tool runs with system (elevated) permissions
   - `configured`: Tool runs as a specific role

#### 2.1 Integrate Tool Permission Check into Agent Execution

**File**: `platform/convex/agent.ts`

In the tool execution loop:

```typescript
async function executeToolCall(
  ctx: ActionCtx,
  actor: ActorContext,
  agentId: Id<"agents">,
  toolCall: ToolCall,
  config: AgentConfig
): Promise<ToolResult> {
  const { name, arguments: args } = toolCall

  const toolIdentity = await ctx.runQuery(internal.permissions.getToolIdentity, {
    actor,
    agentId,
    toolName: name,
  })

  const tool = config.tools.find((t) => t.name === name)
  if (!tool) {
    return { error: `Unknown tool: ${name}` }
  }

  if (tool.isBuiltin) {
    return await executeBuiltinTool(ctx, toolIdentity, name, args)
  } else {
    return await executeCustomTool(ctx, toolIdentity, tool, args)
  }
}
```

**Note**: The tool executes under `toolIdentity`, which may be different from `actor` if the tool has a non-inherit identity mode.

### Step 3: Implement Job Actor Context

Jobs are scheduled tasks that execute asynchronously. They need to know who initiated them.

#### 3.1 Store Actor Context at Enqueue

**File**: `platform/convex/jobs.ts`

```typescript
export const enqueue = mutation({
  args: {
    type: v.string(),
    payload: v.any(),
    scheduledFor: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
    })

    await assertCanPerform(ctx, actor, "create", "job")

    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("jobs")
        .withIndex("by_idempotency", (q) =>
          q.eq("organizationId", auth.organizationId).eq("idempotencyKey", args.idempotencyKey)
        )
        .first()

      if (existing) {
        return existing._id
      }
    }

    const now = Date.now()
    const jobId = await ctx.db.insert("jobs", {
      organizationId: auth.organizationId,
      type: args.type,
      payload: args.payload,
      status: "pending",
      scheduledFor: args.scheduledFor ?? now,
      idempotencyKey: args.idempotencyKey,
      priority: args.priority ?? 0,
      attempts: 0,
      createdAt: now,
      actorContext: {
        actorType: actor.actorType,
        actorId: actor.actorId,
        roleIds: actor.roleIds.map(id => id.toString()),
      },
    })

    if (!args.scheduledFor || args.scheduledFor <= now) {
      await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId })
    } else {
      await ctx.scheduler.runAt(args.scheduledFor, internal.jobs.processJob, { jobId })
    }

    return jobId
  },
})
```

**Key change**: Jobs now store `actorContext` in the record.

#### 3.2 Restore Actor Context at Execution

**File**: `platform/convex/jobs.ts`

```typescript
export const processJob = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.status !== "pending") {
      return
    }

    await ctx.db.patch(args.jobId, {
      status: "running",
      startedAt: Date.now(),
      attempts: job.attempts + 1,
    })

    let actor: ActorContext
    if (job.actorContext) {
      actor = {
        organizationId: job.organizationId,
        actorType: job.actorContext.actorType as ActorType,
        actorId: job.actorContext.actorId,
        roleIds: job.actorContext.roleIds.map(id => id as Id<"roles">),
      }
    } else {
      actor = buildSystemActorContext(job.organizationId)
    }

    try {
      const result = await executeJobHandler(ctx, actor, job.type, job.payload)

      await ctx.db.patch(args.jobId, {
        status: "completed",
        completedAt: Date.now(),
        result,
      })

      await ctx.db.insert("events", {
        organizationId: job.organizationId,
        entityId: args.jobId,
        eventType: "job.completed",
        payload: { type: job.type, result },
        actorId: actor.actorId,
        actorType: actor.actorType,
        timestamp: Date.now(),
      })
    } catch (error) {
      await handleJobFailure(ctx, args.jobId, job, error)
    }
  },
})

async function executeJobHandler(
  ctx: MutationCtx,
  actor: ActorContext,
  type: string,
  payload: unknown
): Promise<unknown> {
  switch (type) {
    case "reminder.send":
      return await sendReminderJob(ctx, actor, payload)

    case "followup.send":
      return await sendFollowupJob(ctx, actor, payload)

    default:
      throw new Error(`Unknown job type: ${type}`)
  }
}
```

**Key changes**:
1. Restore `actorContext` from job record
2. Fall back to system actor if no context (for legacy jobs)
3. Pass actor to job handlers
4. Log events with correct actor

### Step 4: Pass Actor Context to Custom Tools

Custom tools execute on the Cloudflare Worker (tool-executor). They need to know who is executing them.

#### 4.1 Update Tool Executor Request

**File**: `platform/convex/agent.ts`

```typescript
async function executeCustomTool(
  ctx: ActionCtx,
  actor: ActorContext,
  tool: ToolConfig,
  args: unknown
): Promise<ToolResult> {
  const response = await fetch(`${TOOL_EXECUTOR_URL}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TOOL_EXECUTOR_SECRET}`,
    },
    body: JSON.stringify({
      handlerCode: tool.handlerCode,
      args,
      context: {
        organizationId: actor.organizationId,
        actorId: actor.actorId,
        actorType: actor.actorType,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { error: `Tool execution failed: ${error}` }
  }

  return await response.json()
}
```

**Key change**: The `context` object now includes actor information.

#### 4.2 Update Tool Executor to Use Actor Context

**File**: `platform/tool-executor/src/index.ts`

```typescript
app.post("/execute", async (c) => {
  const { handlerCode, args, context } = await c.req.json()

  const sandboxedFetch = createSandboxedFetch(ALLOWED_DOMAINS)

  const handler = new Function(
    "args",
    "context",
    "fetch",
    `return (async () => { ${handlerCode} })()`
  )

  const result = await handler(args, context, sandboxedFetch)
  return c.json(result)
})
```

**Note**: Custom tool handlers now receive `context` with actor information. They can use this for logging, audit, or conditional logic.

**Example custom tool handler**:
```typescript
// Handler code (stored in tool config)
const { type, data } = args
const { actorId, actorType } = context

console.log(`Creating entity as ${actorType}:${actorId}`)

// Custom logic...
return { success: true, createdBy: actorId }
```

### Step 5: Add Permission-Denied Audit Logging

Permission denials should be logged for security monitoring.

**File**: `platform/convex/lib/permissions/evaluate.ts`

```typescript
export async function canPerform(
  ctx: QueryCtx,
  actor: ActorContext,
  action: Action,
  resource: string,
  record?: Record<string, unknown>
): Promise<PermissionResult> {
  const result = await evaluatePolicies(ctx, actor, action, resource, record)

  if (!result.allowed) {
    await logPermissionDenied(ctx, actor, action, resource, result.reason)
  }

  return result
}

async function logPermissionDenied(
  ctx: QueryCtx,
  actor: ActorContext,
  action: Action,
  resource: string,
  reason?: string
): Promise<void> {
  // Note: Can't insert from QueryCtx, need to use a scheduled mutation
  // or log to external service. For now, console log.
  console.warn("Permission denied", {
    organizationId: actor.organizationId,
    actorId: actor.actorId,
    actorType: actor.actorType,
    action,
    resource,
    reason,
    timestamp: new Date().toISOString(),
  })
}
```

**Future enhancement**: Store permission denials in a dedicated audit log table for security monitoring dashboards.

---

## Testing Strategy

### Template Security Tests

1. **Template respects scope rules**
   - Create teacher with scope rule (sees own sessions only)
   - Compile template with `{{ entity.query({ type: "session" }) }}`
   - Assert only teacher's sessions in compiled prompt

2. **Template respects field masks**
   - Create teacher with limited field mask
   - Compile template with `{{ entity.get({ type: "session", id: sessionId }) }}`
   - Assert restricted fields not in compiled prompt

3. **Template handles permission errors**
   - Create actor with no list permission
   - Compile template with `{{ entity.query({ type: "session" }) }}`
   - Assert empty array in result, no error thrown

### Tool Permission Tests

1. **Allowed tool executes**
   - Configure tool with no restrictions
   - Execute tool
   - Assert success

2. **Denied tool fails**
   - Configure tool with specific role requirement
   - Execute as different role
   - Assert PermissionError

3. **System identity mode works**
   - Configure tool with `identityMode: "system"`
   - Execute as limited user
   - Assert tool can access system-level data

### Job Context Tests

1. **Job stores actor context**
   - Enqueue job as user
   - Assert job record has actorContext

2. **Job executes with stored context**
   - Enqueue job as limited user
   - Execute job
   - Assert job handler receives correct actor

3. **Job events have correct actor**
   - Execute job
   - Assert completion event has original actor

---

## Success Criteria

Phase 3 is complete when:

1. ✅ Template compilation uses `queryEntitiesAsActor` and `getEntityAsActor`
2. ✅ Template functions return scope-filtered, field-masked data
3. ✅ Tool permission check (`canUseTool`) is called before tool execution
4. ✅ Tools execute under correct identity mode
5. ✅ Jobs store actor context at enqueue
6. ✅ Jobs restore and use actor context at execution
7. ✅ Custom tools receive actor context
8. ✅ Permission denials are logged
9. ✅ All tests pass

---

## Files Modified

| Path | Changes |
|------|---------|
| `platform/convex/lib/templateEngine.ts` | Add actor context, use permission-aware queries |
| `platform/convex/lib/permissions/tools.ts` | NEW: Tool permission checking |
| `platform/convex/lib/permissions/index.ts` | Export tool permission functions |
| `platform/convex/agent.ts` | Pass actor to template, check tool permissions |
| `platform/convex/jobs.ts` | Store/restore actor context |
| `platform/tool-executor/src/index.ts` | Pass context to handlers |

---

## Security Verification Checklist

After Phase 3, verify these security properties:

- [ ] A teacher's agent prompt contains only their sessions
- [ ] A teacher's agent prompt contains only allowed fields
- [ ] A teacher cannot use tools restricted to admins
- [ ] A scheduled job runs with the enqueuer's permissions
- [ ] Custom tool handlers receive actor context
- [ ] Permission denials are logged

---

## What's Next: Phase 4

Phase 4 implements the tutoring domain as the first real use case:

- Define tutoring entity types (Session, Student, Teacher, etc.)
- Create tutoring roles and policies
- Implement scheduling logic with permission constraints
- Build tutoring-specific workflows

See [05-phase-4-tutoring-domain.md](./05-phase-4-tutoring-domain.md) for details.
