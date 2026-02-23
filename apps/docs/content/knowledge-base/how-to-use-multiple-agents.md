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
  model: { provider: "xai", name: "grok-4-1-fast" },
})
```

```typescript
// agents/billing.ts
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Billing",
  slug: "billing",
  tools: ["entity.query", "entity.update", "event.emit"],
  systemPrompt: "You handle billing inquiries. Look up payment entities and answer questions about charges.",
  model: { provider: "xai", name: "grok-4-1-fast" },
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
  model: { provider: "xai", name: "grok-4-1-fast" },
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

## Related

- [Built-in Tools](/tools/built-in-tools) — Full tool reference including agent.chat
- [Agents](/platform/agents) — Agent execution model
- [How do I handle tool errors?](/knowledge-base/how-to-handle-tool-errors) — Error handling for tool calls
