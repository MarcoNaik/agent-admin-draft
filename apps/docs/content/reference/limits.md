---
title: "Limits and Quotas"
description: "Platform limits for agents, API requests, data, and integrations"
section: "Reference"
order: 3
---

# Limits and Quotas

## Agent Execution

| Limit | Value |
|-------|-------|
| Tool call iterations per request | 10 |
| Multi-agent delegation depth | 3 |
| Cycle detection | Enabled (A → B → A blocked) |
| System prompt template result size | 10 KB per function call |
| Convex action timeout | 10 minutes |

## API

| Limit | Value |
|-------|-------|
| Request body size | Convex default (8 MB) |
| API key environments | `development`, `production`, `eval` |
| Concurrent requests | No platform-enforced limit (Convex limits apply) |

## Data

| Limit | Value |
|-------|-------|
| Default `entity.query` limit | 50 records |
| Maximum `entity.query` limit | 100 records |
| Default `event.query` limit | 50 events |
| Record soft-delete | Records are soft-deleted (status set to `"deleted"`) |
| Environments | `development`, `production`, `eval` |

## Custom Tool Executor

| Limit | Value |
|-------|-------|
| Fetch allowlist | 8 domains |
| Allowed domains | `api.openai.com`, `api.anthropic.com`, `api.stripe.com`, `api.sendgrid.com`, `api.twilio.com`, `hooks.slack.com`, `discord.com`, `api.github.com` |
| Deployment | Fly.io (Hono Node.js) |

Custom tool handlers can only make HTTP requests to the 8 domains listed above. Requests to other domains are blocked by the sandbox.

## Automations

| Limit | Value |
|-------|-------|
| Retry strategy | Exponential backoff: `delay * 2^(attempt-1)` |
| Maximum retries | Configured per trigger |
| Execution modes | Immediate, scheduled |
| Tracked via | `triggerRuns` table |

## WhatsApp (via Kapso)

| Limit | Value |
|-------|-------|
| Message deduplication | By `messageId` |
| Thread mapping | `whatsapp:{phoneNumber}` per connection |
| Payload version | V2 required (`phone_number_id` at root) |

## Evaluations

| Limit | Value |
|-------|-------|
| LLM judge retry on 429 | Up to 5 retries, 30-second delay |
| Judge score range | 1-5 (pass threshold: 3) |
| Judge temperature | 0 (deterministic) |
| Case execution | Parallel within a suite |
| Fixture reset | Full reset on every `struere dev` sync |
