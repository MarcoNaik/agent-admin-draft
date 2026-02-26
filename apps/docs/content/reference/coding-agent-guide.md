---
title: "Coding Agent Guide"
description: "How to feed Struere docs to coding agents like Claude Code, Cursor, and Copilot"
section: "Reference"
order: 5
---

# Coding Agent Guide

Struere's documentation is optimized for consumption by coding agents. This guide explains how to configure your coding agent to use Struere docs effectively.

## LLM Endpoints

| Endpoint | Content | Best for |
|----------|---------|----------|
| `/llms.txt` | Index of all pages with quick reference | Agent discovery and navigation |
| `/llms-full.txt` | Complete documentation in one file | Comprehensive context loading |
| `/llms-sdk.txt` | SDK section only | Agent/data type/role definition tasks |
| `/llms-api.txt` | API reference only | HTTP integration tasks |
| `/llms-cli.txt` | CLI reference only | CLI command questions |
| `/llms-platform.txt` | Platform concepts only | Architecture and permission questions |
| `/llms-tools.txt` | Tools section only | Tool configuration and templates |
| `/llms-integrations.txt` | Integrations only | WhatsApp, Calendar, Payments setup |
| `/{path}.md` | Individual page as raw markdown | Targeted deep-dives |
| `/openapi.yaml` | OpenAPI 3.1 spec for Chat API | API client generation |

## Claude Code (CLAUDE.md)

Add Struere context to your project's `CLAUDE.md`:

```markdown
## Struere

This project uses the Struere AI agent platform.

- Docs index: https://docs.struere.dev/llms.txt
- Full docs: https://docs.struere.dev/llms-full.txt
- API reference: https://docs.struere.dev/llms-api.txt
- SDK reference: https://docs.struere.dev/llms-sdk.txt
- OpenAPI spec: https://docs.struere.dev/openapi.yaml

Key patterns:
- Chat API: POST /v1/agents/:slug/chat with Bearer token (sk_dev_ or sk_prod_)
- SDK exports: defineAgent, defineEntityType, defineRole, defineTrigger
- Default model: grok-4-1-fast (provider: xai)
- Package manager: bun
- CLI: struere dev (sync), struere deploy (production)
- Environments: development, production, eval (fully isolated)
```

## Cursor (.cursorrules)

Add to your `.cursorrules` file:

```
This project uses Struere (https://struere.dev), an AI agent platform with built-in data layer, automation, and integrations.

Documentation:
- Full reference: https://docs.struere.dev/llms-full.txt
- API: https://docs.struere.dev/llms-api.txt
- SDK: https://docs.struere.dev/llms-sdk.txt

When working with Struere:
- Chat API: POST /v1/agents/:slug/chat with Bearer token (sk_dev_ or sk_prod_)
- Use defineAgent, defineEntityType, defineRole, defineTrigger from 'struere'
- Default model is grok-4-1-fast (provider: xai)
- Use bun as the package manager
- Scope rule operators: eq, neq, in, contains (NOT ne)
- Entity link/unlink params: fromId/toId (NOT fromEntityId/toEntityId)
- PolicyConfig has resource, actions, effect (NO priority field)
```

## Common Agent Workflows

### Integrating via API

1. Agent reads `/llms-api.txt` or `/openapi.yaml`
2. Uses slug-based endpoint: `POST /v1/agents/:slug/chat` with Bearer token
3. Handles thread management via `threadId` / `externalThreadId`
4. Handles errors based on status codes

### Creating a new agent

1. Agent reads `/llms-sdk.txt` for `defineAgent` API
2. Scaffolds with `npx struere add agent my-agent`
3. Configures tools, system prompt, and model
4. Syncs with `npx struere dev`

### Setting up permissions

1. Agent reads `/llms-platform.txt` for permission model
2. Creates role with `npx struere add role my-role`
3. Defines policies, scope rules, and field masks
4. Tests with development API key

### Debugging

1. Agent reads the relevant knowledge base article (e.g., `/knowledge-base/how-to-debug-permission-denied.md`)
2. Checks the error pattern against the error codes reference
3. Follows the troubleshooting steps

## Per-Page Raw Markdown

Every documentation page is available as raw markdown at `/{path}.md`. For example:

```
https://docs.struere.dev/introduction.md
https://docs.struere.dev/sdk/define-agent.md
https://docs.struere.dev/platform/permissions.md
https://docs.struere.dev/knowledge-base/how-to-set-up-rbac.md
```

This is useful when an agent needs detailed information about a specific topic without loading the full documentation.
