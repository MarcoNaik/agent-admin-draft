---
title: "Why Struere"
description: "When to use Struere and how it compares to building agents from scratch"
section: "Getting Started"
order: 3
---

# Why Struere

## The Problem

Building AI agents that do real work requires solving several hard problems simultaneously:

1. **A data layer** — Agents need to read and write structured data, not just generate text. You need schemas, CRUD operations, search, and relationships between records.
2. **Dynamic context** — Static system prompts go stale. Agents need live data injected into their prompts at runtime — entity schemas, query results, thread metadata.
3. **Automation** — When data changes, things should happen automatically. Notifications, follow-ups, cascading updates, scheduled reminders.
4. **Integrations** — Agents need to reach users where they are: WhatsApp, calendars, external databases.
5. **Multi-agent coordination** — Complex workflows need specialist agents that delegate to each other.
6. **Access control** — When agents access real data, you need to control who can see what and who can do what.

Most teams solve these by stitching together raw LLM APIs, custom middleware, and hand-rolled storage. This works for prototypes but breaks down as the number of agents, data types, and integration points grows.

## What Struere Provides

Struere handles all of these as a unified platform:

| Capability | What you get |
|------------|--------------|
| **Entity management** | Typed entities with JSON schemas, relationships, search, soft-delete, and full audit trails |
| **Dynamic system prompts** | Template variables (`{{entityTypes}}`, `{{currentTime}}`) and embedded queries (`{{entity.query(...)}}`) inject live data at runtime |
| **Agent execution** | Tool-call loop with multi-agent delegation (depth limit 3, cycle detection), conversation threading |
| **Triggers & automation** | Event-driven workflows on entity changes with scheduling, retries, and template variable resolution |
| **Integrations** | WhatsApp (via Kapso), Google Calendar, Airtable, Flow/Polar payments — all available as agent tools |
| **Environment isolation** | Development, production, and eval environments with fully isolated data, roles, and configurations |
| **Evaluation system** | YAML-based eval suites with multi-turn conversations, LLM-as-judge scoring, controlled fixture data |
| **Security & RBAC** | Roles with policies (deny overrides allow), scope rules (row-level security), field masks (column-level security) |
| **CLI workflow** | Define agents, entity types, roles, and triggers as code. Sync with `struere dev`, deploy with `struere deploy` |

## When to Use Struere

**Use Struere when:**

- Your agents need a structured data layer (entities with schemas, relationships, CRUD operations)
- You want dynamic system prompts with live data injection
- You need event-driven automations that trigger on data changes
- You want built-in integrations (WhatsApp, Calendar, Airtable) without custom code
- Multiple agents need to collaborate with delegation and shared context
- You need environment isolation between development and production
- You want to test agents with automated evals before deploying

**Consider alternatives when:**

- You need a single stateless chatbot with no data access
- Your use case requires only text generation without tool use
- You are building a one-off script that calls an LLM API once

## How It Compares

### vs. Raw LLM APIs (OpenAI, Anthropic, xAI)

Raw APIs give you text generation and tool calling, but you must build everything else: data storage, conversation threading, prompt templating, automation, error handling, environment management, and evaluation.

Struere wraps the LLM call in a full execution environment with a data layer, dynamic prompts, triggers, and integrations. You define what the agent can do; the platform handles storage, threading, and orchestration.

### vs. LangChain / LlamaIndex

Framework libraries help you chain LLM calls and manage prompts, but they run in your application process. You still need to build the data layer, automation engine, and deployment pipeline.

Struere is a hosted backend (Convex) with a CLI for configuration-as-code. The entity system, triggers, and agent executor are built into the platform, not assembled from library components.

### vs. Custom agent infrastructure

Building your own agent infrastructure gives you maximum flexibility but requires ongoing maintenance of the data layer, tool executor, evaluation system, and deployment pipeline.

Struere provides these as a cohesive platform. The tradeoff is that you work within Struere's data model (entities, entity types, relations) and automation model (triggers, events) rather than designing your own from scratch.

## Getting Started

```bash
npm install struere
npx struere init
npx struere add agent my-agent
npx struere dev
```

See the [Getting Started guide](./getting-started) for the full walkthrough.
