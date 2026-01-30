# Project Memory

## Overview

Struere is an AI agent platform monorepo with:
- **apps/** - Frontend applications (dashboard, web)
- **packages/** - Shared libraries (struere)
- **platform/** - Backend services (convex, tool-executor)

**Tech Stack**: Next.js 14, Convex, Cloudflare Workers, Clerk Auth, TypeScript

## Architecture Overview

### Monorepo Structure
```
apps/                        packages/                   platform/
├── dashboard (Next.js)      └── struere (SDK + CLI)    ├── convex (Convex functions)
└── web (Marketing)                                     └── tool-executor (CF Worker)
```

### System Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONVEX ARCHITECTURE                                │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────────────────────┐ │
│  │   Dashboard     │    │                    CONVEX                        │ │
│  │   (Next.js)     │◄──►│  • Real-time subscriptions (useQuery)           │ │
│  │                 │    │  • Mutations for all writes                      │ │
│  │  useQuery()     │    │  • Agent execution with LLM calls                │ │
│  │  useMutation()  │    │  • Scheduled functions for jobs                  │ │
│  └─────────────────┘    │  • Built-in tools as mutations                   │ │
│                         └──────────────────────┬──────────────────────────┘ │
│  ┌─────────────────┐                           │                            │
│  │   CLI           │                           │ httpAction()               │
│  │   (struere dev) │───────────────────────────┤                            │
│  │                 │    Sync config to Convex  │                            │
│  │  No bundling    │    (JSON, not JS)         ▼                            │
│  └─────────────────┘    ┌─────────────────────────────────────────────────┐ │
│                         │           CLOUDFLARE WORKER                      │ │
│                         │           (tool-executor.struere.dev)            │ │
│                         │                                                  │ │
│                         │  • Receives tool execution requests from Convex  │ │
│                         │  • Executes user-defined tool handlers           │ │
│                         │  • Returns results to Convex action              │ │
│                         └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Aspect | Decision |
|--------|----------|
| **Agent Config** | Stored in Convex DB as JSON (not JS bundles) |
| **Custom Tools** | Handler code stored in Convex, executed on CF Worker |
| **Built-in Tools** | Convex mutations (`entity.create`, `event.emit`, `job.enqueue`) |
| **LLM Calls** | Convex actions calling Anthropic API directly |
| **Jobs** | Convex scheduled functions |
| **Real-time** | Native Convex subscriptions (no polling) |
| **CLI Workflow** | `struere dev` syncs config to Convex via HTTP |
| **Auth** | Clerk with Convex integration |

### Development Flow (struere dev)
```
LOCAL MACHINE                              CONVEX
─────────────────                          ────────────────────────
src/agent.ts ─┐
src/tools.ts ─┼─ extractConfig() ─► JSON ─── HTTP ──►  1. Verify auth
src/context.ts┘   (no bundling!)                       2. Upsert agent config
                                                       3. Store in Convex DB
CLI watches files (chokidar)
Re-extracts config on save
```

### Agent Execution Flow
```
POST /v1/chat { agentId, message }
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONVEX                                                                      │
│                                                                              │
│  1. VALIDATE API KEY                                                         │
│     • Query apiKeys table by hash                                            │
│                                                                              │
│  2. GET AGENT CONFIG from DB                                                 │
│     • Load active config (dev or prod)                                       │
│     • Get systemPrompt, model, tools                                         │
│                                                                              │
│  3. GET/CREATE THREAD                                                        │
│     • Load or create conversation thread                                     │
│     • Fetch message history                                                  │
│                                                                              │
│  4. CALL LLM (Anthropic API)                                                 │
│     • Uses env.ANTHROPIC_API_KEY                                             │
│     • Iterates on tool calls (max 10)                                        │
│                                                                              │
│  5. EXECUTE TOOLS                                                            │
│     • Built-in: Run Convex mutations (entity.create, etc.)                   │
│     • Custom: Call tool-executor Worker                                      │
│                                                                              │
│  6. STORE & RESPOND                                                          │
│     • Append messages to thread                                              │
│     • Record execution metrics                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Storage Summary
| What | Where | Purpose |
|------|-------|---------|
| Agent metadata | Convex `agents` | Name, slug, config IDs |
| Agent config | Convex `agentConfigs` | systemPrompt, model, tools JSON |
| Threads | Convex `threads` | Conversation metadata |
| Messages | Convex `messages` | Message history |
| Entities | Convex `entities` | Business data |
| Entity Types | Convex `entityTypes` | Schema definitions |
| Events | Convex `events` | Event log |
| Jobs | Convex `jobs` | Scheduled tasks |
| Executions | Convex `executions` | Token usage, metrics |
| API Keys | Convex `apiKeys` | Authentication |
| Organizations | Convex `organizations` | Multi-tenancy |
| Users | Convex `users` | User accounts |
| Roles | Convex `roles` | RBAC |
| Policies | Convex `policies` | Permission rules |

## Platform Services

### Convex (platform/convex)

Core backend with real-time subscriptions and scheduled functions.

**Key Files**:
- `schema.ts` - Database schema (20+ tables)
- `agents.ts` - Agent CRUD, syncDevelopment, deploy
- `agent.ts` - LLM execution action (chat)
- `entities.ts` - Entity CRUD, search, relations
- `entityTypes.ts` - Entity type definitions
- `events.ts` - Event logging and queries
- `jobs.ts` - Job scheduling with Convex scheduler
- `threads.ts` - Conversation management
- `roles.ts` - RBAC roles and policies
- `apiKeys.ts` - API key management
- `executions.ts` - Usage tracking
- `users.ts` - User queries
- `organizations.ts` - Organization queries
- `http.ts` - HTTP endpoints for external access
- `auth.config.ts` - Clerk authentication config
- `tools/` - Built-in tool implementations
  - `entities.ts` - entity.create, entity.get, entity.query, etc.
  - `events.ts` - event.emit, event.query
  - `jobs.ts` - job.enqueue, job.status
- `lib/` - Utility functions
  - `auth.ts` - Auth context helpers
  - `utils.ts` - Common utilities

**Environment Variables**:
```env
ANTHROPIC_API_KEY=sk-ant-...
TOOL_EXECUTOR_URL=https://tool-executor.struere.dev
TOOL_EXECUTOR_SECRET=...
CLERK_JWT_ISSUER_DOMAIN=...
```

### Tool Executor (platform/tool-executor)

Cloudflare Worker for executing custom tool handlers in a sandboxed environment.

**Key Files**:
- `src/index.ts` - Hono app with /execute endpoint
- `wrangler.toml` - Worker configuration

**Environment Variables**:
```env
TOOL_EXECUTOR_SECRET=...
```

## Dashboard App (apps/dashboard)

### Framework & Architecture
- **Next.js 14.1.0** with React 18.2, TypeScript, App Router
- **Convex React** for real-time data via hooks
- Client Components for all data-fetching (real-time)
- Dark theme only

### Convex Integration
- `convex.json` - Points to `../../platform/convex`
- `src/providers/convex-provider.tsx` - ConvexProviderWithClerk wrapper
- `src/hooks/use-convex-data.ts` - All typed Convex hooks

### Key Hooks (use-convex-data.ts)
```typescript
useAgents(), useAgent(), useAgentWithConfig()
useCreateAgent(), useUpdateAgent(), useDeleteAgent()
useEntityTypes(), useEntities(), useEntity()
useEvents(), useEntityEvents(), useEmitEvent()
useJobs(), useJobStats(), useRetryJob(), useCancelJob()
useApiKeys(), useCreateApiKey(), useDeleteApiKey()
useExecutionStats(), useRecentExecutions()
useCurrentUser(), useCurrentOrganization()
```

### Key Pages
| Route | Purpose |
|-------|---------|
| `/agents` | List all agents (real-time) |
| `/agents/new` | Create new agent |
| `/agents/[id]` | Agent health dashboard |
| `/agents/[id]/config` | Agent configuration |
| `/agents/[id]/logs` | Execution logs |
| `/agents/[id]/history` | Activity history |
| `/agents/[id]/settings` | Agent settings |
| `/entities` | Entity types list |
| `/entities/[type]` | Entity list (real-time) |
| `/entities/[type]/[id]` | Entity detail |
| `/jobs` | Job dashboard (real-time) |
| `/api-keys` | API key management |
| `/usage` | Usage statistics |
| `/settings` | Organization settings |

### Environment Variables
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CONVEX_URL=https://struere.convex.cloud
```

## Struere Package (packages/struere)

Unified SDK and CLI package for building AI agents.

### Installation
```bash
npm install struere
npx struere init
```

### SDK Exports
```typescript
import { defineAgent, defineTools, defineContext, defineConfig } from 'struere'
```

- `defineAgent(config)` - Creates/validates agent configurations
- `defineTools(tools)` - Validates and wraps tool definitions
- `defineContext(fn)` - Wraps context functions with error handling
- `defineConfig(config)` - Creates framework config with defaults

### Key Types
- **AgentConfig**: name, version, systemPrompt, model, tools, state, context
- **ModelConfig**: provider (anthropic/openai/google), name, temperature, maxTokens
- **ToolReference**: name, description, parameters, handler
- **FrameworkConfig**: port, host, cors, logging, auth

### Default Model
Anthropic claude-sonnet-4-20250514, temperature 0.7, 4096 tokens

### CLI Commands
| Command | Purpose |
|---------|---------|
| `init` | Initialize new Struere project |
| `dev` | Sync agent config to Convex (live reload) |
| `build` | Validate agent configuration |
| `deploy` | Deploy agent to production |
| `login/logout` | Browser-based OAuth authentication |
| `whoami` | Display current logged-in user |
| `validate` | Validate agent configuration |
| `test` | Run YAML-based test conversations (via Convex API) |
| `logs` | View recent execution logs |
| `state` | Inspect conversation thread state |

### Key Files
- `src/index.ts` - SDK exports (defineAgent, defineTools, etc.)
- `src/types.ts` - TypeScript type definitions
- `src/define/` - SDK implementation
- `src/cli/index.ts` - CLI entry point
- `src/cli/commands/` - Command implementations
- `src/cli/utils/` - Utilities (credentials, convex, scaffold)
- `src/cli/templates/` - Project scaffolding templates
- `src/bin/struere.ts` - Binary entry point

### Configuration Files
- `struere.json` - Project metadata (agentId, team, slug)
- `struere.config.ts` - Framework config (port, CORS, logging)
- `~/.struere/credentials.json` - Auth tokens

### Environment Variables
- `STRUERE_CONVEX_URL` - Convex deployment URL (default: https://struere.convex.cloud)
- `STRUERE_API_KEY` - For production deployments
- `STRUERE_AUTH_URL` - Auth callback URL (default: https://app.struere.dev)

## Built-in Tools

Agents can use these tools (implemented as Convex mutations):

| Tool | Description |
|------|-------------|
| `entity.create` | Create a new entity |
| `entity.get` | Get entity by ID |
| `entity.query` | Query entities by type/filters |
| `entity.update` | Update entity data |
| `entity.delete` | Soft-delete entity |
| `entity.link` | Create entity relation |
| `entity.unlink` | Remove entity relation |
| `event.emit` | Emit custom event |
| `event.query` | Query events |
| `job.enqueue` | Schedule a job |
| `job.status` | Get job status |

## Web App (apps/web)

Marketing/landing page for Struere platform.

- Next.js 14.1.0, React 18.2, Tailwind CSS 3.4
- Dark theme (#0a1628 background)
- Hero section with waitlist signup
- Vercel deployment ready

## Development

### Local Development
```bash
cd platform/convex && npx convex dev

cd apps/dashboard && npm run dev

cd platform/tool-executor && npm run dev
```

### CLI Development
```bash
cd packages/struere && bun run dev
```

### Deployment

**CLI to npm**:
```bash
cd packages/struere
npm publish
```

**Convex functions**:
```bash
cd platform/convex && npx convex deploy
```

**Tool executor**:
```bash
cd platform/tool-executor && wrangler deploy
```

## Server Management

- Never initialize a server, always assume it is already running
- Do not manage any fallback logic
- Do not keep any legacy code or backwards compatibility
- Do not write any comments on the code
