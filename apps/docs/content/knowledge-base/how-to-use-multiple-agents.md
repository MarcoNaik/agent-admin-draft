---
title: "How do I use multiple agents together?"
description: "Set up multi-agent communication with agent.chat for delegation and specialization"
section: "Knowledge Base"
order: 4
---

# How do I use multiple agents together?

## Quick Answer

Use the `agent.chat` built-in tool to let agents delegate tasks to other agents. Each agent specializes in a domain, and a coordinator agent routes requests to the right specialist. The platform enforces a depth limit of 3 and detects cycles.

## Step by Step

### 1. Define specialist agents

Create focused agents for specific domains:

```typescript
// agents/scheduler.ts
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Scheduler",
  slug: "scheduler",
  tools: ["entity.query", "entity.create", "entity.update", "calendar.list", "calendar.create"],
  systemPrompt: "You are a scheduling specialist. Create and manage sessions and calendar events.",
  model: { model: "openai/gpt-5-mini" },
})
```

```typescript
// agents/billing.ts
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Billing",
  slug: "billing",
  tools: ["entity.query", "entity.update", "event.emit"],
  systemPrompt: "You handle billing inquiries. Look up payment records and answer questions about charges.",
  model: { model: "openai/gpt-5-mini" },
})
```

### 2. Define a coordinator agent

The coordinator uses `agent.chat` to delegate:

```typescript
// agents/coordinator.ts
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Coordinator",
  slug: "coordinator",
  tools: ["agent.chat", "entity.query"],
  systemPrompt: `You are the main coordinator for {{organizationName}}.

Route requests to the right specialist:
- Scheduling questions → delegate to "scheduler"
- Billing questions → delegate to "billing"

Use the agent.chat tool to delegate. Always pass the full context of the user's request.`,
  model: { model: "openai/gpt-5-mini" },
})
```

### 3. How agent.chat works

When the coordinator calls `agent.chat`:

```json
{
  "tool": "agent.chat",
  "args": {
    "agentSlug": "scheduler",
    "message": "The user wants to book a math session with Mr. Smith on Tuesday at 3 PM."
  }
}
```

The platform:
1. Creates a child thread linked to the parent via `conversationId` and `parentThreadId`
2. Executes the target agent with the message
3. Returns the agent's response to the coordinator

### 4. Safety limits

| Limit | Value |
|-------|-------|
| Delegation depth | 3 levels max |
| Cycle detection | Prevents A → B → A loops |
| Per-agent iterations | 10 tool calls per agent |

If agent A delegates to agent B which delegates to agent C, that is depth 3. Agent C cannot delegate further.

## Common Mistakes

- **Not including `agent.chat` in the tools list.** The coordinator must have `agent.chat` listed.
- **Circular delegation.** If agent A delegates to B and B delegates back to A, cycle detection blocks the second delegation.
- **Passing insufficient context.** When delegating, include all relevant information from the user's request in the message. The child agent does not have access to the parent's thread history.
- **Over-delegating.** Not every request needs delegation. If the coordinator can handle a query directly with `entity.query`, it should.

## Best Practices

### Agent Architecture: Split by Audience

The primary axis for splitting agents should be by **audience** (who they talk to), not by function. Instead of a "booking agent" and a "notification agent," create a parent-facing agent and a teacher-facing agent.

Each audience has fundamentally different requirements:

- **Communication style** — A parent-facing agent should be warm and reassuring. A teacher-facing agent should be concise and professional.
- **Data visibility** — Parents should only see their own children. Teachers should see their classes. Splitting by audience maps naturally to scope rules.
- **Security requirements** — Different audiences present different threat vectors. A parent might try to access another family's data. A teacher might try to modify records outside their class.

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Parent Agent",
  slug: "parent-agent",
  tools: ["entity.query", "entity.get", "calendar.list"],
  systemPrompt: `You assist parents of {{organizationName}}.
Be warm and helpful. Only show information about their own children.`,
  model: { model: "openai/gpt-5-mini" },
})
```

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Teacher Agent",
  slug: "teacher-agent",
  tools: ["entity.query", "entity.get", "entity.update", "calendar.list", "calendar.create"],
  systemPrompt: `You assist teachers at {{organizationName}}.
Be concise and professional. Show class rosters and session details for their assigned classes.`,
  model: { model: "openai/gpt-5-mini" },
})
```

A coordinator agent can still sit in front, routing to the right audience-specific agent via `agent.chat`.

### Trigger-Based Inter-Agent Communication

For async workflows, use triggers with `agent.chat` instead of direct agent-to-agent calls. Triggers fire automatically when entities are created, updated, or deleted, making them more reliable for event-driven communication.

A common pattern: a session is created by one agent, and a trigger fires to notify a different agent.

```typescript
import { defineTrigger } from 'struere'

export default defineTrigger({
  name: "Notify Teacher",
  slug: "notify-teacher",
  on: {
    entityType: "session",
    action: "create"
  },
  actions: [
    {
      tool: "agent.chat",
      params: {
        agent: "teacher-agent",
        message: "A new session was just booked: {{entity.data.subject}} on {{entity.data.date}}. Confirm with the teacher."
      }
    }
  ]
})
```

This decouples the booking flow from the notification flow. The parent-facing agent creates the session, and the trigger handles the rest without any direct dependency between agents.

### Per-Agent Security Rules

Each agent should have its own security configuration. Different audiences have different threat vectors, and a single shared permission set creates unnecessary exposure.

Guidelines:

- A **parent-facing agent** should NOT have access to teacher personal info or admin tools. Restrict it to read-only operations on its own family's data.
- A **teacher-facing agent** should NOT be able to modify student records. Limit writes to session-related entities only.
- Use **separate roles** with distinct policies, scope rules, and tool permissions per agent.

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "Parent",
  description: "Role for parent-facing agent interactions",
  policies: [
    { resource: "student", actions: ["read", "list"], effect: "allow" },
    { resource: "session", actions: ["read", "list", "create"], effect: "allow" },
    { resource: "teacher", actions: ["read", "list", "update", "delete", "create"], effect: "deny" },
  ],
  scopeRules: [
    { entityType: "student", field: "data.guardianId", operator: "eq", value: "{{actor.entityId}}" },
  ],
  fieldMasks: [
    { entityType: "teacher", fieldPath: "data.phone", maskType: "hide" },
    { entityType: "teacher", fieldPath: "data.email", maskType: "hide" },
  ],
})
```

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "Teacher",
  description: "Role for teacher-facing agent interactions",
  policies: [
    { resource: "student", actions: ["read", "list"], effect: "allow" },
    { resource: "student", actions: ["update", "delete", "create"], effect: "deny" },
    { resource: "session", actions: ["read", "list", "update", "create"], effect: "allow" },
  ],
  scopeRules: [
    { entityType: "session", field: "data.teacherId", operator: "eq", value: "{{actor.entityId}}" },
  ],
})
```

By pairing each audience-specific agent with a matching role, you ensure that even if a prompt injection attempts to misuse a tool, the permission engine blocks unauthorized access.

## Related

- [Built-in Tools](/tools/built-in-tools) — Full tool reference including agent.chat
- [Agents](/platform/agents) — Agent execution model
- [How do I handle tool errors?](/knowledge-base/how-to-handle-tool-errors) — Error handling for tool calls
