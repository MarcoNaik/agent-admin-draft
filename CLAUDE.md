# Project Memory

## Overview

Struere is an AI agent platform monorepo with:
- **apps/** - Frontend applications (dashboard, web)
- **packages/** - Shared libraries (cli, core, runtime)
- **platform/** - Backend services (api, gateway, shared)

**Tech Stack**: Next.js 14, Hono, Cloudflare Workers, D1, R2, Drizzle ORM, Clerk Auth, TypeScript

## Architecture Overview

### Monorepo Structure
```
apps/                        packages/                   platform/
├── dashboard (Next.js)      ├── cli                    ├── api
└── web (Marketing)          ├── core                   ├── gateway
                             └── runtime                └── shared
```

### Platform Services
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SHARED PACKAGE (platform/shared)                      │
│                                                                              │
│  db/schema.ts                    routes/                                     │
│  • organizations                 createAgentRoutes(middleware)               │
│  • users, agents                 createApiKeyRoutes(middleware)              │
│  • agent_versions                createUsageRoutes(middleware)               │
│  • deployments, executions                                                   │
│  • api_keys, dev_sessions        Factory functions → Hono routers            │
│                                                                              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                       ┌───────────────┴───────────────┐
                       ▼                               ▼
┌──────────────────────────────────┐   ┌──────────────────────────────────────┐
│      API (api.struere.dev)       │   │      GATEWAY (*.struere.dev)         │
│                                  │   │                                      │
│  Dashboard backend               │   │  Agent execution runtime             │
│  • /v1/auth/* - Login/signup     │   │  • /chat - Execute agent             │
│  • /v1/agents/* - CRUD (shared)  │   │  • /v1/dev/sync - WebSocket dev      │
│  • /v1/agents/:id/config         │   │  • /v1/agents/:slug/chat             │
│  • /v1/api-keys/* (shared)       │   │  • Shared routes (agents, keys)      │
│  • /v1/usage/* (shared)          │   │                                      │
│                                  │   │  Bindings: DB, BUNDLES, KV,          │
│  Bindings: DB, BUNDLES, KV       │   │  DEV_SESSIONS, ANTHROPIC_API_KEY     │
└──────────────────────────────────┘   └──────────────────────────────────────┘
```

### Development Flow (struere dev)
```
LOCAL MACHINE                              GATEWAY (DevSessionDO)
─────────────────                          ────────────────────────
src/agent.ts ─┐
src/tools.ts ─┼─ Bun.build() ─► bundle.js ─── WebSocket ──►  1. Verify auth
src/context.ts┘                                              2. Auto-create agent
                                                             3. Upload to R2
CLI watches files (chokidar)                                 4. Update DB records
Re-bundles on save                                           5. Cache in KV

                                           ◄── { url: 'https://slug-dev.struere.dev' }
```

### Agent Execution Flow
```
POST https://my-agent.struere.dev/chat { message: "Hello" }
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GATEWAY                                                                     │
│                                                                              │
│  1. ROUTE BY SUBDOMAIN                                                       │
│     • api.struere.dev → API router                                           │
│     • {slug}-dev.struere.dev → Dev agent (KV cache)                          │
│     • {slug}.struere.dev → Prod agent (R2)                                   │
│                                                                              │
│  2. FETCH BUNDLE from R2 → bundleCode                                        │
│                                                                              │
│  3. DYNAMIC IMPORT (the magic)                                               │
│     const blob = new Blob([bundleCode], { type: 'application/javascript' }) │
│     const agentModule = await import(URL.createObjectURL(blob))              │
│     // agentModule.default = { systemPrompt, model, tools }                  │
│                                                                              │
│  4. CALL LLM (Anthropic API)                                                 │
│     • Uses env.ANTHROPIC_API_KEY (platform secret)                           │
│     • Passes systemPrompt, messages, tools from bundle                       │
│     • Executes tool handlers from bundle if tool_use                         │
│                                                                              │
│  5. STORE & RESPOND                                                          │
│     • KV: conversation history (24h TTL)                                     │
│     • D1: execution metrics (tokens, duration)                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Storage Summary
| What | Where | Purpose |
|------|-------|---------|
| Agent metadata | D1 `agents` | Name, slug, version IDs |
| Version info | D1 `agent_versions` | bundleKey, configHash, metadata |
| Bundle code | R2 `{org}/{slug}/{version}.js` | Executable JS |
| Dev bundle cache | KV `dev:{org}:{slug}` | Fast dev access |
| Conversations | KV `conv:{org}:{id}` | Message history (24h TTL) |
| Execution metrics | D1 `executions` | Tokens, duration, errors |
| LLM API key | Cloudflare Secret | `ANTHROPIC_API_KEY` |

### Key Design Decisions
1. **Shared code in `platform/shared`** - DB schema and common routes live once, used by both api and gateway
2. **Route factory pattern** - `createAgentRoutes(middleware)` lets each service inject its own auth
3. **Dynamic ES module import** - Bundle runs as real JS module inside Worker, tools execute server-side
4. **Platform-managed LLM key** - Single `ANTHROPIC_API_KEY` secret for MVP (per-org keys later)
5. **Regex-based config extraction** - Parse minified bundle to show config in dashboard without executing it

## CLI Deployment

To deploy a new version of the CLI to npm:

```bash
cd packages/cli
npm run deploy:npm <version> "<commit-message>"
```

Example:
```bash
npm run deploy:npm 0.2.12 "feat(cli): add new feature"
```

This command will:
1. Bump the version in package.json and src/index.ts
2. Build the CLI
3. Commit and tag the changes
4. Push to git with tags
5. Publish to npm

## Dashboard App (apps/dashboard)

### Framework & Architecture
- **Next.js 14.1.0** with React 18.2, TypeScript, App Router
- Server-Side Rendering for data-heavy pages
- Client Components for interactive features
- Dark theme only (hardcoded dark class)

### Key Pages
| Route | Purpose |
|-------|---------|
| `/agents` | List all agents (grid/list view, search) |
| `/agents/new` | Create new agent |
| `/agents/[id]` | Agent health & performance dashboard |
| `/agents/[id]/config` | View deployed agent configuration (model, tools, system prompt) |
| `/agents/[id]/data` | Agent data/state viewer |
| `/agents/[id]/functions` | Agent functions/tools viewer |
| `/agents/[id]/files` | Agent files viewer |
| `/agents/[id]/logs` | Execution logs with level filtering |
| `/agents/[id]/history` | Conversation history |
| `/agents/[id]/settings` | Deploy keys, env vars, agent config |
| `/api-keys` | API key management |
| `/usage` | Usage statistics dashboard |

### Authentication
- **Provider**: Clerk (@clerk/nextjs v5.0.0)
- **Protected Routes**: All except /sign-in, /sign-up, /authorize, /api/webhooks, /api/cli
- Tokens passed as Bearer tokens to API requests

### API Integration
- **Client**: `src/lib/api.ts` - Centralized typed API client
- **Base URL**: `NEXT_PUBLIC_API_URL` (default: https://api.struere.dev)
- No caching (`cache: "no-store"`) for real-time data

### Environment Variables
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=https://api.struere.dev
```

## Web App (apps/web)

### Purpose
Marketing/landing page for Struere platform

### Tech Stack
- Next.js 14.1.0, React 18.2, Tailwind CSS 3.4
- Dark theme (#0a1628 background)
- Multiple monospace fonts (DM Mono, IBM Plex, Fira Code, etc.)

### Features
- Hero section with typewriter animation and waitlist signup
- 6-step "How It Works" process
- Vercel deployment ready

### Key Files
- `src/app/page.tsx` - Single-file landing page (556 lines)
- `src/app/api/waitlist/route.ts` - Discord webhook for signups
- No required env vars (optional: DISCORD_WEBHOOK_URL)

## CLI Package (packages/cli)

### Commands
| Command | Purpose |
|---------|---------|
| `init` | Initialize new Struere project |
| `dev` | Sync agent to development with live reload |
| `build` | Build and validate agent for production |
| `deploy` | Deploy agent to production |
| `login/logout` | Browser-based OAuth authentication |
| `whoami` | Display current logged-in user |
| `validate` | Validate agent configuration |
| `test` | Run YAML-based test conversations |
| `logs` | Stream production/development logs |
| `state` | Inspect conversation state |

### Key Dependencies
- commander, chalk, ora, chokidar, yaml
- @struere/runtime, @struere/core

### Configuration Files
- `struere.json` - Project metadata (agentId, team, slug)
- `struere.config.ts` - Framework config (port, CORS, logging)
- `~/.struere/credentials.json` - Auth tokens (mode 0o600)

### Environment Variables
- `STRUERE_API_URL` - API endpoint (default: https://api.struere.dev)
- `STRUERE_GATEWAY_URL` - Gateway for HTTP
- `STRUERE_SYNC_URL` - WebSocket sync endpoint
- `STRUERE_API_KEY` - For production deployments

## Core Package (packages/core)

### Exports
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

## Runtime Package (packages/runtime)

### Core Components
- **AgentExecutor** - Orchestrates agent execution with tool iteration loop (max 10)
- **Providers** - Adapters for Anthropic, OpenAI, Google via AI SDK
- **State Management** - MemoryStateBackend, ConversationStore
- **Serverless Handlers** - Vercel Edge, AWS Lambda

### Execution Flow
1. Load AgentConfig and create provider
2. Retrieve conversation history
3. Call LLM with tools
4. Execute tool calls via handlers
5. Store messages and return response

### Serverless Usage
```typescript
import { createVercelHandler } from '@struere/runtime/serverless/vercel'
export default createVercelHandler(agent, { streaming: true })
export const config = { runtime: 'edge' }
```

## API Platform (platform/api)

### Framework
Hono on Cloudflare Workers with D1 (SQLite) via Drizzle ORM

### Architecture
- Database schema imported from `@struere/platform-shared/db`
- Shared routes (agents, api-keys, usage) imported from `@struere/platform-shared/routes`
- Service-specific routes: auth, auth-clerk, deployments, debug, status

### Key Endpoints
- `GET /health` - Health check
- `POST /v1/auth/signup, /login` - Email/password auth
- `GET /v1/auth/clerk/me` - Clerk auth with CLI token
- `GET/POST/PATCH/DELETE /v1/agents` - Agent CRUD
- `GET /v1/agents/:id/config` - Extract config from deployed bundle
- `POST /v1/agents/:id/deploy` - Deploy agent bundle
- `GET /v1/usage` - Organization usage stats

### Authentication
- **Clerk Auth** - JWT from Clerk JWKS
- **JWT Auth** - Internal HS256 tokens (7-day expiry)
- **API Key Auth** - Permission-based with hash storage

### Environment Variables
```env
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
JWT_SECRET=...
```

### Cloudflare Bindings
- DB: D1 database (struere-db)
- BUNDLES: R2 bucket (struere-bundles)
- SESSIONS: KV namespace

## Gateway Platform (platform/gateway)

### Role
Agent execution layer with subdomain-based routing

### Architecture
- Database schema imported from `@struere/platform-shared/db`
- Shared routes (agents, api-keys, usage) imported from `@struere/platform-shared/routes`
- Service-specific: auth, auth-clerk, deployments, debug, chat handlers, DevSessionDO

### Routing Logic
- `api.struere.dev` → API router
- `{agent-slug}.struere.dev` → Production agent execution
- `{agent-slug}-dev.struere.dev` → Development agent execution
- Reserved: api, gateway, app, www, dashboard, admin

### Agent Execution Flow
1. Extract agent slug from hostname
2. Query database for agent metadata
3. Fetch bundle from R2 bucket
4. Execute via `executeAgent()` or `streamAgent()`
5. Store conversation in KV

### Durable Objects
- **DevSessionDO** - WebSocket dev mode for CLI sync
  - Handles auth, bundle uploads, auto-creates agents
  - Updates development version deployments

### Key Endpoints
- `POST /chat` - Execute agent (non-streaming)
- `GET /v1/dev/sync` - WebSocket for CLI dev sync
- `POST /v1/agents/:slug/chat` - Authenticated API chat

### Environment Variables
```env
JWT_SECRET=...
CLERK_SECRET_KEY=...
CLERK_PUBLISHABLE_KEY=...
ANTHROPIC_API_KEY=...  # Platform LLM API key (Cloudflare secret)
```

### Cloudflare Bindings
- DB: D1 database
- BUNDLES: R2 bucket
- STATE, CONVERSATIONS: KV namespaces
- DEV_SESSIONS: Durable Object namespace
- ANTHROPIC_API_KEY: Secret for LLM API calls

## Shared Platform (platform/shared)

Single source of truth for database schema and common route handlers used by both api and gateway.

### Exports
- **Types**: Organization, User, ApiKey, Agent, AgentVersion, Deployment, Execution, ChatRequest, ChatResponse, SyncMessage, AuthContext, Database
- **Errors**: PlatformError, AuthenticationError (401), AuthorizationError (403), NotFoundError (404), ValidationError (400), ConflictError (409), RateLimitError (429)
- **Schemas**: Zod validation for all major operations
- **Utils**: generateId, generateApiKey, hashApiKey, hashPassword, verifyPassword, generateSlug

### Database (`@struere/platform-shared/db`)
- **Schema**: All Drizzle table definitions (organizations, users, api_keys, agents, agent_versions, deployments, executions, dev_sessions)
- **createDb(d1)**: Factory to create typed Drizzle database instance

| Table | Purpose |
|-------|---------|
| organizations | Multi-tenant orgs with plan (free/pro/enterprise) |
| users | User accounts with Clerk integration |
| api_keys | API key management with permissions |
| agents | AI agents with dev/prod version IDs |
| agent_versions | Version history with bundle_key |
| deployments | Environment deployments (dev/prod) |
| executions | Usage tracking (tokens, duration) |
| dev_sessions | CLI development session tracking |

### Routes (`@struere/platform-shared/routes`)
Factory functions that accept auth middleware and return Hono routers:
- **createAgentRoutes(authMiddleware)**: Agent CRUD operations (GET/POST/PATCH/DELETE)
- **createApiKeyRoutes(authMiddleware)**: API key management (GET/POST/DELETE)
- **createUsageRoutes(authMiddleware)**: Usage statistics (GET /, /by-agent, /recent)

### ID Prefixes
- `agt` - Agent
- `ver` - Version
- `dpl` - Deployment
- `usr` - User
- `org` - Organization
- `msg` - Message
- `conv` - Conversation
- `exe` - Execution

### API Key Formats
- Live: `af_live_*`
- Dev: `af_dev_*`
