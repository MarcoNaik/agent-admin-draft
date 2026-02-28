---
title: "struere compile-prompt"
description: "Compile and preview an agent's system prompt after template processing"
section: "CLI"
order: 11
---

# struere compile-prompt

The `compile-prompt` command compiles an agent's system prompt by resolving all template variables and embedded queries, then prints the result. This is useful for debugging template syntax, verifying that `{{entity.query(...)}}` calls return the expected data, and confirming how `{{threadContext.params.X}}` values affect the prompt.

## Usage

```bash
# Compile the default prompt
npx struere compile-prompt <agent-slug>

# Compile with sample context
npx struere compile-prompt my-agent --message "Hello" --channel whatsapp

# Pass thread params
npx struere compile-prompt my-agent --param studentId=abc123 --param lang=en

# Compile against production
npx struere compile-prompt my-agent --env production

# Output full JSON (raw + compiled + context)
npx struere compile-prompt my-agent --json

# Show raw uncompiled template
npx struere compile-prompt my-agent --raw
```

## Options

| Flag | Description |
|------|-------------|
| `--env <environment>` | Environment: `development` or `production`. Default: `development` |
| `--message <msg>` | Sample message injected as `{{message}}` in the template context |
| `--channel <channel>` | Sample channel (`whatsapp`, `widget`, `api`, `dashboard`) injected as `{{threadContext.channel}}` |
| `--param <key=value>` | Custom thread parameter. Repeatable. Injected as `{{threadContext.params.<key>}}` |
| `--json` | Output full JSON with `raw`, `compiled`, and `context` fields |
| `--raw` | Show the raw uncompiled template instead of the compiled output |

## What It Does

1. Resolves the agent by slug in the target environment
2. Loads the agent's system prompt template and tool list
3. Builds a sample template context with the provided options (message, channel, params) or defaults
4. Executes all embedded queries (`{{entity.query(...)}}`, `{{event.query(...)}}`, etc.) with the agent's permissions
5. Resolves all template variables (`{{agentName}}`, `{{currentTime}}`, `{{entityTypes}}`, etc.)
6. Prints the compiled result

## Default Output

```
✓ Compiled prompt

Compiled System Prompt
────────────────────────────────────────────────────────
You are Support Agent, an assistant for My Organization.
Current time: 2026-02-28T14:30:00.000Z

Available data types: [{"name":"Teacher","slug":"teacher",...},{"name":"Student","slug":"student",...}]

Use entity.query to search for records by type.
────────────────────────────────────────────────────────
```

## JSON Output

With `--json`, the command outputs a JSON object containing the raw template, compiled result, and full template context:

```json
{
  "success": true,
  "raw": "You are {{agentName}}, an assistant for {{organizationName}}.\nCurrent time: {{currentTime}}\n...",
  "compiled": "You are Support Agent, an assistant for My Organization.\nCurrent time: 2026-02-28T14:30:00.000Z\n...",
  "context": {
    "organizationId": "org_abc123",
    "organizationName": "My Organization",
    "agentName": "Support Agent",
    "agent": { "name": "Support Agent", "slug": "support" },
    "message": "Hello",
    "threadContext": { "channel": "whatsapp", "params": { "studentId": "abc123" } },
    "entityTypes": [...],
    "roles": [...]
  }
}
```

## Authentication

The command supports both authentication methods:

| Method | How it works |
|--------|-------------|
| **API key** (`STRUERE_API_KEY`) | Calls `POST /v1/compile-prompt` on the Convex HTTP endpoint. Environment is determined by the API key. |
| **Clerk session** (`struere login`) | Resolves the agent by slug, then calls the `compileSystemPrompt` action directly via the Convex API. |

If neither is available, the command prompts you to log in (interactive mode) or exits with an error (non-interactive mode).

## Template Debugging

Use `compile-prompt` to verify template behavior in common scenarios:

### Verify variable resolution

```bash
npx struere compile-prompt my-agent --raw
npx struere compile-prompt my-agent
```

Compare the raw template against the compiled output to confirm all variables resolve correctly.

### Test channel-specific prompts

```bash
npx struere compile-prompt my-agent --channel whatsapp
npx struere compile-prompt my-agent --channel widget
```

If your system prompt branches on `{{threadContext.channel}}`, use this to verify each channel produces the expected prompt.

### Test parameterized prompts

```bash
npx struere compile-prompt my-agent --param customerId=ent_abc123
```

If your prompt uses `{{entity.get({"type": "customer", "id": "{{threadContext.params.customerId}}"})}}`, this confirms the nested template resolves and the entity data loads correctly.

### Inspect embedded query results

```bash
npx struere compile-prompt my-agent --json | jq '.compiled'
```

The compiled output shows the actual data returned by `{{entity.query(...)}}` calls, which helps verify that scope rules and field masks are applied correctly.

## Error Cases

| Scenario | Behavior |
|----------|----------|
| Agent slug not found | Exits with error: `Agent not found: <slug>` |
| No config for environment | Exits with error: `Agent not found or no config for environment: <env>` |
| Not authenticated | Prompts for login or exits with error |
| Template function fails | Embedded query errors appear as `[TEMPLATE_ERROR: ...]` in the compiled output |

## Example Workflow

```bash
# Edit your agent's system prompt
vim agents/support.agent.ts

# Sync to development
npx struere dev

# Compile and preview the prompt
npx struere compile-prompt support

# Test with WhatsApp context
npx struere compile-prompt support --channel whatsapp --param customerId=ent_123

# Check the raw template
npx struere compile-prompt support --raw

# Verify production prompt
npx struere compile-prompt support --env production
```
