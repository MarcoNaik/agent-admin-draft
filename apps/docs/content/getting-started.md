---
title: "Getting Started"
description: "Install Struere and create your first agent"
section: "Getting Started"
order: 2
---

## Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** installed
- **Bun** installed (`curl -fsSL https://bun.sh/install | bash`) — used as the package manager
- A **Struere account** — sign up at [app.struere.dev](https://app.struere.dev) (uses Clerk for authentication)
- An **Anthropic API key** — set on your Convex deployment as the `ANTHROPIC_API_KEY` environment variable

Struere is a hosted platform backed by Convex. When you create an account and organization, your Convex deployment is provisioned automatically.

## Installation

Install the Struere package as a project dependency:

```bash
npm install struere
```

## Initialize a Project

Run the init command to scaffold an organization-centric project:

```bash
npx struere init
```

This command will:

1. Open a browser for authentication (sign in with your Struere account)
2. Prompt you to select an organization
3. Create the project directory structure
4. Write a `struere.json` configuration file with your organization details
5. Run `bun install` to install dependencies

### Project Structure

After initialization, your project will have this structure:

```
my-org/
├── struere.json
├── agents/
│   └── (your agent definitions)
├── entity-types/
│   └── (your entity type schemas)
├── roles/
│   └── (your role definitions with policies)
├── triggers/
│   └── (your trigger automations)
└── tools/
    └── index.ts
```

### struere.json

The configuration file identifies your organization:

```json
{
  "version": "2.0",
  "organization": {
    "id": "org_abc123",
    "slug": "acme-corp",
    "name": "Acme Corp"
  }
}
```

## Create Your First Agent

Create a file at `agents/my-agent.ts`:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "My First Agent",
  slug: "my-first-agent",
  version: "0.1.0",
  systemPrompt: "You are a helpful assistant for {{organizationName}}. Current time: {{currentTime}}.",
  model: {
    provider: "anthropic",
    name: "claude-sonnet-4",
  },
  tools: ["entity.query", "event.emit"],
})
```

This defines an agent that:
- Uses Claude Sonnet 4 as its LLM
- Has access to query entities and emit events
- Receives the organization name and current time in its system prompt via template variables

## Define an Entity Type

Create a file at `entity-types/customer.ts`:

```typescript
import { defineEntityType } from 'struere'

export default defineEntityType({
  name: "Customer",
  slug: "customer",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string", format: "email" },
      plan: { type: "string", enum: ["free", "pro", "enterprise"] },
    },
    required: ["name", "email"],
  },
  searchFields: ["name", "email"],
})
```

## Define a Role

Create a file at `roles/support.ts`:

```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "support",
  description: "Support agents with read access to customers",
  policies: [
    { resource: "customer", actions: ["list", "read"], effect: "allow" },
    { resource: "customer", actions: ["delete"], effect: "deny" },
  ],
})
```

## Start Development

Run the dev command to sync your definitions to the Convex backend:

```bash
npx struere dev
```

You should see output like:

```
✓ Logged in as you@example.com
✓ Loaded 1 agent, 1 entity type, 1 role, 0 triggers
✓ Synced to development environment
  Watching for changes...
```

The `dev` command will:

1. Auto-login if you are not authenticated (opens a browser)
2. Load all resource definitions from `agents/`, `entity-types/`, `roles/`, `triggers/`, and `tools/`
3. Sync everything to your Convex backend in the **development** environment
4. Watch for file changes and re-sync automatically

Every time you save a file, the CLI re-syncs your changes.

## Test Your Agent

Once synced, you can interact with your agent in two ways:

### Via the Dashboard

1. Open [app.struere.dev](https://app.struere.dev) and navigate to **Agents**
2. Select your agent ("My First Agent")
3. Use the built-in chat interface to send a message

### Via the API

First, create an API key in the dashboard under **Settings > API Keys**. Select the **development** environment.

Then send a request using the slug-based endpoint:

```bash
curl -X POST https://your-deployment.convex.site/v1/agents/my-first-agent/chat \
  -H "Authorization: Bearer sk_dev_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, what can you do?"}'
```

You should receive a JSON response:

```json
{
  "threadId": "jd7abc123...",
  "message": "Hello! I'm your assistant for Acme Corp. I can query your data and log events. How can I help?",
  "usage": {
    "inputTokens": 245,
    "outputTokens": 32,
    "totalTokens": 277
  }
}
```

Your Convex deployment URL is shown in the dashboard under **Settings** or in your Convex dashboard at [dashboard.convex.dev](https://dashboard.convex.dev).

## Deploy to Production

When you are ready to go live, deploy your agents to the production environment:

```bash
npx struere deploy
```

This promotes all agent configurations to the production environment where they are accessible via production API keys (prefixed `sk_prod_`).

## Next Steps

- [CLI Overview](./cli/overview) — Learn all available CLI commands
- [Agent Configuration](./sdk/define-agent) — Configure models, tools, and system prompts
- [Entity Types](./sdk/define-entity-type) — Define structured data schemas
- [Roles & Permissions](./sdk/define-role) — Set up access control
- [Triggers](./sdk/define-trigger) — Build event-driven automations
