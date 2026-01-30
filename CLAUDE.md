# Project Memory

## Overview

Struere is an AI agent platform monorepo with:
- **apps/** - Frontend applications (dashboard, web)
- **packages/** - Shared libraries (struere SDK + CLI)
- **platform/** - Backend services (convex, tool-executor)

**Tech Stack**: Next.js 14, Convex, Cloudflare Workers, Clerk Auth, TypeScript, Bun

## Architecture Overview

### Monorepo Structure
```
apps/                        packages/                   platform/
├── dashboard (Next.js)      └── struere (SDK + CLI)    ├── convex (Backend)
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
│                         │  • HTTP endpoints for external access            │ │
│  ┌─────────────────┐    └──────────────────────┬──────────────────────────┘ │
│  │   CLI           │                           │                            │
│  │   (struere dev) │───────────────────────────┤ httpAction()               │
│  │                 │    Sync config to Convex  │                            │
│  │  No bundling    │    (JSON, not JS)         ▼                            │
│  └─────────────────┘    ┌─────────────────────────────────────────────────┐ │
│                         │           CLOUDFLARE WORKER                      │ │
│                         │           (tool-executor.struere.dev)            │ │
│                         │                                                  │ │
│                         │  • POST /execute - Run custom tool handlers      │ │
│                         │  • POST /validate - Validate handler code        │ │
│                         │  • GET /health - Health check                    │ │
│                         │  • Sandboxed fetch (allowlist domains)           │ │
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
| **Jobs** | Convex scheduled functions with retry logic |
| **Real-time** | Native Convex subscriptions (no polling) |
| **CLI Workflow** | `struere dev` syncs config to Convex via HTTP |
| **Auth** | Clerk with Convex integration |
| **Package Manager** | Bun (not npm) |

### HTTP Endpoints (Convex)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/v1/chat` | POST | Chat by agent ID (Bearer token) |
| `/v1/agents/:slug/chat` | POST | Chat by agent slug (Bearer token) |
| `/webhook/clerk` | POST | Clerk webhook for user/org sync |

### Agent Execution Flow
```
POST /v1/chat { agentId, message }
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONVEX                                                                      │
│                                                                              │
│  1. VALIDATE API KEY (SHA-256 hash lookup)                                   │
│  2. GET AGENT CONFIG (dev or prod environment)                               │
│  3. GET/CREATE THREAD (load or create conversation)                          │
│  4. CALL LLM (Anthropic API, max 10 tool iterations)                         │
│  5. EXECUTE TOOLS                                                            │
│     • Built-in: Run Convex mutations                                         │
│     • Custom: Call tool-executor Worker                                      │
│  6. STORE & RESPOND (append messages, record metrics)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Schema (23 Tables)

| Category | Tables |
|----------|--------|
| **User & Org** | organizations, users, apiKeys, userRoles |
| **Agents** | agents, agentConfigs |
| **Conversation** | threads, messages |
| **Business Data** | entityTypes, entities, entityRelations |
| **Events & Audit** | events, executions |
| **Jobs** | jobs |
| **RBAC** | roles, policies, scopeRules, fieldMasks, toolPermissions |
| **Packs** | installedPacks |

## Platform Services

### Convex (platform/convex)

Core backend with real-time subscriptions and scheduled functions.

**Key Files**:
- `schema.ts` - Database schema (23 tables)
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
- `users.ts` - User queries + Clerk integration
- `organizations.ts` - Organization queries
- `packs.ts` - Pack installation/management
- `http.ts` - HTTP endpoints for external access
- `auth.config.ts` - Clerk authentication config
- `tools/` - Built-in tool implementations
  - `entities.ts` - entity.create, entity.get, entity.query, etc.
  - `events.ts` - event.emit, event.query
  - `jobs.ts` - job.enqueue, job.status
  - `helpers.ts` - Tool helper utilities
- `lib/` - Utility functions
  - `auth.ts` - Auth context helpers
  - `utils.ts` - Common utilities (nanoid, slug generation)

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
- `src/index.ts` - Hono app with endpoints
- `wrangler.toml` - Worker configuration

**Endpoints**:
- `GET /health` - Health check
- `POST /execute` - Execute custom tool handler
- `POST /validate` - Validate handler code syntax

**Sandboxed Fetch Allowlist**:
- api.openai.com, api.anthropic.com, api.stripe.com
- api.sendgrid.com, api.twilio.com, hooks.slack.com
- discord.com, api.github.com

## Dashboard App (apps/dashboard)

### Framework & Architecture
- **Next.js 14.1.0** with React 18.2, TypeScript, App Router
- **Convex React** for real-time data via hooks
- **Clerk** for authentication
- Client Components for all data-fetching (real-time)
- Dark theme only

### Convex Integration
- `convex.json` - Points to `../../platform/convex`
- `src/providers/convex-provider.tsx` - ConvexProviderWithClerk wrapper
- `src/providers/ensure-user.tsx` - User provisioning on first login
- `src/hooks/use-convex-data.ts` - All typed Convex hooks (62+ hooks)

### Key Hooks (use-convex-data.ts)

**Agents**: useAgents, useAgent, useAgentWithConfig, useCreateAgent, useUpdateAgent, useDeleteAgent, useDeployAgent

**Entity Types**: useEntityTypes, useEntityType, useEntityTypeBySlug, useCreateEntityType, useUpdateEntityType, useDeleteEntityType

**Entities**: useEntities, useEntity, useEntityWithType, useSearchEntities, useCreateEntity, useUpdateEntity, useDeleteEntity, useLinkEntities, useUnlinkEntities, useRelatedEntities

**Events**: useEvents, useEntityEvents, useEventTypes, useEmitEvent

**Jobs**: useJobs, useJob, useJobStats, useEnqueueJob, useRetryJob, useCancelJob

**Roles**: useRoles, useRole, useRoleWithPolicies, useCreateRole, useUpdateRole, useDeleteRole, useAddPolicy, useRemovePolicy, useAssignRoleToUser, useRemoveRoleFromUser, useUserRoles

**API Keys**: useApiKeys, useApiKey, useCreateApiKey, useUpdateApiKey, useDeleteApiKey

**Executions**: useExecutions, useExecutionStats, useUsageByAgent, useRecentExecutions

**Threads**: useThreads, useThread, useThreadWithMessages, useCreateThread, useDeleteThread, useAddMessage

**Users/Orgs**: useUsers, useCurrentUser, useEnsureUser, useCurrentOrganization

**Packs**: usePacks, usePack, useInstallPack, useUninstallPack

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
| `/packs` | Pack management |

### Real-time Components
- `agents-list-realtime.tsx` - Real-time agents list with CRUD
- `entities-list-realtime.tsx` - Real-time entity list with search
- `events-timeline-realtime.tsx` - Real-time event timeline
- `jobs-dashboard-realtime.tsx` - Real-time job dashboard with stats

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
- **ModelConfig**: provider (anthropic/openai/google/custom), name, temperature, maxTokens
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
| `test` | Run YAML-based test conversations |
| `logs` | View recent execution logs |
| `state` | Inspect conversation thread state |

### Key Files
- `src/index.ts` - SDK exports
- `src/types.ts` - TypeScript type definitions
- `src/define/` - SDK implementation
- `src/cli/index.ts` - CLI entry point
- `src/cli/commands/` - Command implementations
- `src/cli/utils/` - Utilities (credentials, convex, scaffold)
- `src/cli/templates/` - Project scaffolding templates

### Configuration Files
- `struere.json` - Project metadata (agentId, team, slug)
- `struere.config.ts` - Framework config (port, CORS, logging)
- `~/.struere/credentials.json` - Auth tokens

### Environment Variables
- `STRUERE_CONVEX_URL` - Convex deployment URL
- `STRUERE_API_KEY` - For production deployments
- `STRUERE_AUTH_URL` - Auth callback URL

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
- Hero section with waitlist signup (Discord webhook integration)
- 7 custom monospace fonts
- Vercel deployment ready (iad1 region)

## Development

### Local Development
```bash
cd platform/convex && npx convex dev

cd apps/dashboard && bun run dev

cd platform/tool-executor && bun run dev
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
