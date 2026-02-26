---
title: "How do I handle tool call errors?"
description: "Understand how tool errors are surfaced to agents and how to design agents that recover gracefully"
section: "Knowledge Base"
order: 6
---

# How do I handle tool call errors?

## Quick Answer

When a tool call fails, the error message is returned to the agent as the tool result. The agent sees the error and can retry, try a different approach, or inform the user. Design system prompts that instruct agents on error recovery.

## Step by Step

### 1. How tool errors work

The agent execution loop (up to 10 iterations) processes tool calls sequentially:

```
Agent generates tool call → Permission check → Execute tool → Return result
```

If any step fails, the error is returned as the tool result text. The agent then sees this error in its next LLM call and can decide how to proceed.

### 2. Common error types

| Error | Cause | Agent sees |
|-------|-------|------------|
| Permission denied | Role lacks the required policy | `"Permission denied: cannot perform 'update' on 'payment'"` |
| Entity not found | Invalid entity ID | `"Entity not found"` |
| Validation error | Data does not match data type schema | `"Validation error: 'email' is required"` |
| Tool not found | Tool not in agent's tools list | `"Tool not available: entity.delete"` |
| Custom tool error | Handler code threw an exception | The error message from the handler |

### 3. Design system prompts for recovery

Tell your agent how to handle errors:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Resilient Agent",
  slug: "resilient",
  tools: ["entity.query", "entity.create", "entity.update"],
  systemPrompt: `You are an assistant for {{organizationName}}.

## Error Handling
- If a tool call returns a permission error, inform the user you cannot perform that action.
- If entity.create fails with a validation error, check the schema in entityTypes and fix the data.
- If entity.query returns empty results, try different filters or inform the user no matches were found.
- Never retry the exact same tool call more than once.`,
  model: { provider: "xai", name: "grok-4-1-fast" },
})
```

### 4. Custom tool error handling

Custom tool handlers run on the tool executor server. Throw descriptive errors:

```typescript
export default {
  name: "lookup-inventory",
  handler: async ({ params, context }) => {
    const response = await fetch(`https://api.example.com/inventory/${params.sku}`)
    if (!response.ok) {
      throw new Error(`Inventory lookup failed for SKU ${params.sku}: ${response.status}`)
    }
    return await response.json()
  },
}
```

The error message is passed directly to the agent, so make it actionable.

### 5. Iteration limits

The agent has a maximum of 10 tool call iterations per request. If the agent enters a retry loop, it will hit this limit and the conversation will end with whatever response the agent has generated so far.

## Common Mistakes

- **Not mentioning errors in system prompts.** Without instructions, agents may retry failed calls repeatedly until hitting the 10-iteration limit.
- **Throwing generic errors in custom tools.** `throw new Error("failed")` gives the agent no context. Include what failed and why.
- **Confusing empty results with errors.** `entity.query` returning `[]` is not an error — it means no records matched the filters (possibly due to scope rules).

## Related

- [Built-in Tools](/tools/built-in-tools) — Tool call reference
- [Custom Tools](/tools/custom-tools) — Writing custom tool handlers
- [How do I debug permission denied?](/knowledge-base/how-to-debug-permission-denied) — Permission troubleshooting
- [Limits and Quotas](/reference/limits) — Execution limits
