---
title: "Why Struere"
description: "When to use Struere and how it compares to building agents from scratch"
section: "Getting Started"
order: 3
---

# Why Struere

## The Problem

Building AI agents that interact with real data requires solving three hard problems simultaneously:

1. **Access control** — Who can see what? Can this agent delete records? Can this user see another user's data?
2. **Data management** — Structured entities, relationships, audit trails, and environment isolation
3. **Agent orchestration** — Tool execution, multi-agent communication, conversation threading, and evaluation

Most teams solve these by stitching together raw LLM APIs, custom middleware, and hand-rolled permission checks. This works for prototypes but breaks down as the number of agents, roles, and data types grows.

## What Struere Provides

Struere is a **permission-aware AI agent platform** that handles all three problems as a unified system:

| Capability | What you get |
|------------|--------------|
| **RBAC** | Roles with policies (deny overrides allow), scope rules (row-level security), field masks (column-level security) |
| **Entity management** | Typed entities with JSON schemas, relationships, search, soft-delete, and full audit trails |
| **Agent execution** | Tool-call loop with permission checking, multi-agent delegation (depth limit 3, cycle detection), system prompt templates with live data injection |
| **Environment isolation** | Development, production, and eval environments with fully isolated data, roles, and configurations |
| **Evaluation system** | YAML-based eval suites with multi-turn conversations, LLM-as-judge scoring, fixtures for controlled test data |
| **Integrations** | WhatsApp (via Kapso), Google Calendar, Flow/Polar payments — all permission-aware |
| **CLI workflow** | Define agents, entity types, roles, and triggers as code. Sync with `struere dev`, deploy with `struere deploy` |

## When to Use Struere

**Use Struere when:**

- Your agents need to access data with different permission levels per user or role
- You have multiple entity types with relationships (students, teachers, sessions, payments)
- You need audit trails for every agent action
- You want to test agents with automated evals before deploying to production
- You need environment isolation between development and production
- Multiple agents need to collaborate with delegation and shared context

**Consider alternatives when:**

- You need a single stateless chatbot with no data access
- Your use case requires only text generation without tool use
- You are building a one-off script that calls an LLM API once

## How It Compares

### vs. Raw LLM APIs (OpenAI, Anthropic, xAI)

Raw APIs give you text generation and tool calling, but you must build everything else: permission checking, data storage, conversation threading, error handling, environment management, and evaluation.

Struere wraps the LLM call in a full execution environment with permission-checked tool calls, persistent threads, entity management, and audit logging. You define what the agent can do; the platform enforces it.

### vs. LangChain / LlamaIndex

Framework libraries help you chain LLM calls and manage prompts, but they run in your application process. You still need to build the data layer, permission system, and deployment pipeline.

Struere is a hosted backend (Convex) with a CLI for configuration-as-code. The permission engine, entity system, and agent executor are built into the platform, not assembled from library components.

### vs. Custom agent infrastructure

Building your own agent infrastructure gives you maximum flexibility but requires ongoing maintenance of the permission engine, data layer, tool executor, evaluation system, and deployment pipeline.

Struere provides these as a cohesive platform. The tradeoff is that you work within Struere's data model (entities, entity types, relations) and permission model (roles, policies, scope rules, field masks) rather than designing your own from scratch.

## Getting Started

```bash
npm install struere
npx struere init
npx struere add agent my-agent
npx struere dev
```

See the [Getting Started guide](./getting-started) for the full walkthrough.
