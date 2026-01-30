# Struere

**Build, deploy, and manage AI agents at scale.**

Struere is a full-stack platform for creating AI agents that can automate business workflows. Define your agent's behavior with a simple SDK, deploy to production with one command, and monitor everything through a real-time dashboard.

## Quick Start

```bash
# Install the CLI
npm install -g struere

# Create a new agent project
struere init my-agent
cd my-agent

# Login to your account
struere login

# Start development (syncs to cloud in real-time)
struere dev
```

## What is Struere?

Struere provides:

- **Agent SDK** - Define AI agents with TypeScript using a simple, declarative API
- **Built-in Tools** - Pre-built tools for managing entities, events, and background jobs
- **Custom Tools** - Add your own tools with sandboxed execution
- **Real-time Dashboard** - Monitor agents, view conversations, track usage
- **Multi-tenancy** - Built-in organization and user management with RBAC

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         YOUR AGENT PROJECT                               │
│                                                                          │
│   src/agent.ts          src/tools.ts          src/context.ts            │
│   └── defineAgent()     └── defineTools()     └── defineContext()       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ struere dev / deploy
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           STRUERE CLOUD                                  │
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │   Dashboard     │    │     Convex      │    │  Tool Executor  │      │
│  │   (Next.js)     │◄──►│   (Backend)     │◄──►│  (CF Worker)    │      │
│  │                 │    │                 │    │                 │      │
│  │  • Monitor      │    │  • Real-time    │    │  • Sandboxed    │      │
│  │  • Configure    │    │  • LLM calls    │    │  • Custom tools │      │
│  │  • Manage       │    │  • Scheduling   │    │  • Safe fetch   │      │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Repository Structure

```
agent-admin-draft/
├── apps/
│   ├── dashboard/          # Admin dashboard (Next.js 14, Convex, Clerk)
│   └── web/                # Marketing site (struere.dev)
│
├── packages/
│   └── struere/            # SDK + CLI package
│
├── platform/
│   ├── convex/             # Backend (Convex functions)
│   └── tool-executor/      # Custom tool runtime (Cloudflare Worker)
│
├── package.json            # Monorepo config (Bun workspaces)
└── turbo.json              # Turborepo pipeline config
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS |
| **Backend** | Convex (real-time database + serverless functions) |
| **Auth** | Clerk |
| **Tool Runtime** | Cloudflare Workers |
| **LLM** | Anthropic Claude (default) |
| **Package Manager** | Bun |
| **Monorepo** | Turborepo |

## Development

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Convex CLI](https://docs.convex.dev/getting-started)
- Node.js 18+

### Setup

```bash
# Clone the repository
git clone https://github.com/struere/agent-admin-draft.git
cd agent-admin-draft

# Install dependencies
bun install

# Start Convex backend
cd platform/convex && npx convex dev

# In another terminal, start the dashboard
cd apps/dashboard && bun run dev
```

### Available Commands

```bash
# Development
bun run dev           # Start Convex + Dashboard
bun run dev:all       # Start all services
bun run dev:cli       # Watch CLI changes
bun run dev:convex    # Convex development
bun run dev:dashboard # Dashboard development

# Deployment
bun run deploy        # Deploy all services
bun run deploy:convex # Deploy Convex functions
```

## Agent SDK

### Defining an Agent

```typescript
// src/agent.ts
import { defineAgent } from 'struere'
import { tools } from './tools'
import { context } from './context'

export default defineAgent({
  name: 'my-agent',
  version: '1.0.0',
  systemPrompt: `
    You are a helpful assistant that manages customer data.
    Use the available tools to create, update, and query entities.
  `,
  model: {
    provider: 'anthropic',
    name: 'claude-sonnet-4-20250514',
    temperature: 0.7,
  },
  tools,
  context,
})
```

### Defining Tools

```typescript
// src/tools.ts
import { defineTools } from 'struere'

export const tools = defineTools([
  {
    name: 'lookup_customer',
    description: 'Look up customer information by email',
    parameters: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Customer email address' },
      },
      required: ['email'],
    },
    handler: async (args, ctx) => {
      // Custom logic here - runs in sandboxed environment
      const response = await fetch(`https://api.example.com/customers?email=${args.email}`)
      return response.json()
    },
  },
])
```

### Built-in Tools

Your agent automatically has access to these tools:

| Tool | Description |
|------|-------------|
| `entity.create` | Create business entities |
| `entity.query` | Query entities with filters |
| `entity.update` | Update entity data |
| `event.emit` | Emit custom events |
| `job.enqueue` | Schedule background jobs |

## Dashboard Features

- **Agent Management** - Create, configure, and deploy agents
- **Real-time Monitoring** - Live conversation feeds, execution logs
- **Entity Browser** - View and manage business data
- **Job Dashboard** - Monitor background jobs with retry/cancel
- **Usage Analytics** - Token usage, execution metrics
- **API Keys** - Manage authentication for external access
- **RBAC** - Role-based access control for teams

## API

### Chat Endpoint

```bash
curl -X POST https://struere.convex.cloud/v1/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent_abc123",
    "message": "Hello, create a new customer named John"
  }'
```

### Response

```json
{
  "threadId": "thread_xyz789",
  "response": "I've created a new customer named John. Their customer ID is cust_123.",
  "toolCalls": [
    {
      "name": "entity.create",
      "result": { "id": "cust_123", "name": "John" }
    }
  ]
}
```

## Environment Variables

### Dashboard (apps/dashboard)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

### Convex (platform/convex)

```env
ANTHROPIC_API_KEY=sk-ant-...
TOOL_EXECUTOR_URL=https://tool-executor.struere.dev
TOOL_EXECUTOR_SECRET=...
CLERK_JWT_ISSUER_DOMAIN=...
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Links

- [Documentation](https://docs.struere.dev)
- [Dashboard](https://app.struere.dev)
- [Marketing Site](https://struere.dev)
