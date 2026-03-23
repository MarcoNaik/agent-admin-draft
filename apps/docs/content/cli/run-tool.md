---
title: "struere run-tool"
description: "Run a tool as it would execute during a real agent conversation"
section: "CLI"
order: 13
---

# struere run-tool

The `run-tool` command executes a tool exactly as it would during a real agent conversation — with the same permission checks, identity resolution, and sandbox infrastructure. This is especially useful for testing custom tools that run on the isolated tool-executor service, where debugging is harder.

## Usage

```bash
# Run a built-in tool
npx struere run-tool <agent-slug> <tool-name> --args '<json>'

# Query entities
npx struere run-tool support entity.query --args '{"type": "contact", "limit": 5}'

# Create an entity
npx struere run-tool support entity.create --args '{"type": "order", "data": {"amount": 100}}'

# Run against production
npx struere run-tool support entity.query --env production --args '{"type": "contact"}' --confirm

# Read args from a file
npx struere run-tool support my-custom-tool --args-file ./test-args.json

# Output full JSON result
npx struere run-tool support entity.query --args '{"type": "contact"}' --json
```

## Options

| Flag | Description |
|------|-------------|
| `--env <environment>` | Environment: `development` or `production`. Default: `development` |
| `--args <json>` | Tool arguments as a JSON string. Default: `{}` |
| `--args-file <path>` | Read tool arguments from a JSON file instead of `--args` |
| `--json` | Output the full JSON result including tool metadata, duration, and identity |
| `--confirm` | Skip the production confirmation prompt |

## What It Does

1. Resolves the agent by slug in the target environment
2. Finds the tool in the agent's tool configuration
3. Builds an ActorContext with the agent's permissions and identity mode
4. Checks tool permissions via the permission engine
5. Routes execution: built-in tools run in Convex, custom tools run on the sandboxed tool-executor
6. Returns the result with execution metadata

## Default Output

```
✔ Ran entity.query on support (development) in 245ms

──────────────────────────────────────────────────
[{ "_id": "abc123", "data": { "name": "John Doe" } }]
──────────────────────────────────────────────────

Identity: user (inherit mode)
```

## JSON Output

With `--json`, the command outputs the full result object:

```json
{
  "tool": { "name": "entity.query", "isBuiltin": true },
  "agent": { "name": "Support Bot", "slug": "support" },
  "environment": "development",
  "result": [{ "_id": "abc123", "data": { "name": "John Doe" } }],
  "durationMs": 245,
  "identity": { "actorType": "user", "identityMode": "inherit" }
}
```

## Authentication

The command supports both authentication methods:

| Method | How it works |
|--------|-------------|
| **API key** (`STRUERE_API_KEY`) | Calls `POST /v1/run-tool` on the Convex HTTP endpoint. Environment is determined by the API key. |
| **Clerk session** (`struere login`) | Resolves the agent by slug, then calls the `runTool` action directly via the Convex API. |

If neither is available, the command prompts you to log in (interactive mode) or exits with an error (non-interactive mode).

## Production Safety

When targeting production (`--env production`), the CLI displays a confirmation prompt:

```
WARNING: Running tool against PRODUCTION environment.
  This will execute real operations with real data.
  Press Enter to continue or Ctrl+C to cancel:
```

Use `--confirm` to skip this prompt in CI/CD or scripting contexts.

## Custom Tools

Custom tools are the primary use case for `run-tool`. These tools run on the isolated tool-executor service (Fly.io) in a sandboxed environment, making them harder to debug through normal conversation testing.

```bash
# Test a custom tool
npx struere run-tool my-agent check-inventory --args '{"productId": "SKU-123"}'

# Test with complex args from a file
echo '{"query": "SELECT * FROM orders", "limit": 10}' > test-args.json
npx struere run-tool my-agent run-query --args-file test-args.json
```

Custom tool execution follows the exact same path as production:
- Handler code is sent to the tool-executor service
- The Struere SDK proxy is available (`struere.entity`, `struere.whatsapp`, etc.)
- Fetch is sandboxed to the allowlisted domains
- Callbacks to built-in tools go through the permission engine

## Error Cases

| Scenario | Behavior |
|----------|----------|
| Agent slug not found | `not_found: Agent not found or no config for this environment` |
| Tool not on agent | `tool_not_found: Tool not found on this agent` |
| Permission denied | `permission_denied: <reason>` |
| Custom tool has no handler | `no_handler: Custom tool has no handler code` |
| Tool execution fails | `execution_error: <error message>` |
| Invalid JSON args | `Invalid JSON: <parse error>` |
| Not authenticated | Prompts for login or exits with error |

## Example Workflow

```bash
# Define a custom tool in tools/index.ts
vim tools/index.ts

# Sync to development
npx struere dev

# Test the tool directly
npx struere run-tool my-agent my-custom-tool --args '{"input": "test"}'

# Test with different arguments
npx struere run-tool my-agent my-custom-tool --args-file fixtures/tool-test.json

# Verify it works in production
npx struere run-tool my-agent my-custom-tool --env production --args '{"input": "test"}' --confirm

# Get full JSON for debugging
npx struere run-tool my-agent my-custom-tool --args '{"input": "test"}' --json
```

## Dashboard

The same tool testing functionality is available in the Struere dashboard:

- **Agent Tools tab** — Click the play button next to any tool to test it inline with a JSON editor
- **Tool Playground** (`/system/tools/playground`) — Standalone page where you can select any agent and tool, edit arguments, and run with full result display

Both use the same execution path as the CLI command.
