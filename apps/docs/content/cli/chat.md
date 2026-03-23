---
title: "struere chat"
description: "Chat with an agent directly from the terminal"
section: "CLI"
order: 8
---

# struere chat

The `chat` command lets you talk to an agent directly from the terminal — either interactively or as a single message. This is for rapid iteration: test agent behavior, debug tool usage, and verify system prompts without leaving the terminal.

## Usage

```bash
# Interactive chat
npx struere chat <agent-slug>

# Single message mode
npx struere chat my-agent --message "Hello"

# Continue a thread
npx struere chat my-agent --thread <thread-id>

# Different environment
npx struere chat my-agent --env production --confirm

# Verbose output
npx struere chat my-agent --message "Hello" --verbose

# JSON output
npx struere chat my-agent --message "Hello" --json

# Custom channel
npx struere chat my-agent --channel whatsapp
```

## Options

| Flag | Description |
|------|-------------|
| `--env <environment>` | Environment: `development`, `production`, or `eval`. Default: `development` |
| `--message <msg>` | Send a single message and exit. Without this flag, starts an interactive REPL |
| `--thread <id>` | Continue an existing conversation thread |
| `--channel <channel>` | Channel identifier sent to the agent. Default: `api` |
| `-v, --verbose` | Show thread ID, token breakdown (input/output), and tool call info |
| `--json` | Output structured JSON (single-message mode only) |
| `--confirm` | Skip the production environment confirmation prompt |

## Interactive Mode

When no `--message` flag is provided, the CLI starts an interactive REPL session. The prompt shows the agent slug and environment, and the thread is maintained across messages automatically.

Type `exit` or `quit` to end the session. Ctrl+C cancels an in-flight request and returns to the prompt. Ctrl+C at the prompt exits the session.

```
Chat with support (development)
Type 'exit' to quit

You: Hello, what can you do?

Agent:
I can help with bug reports, feature requests, and general questions about the platform.

Tokens: 2817

You: I want to report a bug

Agent:
Sure! Can you describe what happened?

Tokens: 1523

You: exit

Goodbye!
```

## Single-Message Mode

With `--message`, the CLI sends one message and exits. This is useful for scripting, CI pipelines, and quick checks.

```
$ npx struere chat support --message "What are your capabilities?"

──────────────────────────────────────────────────
I can help with bug reports, feature requests, and general questions about the platform.
──────────────────────────────────────────────────
```

Combine with `--json` for structured output:

```json
{
  "threadId": "m573ddwgnpdcrpdjes65451a0x83etn2",
  "message": "I can help with bug reports, feature requests, and general questions about the platform.",
  "usage": {
    "inputTokens": 2630,
    "outputTokens": 187,
    "totalTokens": 2817
  }
}
```

Combine with `--thread` to continue a previous conversation in a script.

## Verbose Output

The `--verbose` flag adds execution metadata after the agent response:

```
Thread: m573ddwgnpdcrpdjes65451a0x83etn2
Tokens: 2630 in / 187 out (2817 total)
Tool call details available in dashboard
```

## Authentication

The command supports both authentication methods:

| Method | How it works |
|--------|-------------|
| **API key** (`STRUERE_API_KEY`) | Calls `POST /v1/agents/{slug}/chat` on the Convex HTTP endpoint. Environment is determined by the API key. |
| **Clerk session** (`struere login`) | Resolves the agent by slug, then calls the `chat:sendBySlug` action directly via the Convex API. |

If neither is available, the command prompts you to log in (interactive mode) or exits with an error (non-interactive mode).

## Production Safety

When targeting production (`--env production`), the CLI displays a confirmation prompt:

```
WARNING: Chatting against PRODUCTION environment.
  This will execute real operations with real data.
  Press Enter to continue or Ctrl+C to cancel:
```

Use `--confirm` to skip this prompt in CI/CD or scripting contexts.

## Thread Continuity

- The first message creates a new thread and returns the thread ID
- Subsequent messages in interactive mode automatically use the same thread
- Use `--thread <id>` to resume a previous conversation from a new session
- Thread IDs are shown in verbose mode or JSON output

## Error Cases

| Scenario | Behavior |
|----------|----------|
| Agent slug not found | Exits with error: `Agent not found: <slug>` |
| No config for environment | Exits with error: `Agent not found or no config for environment: <env>` |
| Not authenticated | Prompts for login or exits with error |
| Request timeout (120s) | Exits with error: `Request timed out` |
| Server error | Exits with error: `Server error: <message>` |

## Example Workflow

```bash
# Edit your agent
vim agents/support.ts

# Sync to development
npx struere dev

# Test interactively
npx struere chat support

# Quick single-message test
npx struere chat support --message "Book an appointment for tomorrow"

# Verbose to see token usage
npx struere chat support --message "Hello" --verbose

# Test in production
npx struere chat support --env production --message "Hello" --confirm

# Script: send message and pipe JSON output
npx struere chat support --message "Help" --json | jq '.message'
```
