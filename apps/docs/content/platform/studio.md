---
title: "Studio"
description: "Browser-based AI coding environment with multi-provider model selection and custom API key support"
section: "Platform Concepts"
order: 8
---

# Studio

Studio is a browser-based coding environment that runs an AI agent inside a sandboxed E2B cloud environment. It connects to your Struere project — pulling your agents, data types, roles, and triggers — so you can build and iterate without leaving the dashboard.

## How It Works

```
Dashboard (Studio Panel)
    |
    v
POST /api/studio/sessions
    |-- Resolve API key (3-tier: direct → OpenRouter → platform)
    |-- Create sandbox session in Convex
    |-- Provision E2B sandbox
    |-- Write opencode.json (provider-specific config)
    |-- Install sandbox-agent + OpenCode
    |-- Pull project files (struere pull)
    |-- Start sandbox-agent server
    |-- Create ACP session
    |
    v
User sends message → POST /api/studio/sessions/{id}/message
    |-- Forward to sandbox via ACP protocol
    |-- OpenCode processes with selected provider/model
    |-- Track token usage
    |-- Deduct credits (when using platform credits)
    |
    v
Real-time events streamed via SSE to dashboard
```

Studio uses [OpenCode](https://opencode.ai) as the universal agent framework. OpenCode supports all major LLM providers through its `opencode.json` configuration, which Studio generates dynamically based on your provider and model selection.

## Providers and Models

Studio supports four LLM providers. Each provider offers models grouped by tier:

| Provider | Fast | Standard | Premium |
|----------|------|----------|---------|
| **xAI** | Grok Code Fast, Grok 4.1 Fast | Grok 4, Grok 3 | — |
| **Anthropic** | Claude Haiku 4.5 | Claude Sonnet 4, Claude Sonnet 4.6 | Claude Opus 4.6 |
| **OpenAI** | GPT-4.1 Mini, o4 Mini | GPT-4.1, GPT-5 | o3 |
| **Google** | Gemini 2.5 Flash | Gemini 2.5 Pro | Gemini 3 Pro |

The default is **xAI / Grok 4.1 Fast** (`grok-4-1-fast`).

## API Key Resolution

Studio resolves API keys using the same 3-tier fallback as agent chat:

1. **Direct provider key** -- If the organization has a key configured for the selected provider in **Settings > Providers**, that key is used. No credits are consumed.
2. **OpenRouter key** -- If the organization has an OpenRouter API key configured, it is used. No credits are consumed.
3. **Platform credits** -- If no keys are found, the platform uses its own OpenRouter key and deducts credits from the organization balance.

When using your own keys, token usage is tracked for analytics but no credits are deducted. Keys are resolved server-side and injected into the sandbox as environment variables — they never reach the browser.

## Configuration

Before starting a session, the Studio config bar lets you choose:

1. **Provider** — xAI, Anthropic, OpenAI, or Google
2. **Model** — Filtered by selected provider, grouped by tier

When you change the provider, the model resets to the first available model for that provider. API key resolution happens automatically based on your configured keys.

Once a session starts, the configuration is locked and displayed as compact badges. You must stop the session to change settings.

## Session Lifecycle

```
[Config Bar: select provider/model]
    |
    v
User sends first message (or clicks Start)
    |
    v
provisioning → ready → active ←→ idle → stopped
                                    |
                                    v
                              (auto-stop after 15 min idle)
```

| Status | Description |
|--------|-------------|
| `provisioning` | E2B sandbox is being created, dependencies installed |
| `ready` | Sandbox is running, ACP session established |
| `active` | Agent is processing a message |
| `idle` | No activity, will auto-stop after idle timeout (default 15 minutes) |
| `stopped` | Session ended (manual stop or idle timeout) |
| `error` | Session failed to start or encountered a fatal error |

## OpenCode Configuration

Studio generates a provider-specific `opencode.json` in the sandbox workspace. The configuration varies by provider:

**xAI** — Uses the OpenAI-compatible endpoint at `api.x.ai/v1`:
```json
{
  "provider": {
    "openai": {
      "options": { "baseURL": "https://api.x.ai/v1" },
      "models": { "grok-4-1-fast": { "name": "grok-4-1-fast" } }
    }
  },
  "model": "openai/grok-4-1-fast"
}
```

**Anthropic** — Native Anthropic provider:
```json
{
  "provider": {
    "anthropic": {
      "models": { "claude-sonnet-4": { "name": "claude-sonnet-4" } }
    }
  },
  "model": "anthropic/claude-sonnet-4"
}
```

**OpenAI** — Native OpenAI provider:
```json
{
  "provider": {
    "openai": {
      "models": { "gpt-4.1": { "name": "gpt-4.1" } }
    }
  },
  "model": "openai/gpt-4.1"
}
```

**Google** — Native Google provider:
```json
{
  "provider": {
    "google": {
      "models": { "gemini-2.5-flash": { "name": "gemini-2.5-flash" } }
    }
  },
  "model": "google/gemini-2.5-flash"
}
```

All configurations include `"instructions": ["CLAUDE.md"]` and permissions for web fetch and web search.

## Environment Variables

Studio injects environment variables into the E2B sandbox. Only the env var for the selected provider is set:

| Provider | Env Var in Sandbox | Source (Platform Mode) |
|----------|-------------------|----------------------|
| xAI | `OPENAI_API_KEY` | `XAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_API_KEY` |
| Google | `GOOGLE_GENERATIVE_AI_API_KEY` | `GOOGLE_GENERATIVE_AI_API_KEY` |

Additional env vars always set:
- `STRUERE_API_KEY` — Temporary API key for the sandbox to call Convex
- `STRUERE_CONVEX_URL` — Convex deployment URL
- `OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX` — Set to `32768`

## Billing

Token usage is always tracked on the session for analytics (`totalInputTokens`, `totalOutputTokens`, `totalCreditsConsumed`).

Credit deductions only occur when using platform credits (no direct or OpenRouter key configured):

```
processUsageEvent
    |
    |-- Always: update session token counters
    |
    |-- Platform credits: deduct credits via billing.deductCredits
    |-- Own key (direct or OpenRouter): skip credit deduction
```

Pricing is per-model and defined in `creditPricing.ts`. See [Limits & Pricing](../reference/limits) for details.

## Database Schema

Studio sessions are stored in the `sandboxSessions` table:

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | `Id<"organizations">` | Owning organization |
| `environment` | `"development" \| "production"` | Environment scope |
| `userId` | `Id<"users">` | User who created the session |
| `status` | string | Session lifecycle status |
| `sandboxProvider` | `"e2b"` | Always E2B |
| `agentType` | `"opencode"` | Always OpenCode |
| `model` | string (optional) | Selected model ID (e.g. `"grok-4-1-fast"`) |
| `provider` | string (optional) | Selected provider (`"xai"`, `"anthropic"`, `"openai"`, `"google"`) |
| `keySource` | string (optional) | Key source (`"platform"`, `"direct"`, `"openrouter"`) |
| `totalInputTokens` | number | Cumulative input tokens |
| `totalOutputTokens` | number | Cumulative output tokens |
| `totalCreditsConsumed` | number | Cumulative credits (micro-USD) |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/studio/sessions` | POST | Create a new session. Body: `{ environment, provider, model }` |
| `/api/studio/sessions/{id}/message` | POST | Send a message. Body: `{ message }` |
| `/api/studio/sessions/{id}/keepalive` | POST | Reset idle timer |
| `/api/studio/sessions/{id}` | DELETE | Stop and clean up session |

### Session Creation Flow

1. Resolve API key using 3-tier fallback (direct provider key → OpenRouter key → platform credits).
2. If using platform credits — check credit balance. Returns 402 if insufficient.
3. Create `sandboxSession` record in Convex.
4. Create temporary API key for sandbox ↔ Convex communication.
5. Provision E2B sandbox with provider-specific env vars.
6. Write project files (`struere.json`, `opencode.json`, `CLAUDE.md`, etc.).
7. Install sandbox-agent and OpenCode.
8. Run `struere pull` to sync project from Convex.
9. Start sandbox-agent server and create ACP session.
10. Update session status to `ready`.

### Message Flow

1. Validate session exists and is ready.
2. If using platform credits — check credit balance.
3. Forward message to sandbox via ACP `session/prompt`.
4. Record token usage asynchronously.
5. Deduct credits if using platform credits.

## Sandbox Contents

After provisioning, the sandbox workspace at `/workspace` contains:

```
/workspace/
├── struere.json          # Org config (id, slug, name)
├── package.json          # Project manifest
├── tsconfig.json         # TypeScript config
├── opencode.json         # Provider-specific OpenCode config
├── CLAUDE.md             # Agent instructions
├── .env                  # STRUERE_API_KEY, STRUERE_CONVEX_URL
├── agents/               # Pulled from Convex (struere pull)
├── entity-types/         # Pulled from Convex
├── roles/                # Pulled from Convex
└── triggers/             # Pulled from Convex
```
