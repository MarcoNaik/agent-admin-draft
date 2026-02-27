# Project Memory

## Overview

Struere is a **permission-aware AI agent platform** monorepo with:
- **apps/** - Frontend applications (dashboard, docs, web)
- **packages/** - Shared libraries (struere SDK + CLI)
- **platform/** - Backend services (convex, tool-executor)

**Tech Stack**: Next.js 14, Convex, Hono/Fly.io, Clerk Auth, TypeScript, Bun

**Core Capability**: Role-based access control (RBAC) with row-level security (scope rules) and column-level security (field masks) enforced across all operations. Full environment isolation (development/production) across all data and permission layers.

## Architecture Overview

### Monorepo Structure
```
apps/                        packages/                   platform/
├── dashboard (Next.js)      └── struere (SDK + CLI)    ├── convex (Backend)
├── docs (Next.js)                                      └── tool-executor (Hono/Fly.io)
└── web (Marketing)
```

### System Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION-AWARE PLATFORM                            │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────────────────────┐ │
│  │   Dashboard     │    │                    CONVEX                        │ │
│  │   (Next.js)     │◄──►│                                                  │ │
│  │                 │    │  ┌─────────────────────────────────────────┐    │ │
│  │  Role-Based UI  │    │  │         PERMISSION ENGINE                │    │ │
│  │  - Admin View   │    │  │  • ActorContext (eager resolution)       │    │ │
│  │  - Teacher View │    │  │  • Policy evaluation (deny overrides)    │    │ │
│  │  - Guardian View│    │  │  • Scope rules (row-level security)      │    │ │
│  └─────────────────┘    │  │  • Field masks (column-level security)   │    │ │
│                         │  │  • Environment isolation (dev/prod)      │    │ │
│  ┌─────────────────┐    │  └─────────────────────────────────────────┘    │ │
│  │   CLI           │    │                      │                           │ │
│  │   (struere)     │────┤  ┌───────────────────┴───────────────────┐      │ │
│  └─────────────────┘    │  │           SECURED OPERATIONS           │      │ │
│                         │  │  • Entities (CRUD + relations)         │      │ │
│  ┌─────────────────┐    │  │  • Events (visibility filtered)        │      │ │
│  │   Webhooks      │    │  │  • Tools (permission checked)          │      │ │
│  │   - Kapso (WA)  │────┤  │  • Templates (permission-aware)        │      │ │
│  │   - Flow        │    │  │  • Triggers (scheduled + immediate)    │      │ │
│  │   - Polar       │    │  └────────────────────────────────────────┘      │ │
│  └─────────────────┘    └─────────────────────────────────────────────────┘ │
│                                        │                                    │
│                                        ▼                                    │
│                         ┌─────────────────────────────────────────────────┐ │
│                         │           HONO NODE.JS SERVER                    │ │
│                         │           (tool-executor.struere.dev)            │ │
│                         │  • Custom tool execution (sandboxed)             │ │
│                         │  • Fetch allowlist (8 domains)                   │ │
│                         │  • Deployed on Fly.io                            │ │
│                         └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Aspect | Decision |
|--------|----------|
| **ActorContext** | Eager resolution (resolve roles once per request), includes environment |
| **Environment Isolation** | `development` / `production` — all data, roles, configs, permissions are per-environment |
| **Agent Config Lookup** | Via `by_agent_env` index on agentConfigs (no FK on agents table) |
| **Field Masks** | Allowlist strategy (fail-safe, new fields hidden by default) |
| **Permission Check API** | `canPerform()` returns result, `assertCanPerform()` throws |
| **Action Granularity** | CRUD + List (5 actions: create, read, update, delete, list) |
| **Scope Rule Types** | Field match + limited relations |
| **Tool Identity Modes** | Configurable (inherit, system, configured) — system mode includes environment |
| **Template Compilation** | Permission-aware (no privileged data paths) |
| **Policy Evaluation** | Deny overrides allow (deny-safe model) |
| **Organization Boundary** | Defense in depth (multiple protective layers) |
| **Agent Config** | Stored in Convex DB as JSON (not JS bundles) |
| **Custom Tools** | Handler code stored in Convex, executed on Hono Node.js server (Fly.io) |
| **Built-in Tools** | Convex mutations (`entity.create`, `event.emit`, `agent.chat`, `calendar.*`, `whatsapp.*`) |
| **LLM Calls** | Convex actions calling LLM APIs directly (xAI, Anthropic, OpenAI, Google) |
| **Triggers** | Immediate or scheduled with retry, tracked via triggerRuns table |
| **Real-time** | Native Convex subscriptions (no polling) |
| **CLI Workflow** | `struere dev` syncs config to Convex via HTTP |
| **Auth** | Clerk with Convex integration |
| **Package Manager** | Bun (not npm) |
| **Default Model** | `grok-4-1-fast` (provider: `xai`) |

### HTTP Endpoints (Convex)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/v1/chat` | POST | Chat by agent ID (Bearer token) |
| `/v1/agents/:slug/chat` | POST | Chat by agent slug (Bearer token, pathPrefix match) |
| `/webhook/clerk` | POST | Clerk webhook for user/org sync |
| `/webhook/kapso/project` | POST | Kapso WhatsApp phone connection |
| `/webhook/kapso/messages` | POST | Kapso WhatsApp inbound messages |
| `/webhook/flow` | POST | Flow payment status updates |
| `/webhook/polar` | POST | Polar payment webhook |

### Database Schema

| Category | Tables |
|----------|--------|
| **User & Org** | organizations, users, userOrganizations, apiKeys (env-scoped), userRoles, pendingRoleAssignments |
| **Agents** | agents (shared), agentConfigs (env-scoped via `by_agent_env`) |
| **Conversation** | threads (env-scoped), messages |
| **Business Data** | entityTypes (env-scoped), entities (env-scoped), entityRelations (env-scoped) |
| **Events & Audit** | events (env-scoped), executions (env-scoped) |
| **Triggers** | triggers, triggerRuns (env-scoped, with schedule/retry) |
| **RBAC** | roles (env-scoped), policies, scopeRules, fieldMasks, toolPermissions |
| **Integrations** | integrationConfigs, whatsappConnections, whatsappMessages, providerConfigs, calendarConnections |
| **Billing** | creditBalances, creditTransactions |
| **Evals** | evalSuites, evalCases, evalRuns (env-scoped), evalResults |

### Environment-Aware Indexes

| Index | Table | Fields |
|-------|-------|--------|
| `by_org_env_slug` | entityTypes | organizationId, environment, slug |
| `by_org_env_type` | entities | organizationId, environment, entityTypeId |
| `by_org_env_type_status` | entities | organizationId, environment, entityTypeId, status |
| `by_org_env_name` | roles | organizationId, environment, name |
| `by_agent_env` | agentConfigs | agentId, environment |
| `by_org_env_type` | events | organizationId, environment, eventType |

**Note:** `entityRelations` has `environment` field but `by_from`/`by_to` indexes don't include it. Environment is enforced via post-index filter. The `by_org_isSystem` index on `roles` also lacks environment — system role lookups use `.collect()` + `.find()` by environment.

## Permission Engine

### Core Files (`platform/convex/lib/permissions/`)

| File | Purpose |
|------|---------|
| `types.ts` | Action, ActorContext (includes environment, isOrgAdmin), Environment, PermissionResult, PermissionError, ScopeFilter, FieldMaskResult |
| `context.ts` | `buildActorContext()`, `buildSystemActorContext()` — both environment-aware, system role lookup filters by environment |
| `evaluate.ts` | `canPerform()`, `assertCanPerform()`, `logPermissionDenied()` |
| `scope.ts` | `getScopeFilters()`, `applyScopeFiltersToQuery()` |
| `mask.ts` | `getFieldMask()`, `applyFieldMask()` |
| `tools.ts` | `canUseTool()`, `getToolIdentity()` — system mode returns environment + isOrgAdmin, `getSystemRoleIds()` filters by environment |
| `index.ts` | Exports + `queryEntitiesAsActor()`, `getEntityAsActor()` |

### Permission Flow

```
Request → Build ActorContext (org, actor, environment, roles)
        → Check Permission (deny overrides allow)
        → Apply Scope Rules (row-level filtering)
        → Apply Field Masks (column-level security)
        → Response
```

### Security Properties

1. **No privileged data paths** - Templates, tools, triggers all go through permissions
2. **Defense in depth** - Organization boundary checked at multiple layers
3. **Environment isolation** - All queries, roles, configs, entities, relations scoped to environment
4. **Deny overrides allow** - Any deny policy blocks access
5. **Fail safe** - New fields hidden by default (allowlist)
6. **Audit trail** - Events capture actor for all mutations

## Integrations

### WhatsApp via Kapso (`platform/convex/lib/integrations/kapso.ts`)

- WhatsApp messaging routed through Kapso service
- Webhooks: `/webhook/kapso/project` (phone connection), `/webhook/kapso/messages` (inbound)
- Tables: `whatsappConnections` (env-scoped), `whatsappMessages`
- Agent routing: inbound → `scheduleAgentRouting` mutation → `routeInboundToAgent` action → `chatAuthenticated`

### Google Calendar (`platform/convex/tools/calendar.ts`)

- Calendar tools: `calendar.list`, `calendar.create`, `calendar.update`, `calendar.delete`, `calendar.freeBusy`
- Table: `calendarConnections` (env-scoped)

### Flow Payments (`platform/convex/lib/integrations/flow.ts`)

- Payment link generation, HMAC-SHA256 signing
- Webhook: `/webhook/flow`

### Polar Payments

- Webhook: `/webhook/polar`

### Integration Config (`platform/convex/integrations.ts`)

Supports 4 providers: `whatsapp` (Kapso), `flow`, `google` (calendar), `zoom`
LLM provider configs stored in `providerConfigs` table: anthropic, openai, google, xai

## Platform Services

### Convex (platform/convex)

Core backend with real-time subscriptions and scheduled functions.

**Key Files**:
- `schema.ts` - Database schema (33 tables)
- `organizations.ts` - Organization CRUD, `remove` (admin-only, schedules cascading hard-delete), `deleteAllOrgData` (internal, deletes all ~27 dependent tables)
- `agents.ts` - Agent CRUD, syncDevelopment, deploy
- `agent.ts` - LLM execution action (chat) with actor context
- `chat.ts` - Authenticated chat actions (send, sendBySlug)
- `entities.ts` - Permission-aware entity CRUD, search, relations
- `events.ts` - Visibility-filtered event logging and queries
- `triggers.ts` - Trigger execution (immediate + scheduled)
- `threads.ts` - Conversation management
- `roles.ts` - RBAC roles and policies
- `http.ts` - HTTP endpoints including webhooks
- `tools/` - Permission-aware built-in tool implementations
  - `entities.ts` - entity.create, entity.get, entity.query, etc.
  - `events.ts` - event.emit, event.query
  - `calendar.ts` - calendar.list, calendar.create, calendar.update, calendar.delete, calendar.freeBusy
  - `whatsapp.ts` - whatsapp.send, whatsapp.getConversation, whatsapp.getStatus
  - `agents.ts` - agent.chat (multi-agent delegation)
  - `helpers.ts` - Tool helper utilities
- `lib/permissions/` - Permission engine
- `lib/integrations/` - Kapso (WhatsApp), Flow integrations
- `lib/templateEngine.ts` - System prompt template processing
- `lib/sync/` - CLI sync helpers (entityTypes, roles, agents, triggers)

### Tool Executor (platform/tool-executor)

Hono Node.js server deployed on Fly.io for executing custom tool handlers in a sandboxed environment.

**Key Files**:
- `src/index.ts` - Hono app with endpoints
- `Dockerfile` + `fly.toml` - Fly.io deployment config

**Endpoints**:
- `GET /health` - Health check
- `POST /execute` - Execute custom tool handler (receives actor context)
- `POST /validate` - Validate handler code syntax

**Sandboxed Fetch Allowlist**:
api.openai.com, api.anthropic.com, api.stripe.com, api.sendgrid.com, api.twilio.com, hooks.slack.com, discord.com, api.github.com

## Docs App (apps/docs)

LLM-first documentation site at `docs.struere.dev`.

- Next.js 14 with static generation
- Markdown content in `content/` directory with gray-matter frontmatter
- LLM endpoints: `/llms.txt` (index), `/llms-full.txt` (full dump), `/{path}.md` (raw per-page)
- Components: sidebar, mobile-nav, table-of-contents, markdown-renderer, code-block, copy-markdown-button
- Brand: cream bg (#F5F1E8), forest green (#1B4332), monospace fonts (DM Mono, Fira Code)
- Path traversal guard in `content.ts` via `isValidSlug()`
- `content.ts` strips leading `# Heading` from content body to prevent duplicate headings
- `generate-llms.ts` adds section grouping to `llms-full.txt`

## Dashboard App (apps/dashboard)

- **Next.js 14.1.0** with React 18.2, Convex React, Clerk Auth
- Real-time data via Convex hooks, dark theme, role-based navigation
- `convex.json` points to `../../platform/convex`
- `src/hooks/use-convex-data.ts` - All typed Convex hooks (62+)
- Context providers: AgentContext, EnvironmentContext, RoleContext
- Modules: Admin (default), Teacher (`/teacher/*`), Guardian (`/guardian/*`)

## Struere Package (packages/struere)

Unified SDK and CLI for building AI agents. Organization-centric architecture.

### SDK Exports
```typescript
import { defineAgent, defineTools, defineConfig, defineEntityType, defineRole, defineTrigger } from 'struere'
```

### Key Types
- **AgentConfig**: name, slug, version, systemPrompt, model, tools
- **ModelConfig**: provider (`anthropic` | `openai` | `google` | `xai` | `custom`), name, temperature?, maxTokens?, apiKey?
- **EntityTypeConfig**: name, slug, schema, searchFields, displayConfig
- **RoleConfig**: name, description, policies, scopeRules, fieldMasks
- **PolicyConfig**: resource, actions, effect (no `priority` field)
- **ScopeRuleConfig**: entityType, field, operator (`eq` | `neq` | `in` | `contains`), value
- **FieldMaskConfig**: entityType, fieldPath, maskType, maskConfig
- **TriggerConfig**: name, slug, on (entityType, action, condition?), actions

### Default Model
`xai/grok-4-1-fast` with temperature 0.7, maxTokens 4096

### Built-in Tools

| Tool | Category | Description |
|------|----------|-------------|
| `entity.create` | Entity | Create entity (params: type, data, status?) |
| `entity.get` | Entity | Get entity by ID (params: id) |
| `entity.query` | Entity | Query entities (params: type, filters?, status?, limit?) |
| `entity.update` | Entity | Update entity (params: id, data, status?, type?) |
| `entity.delete` | Entity | Soft-delete entity (params: id) |
| `entity.link` | Entity | Create relation (params: fromId, toId, relationType, metadata?) |
| `entity.unlink` | Entity | Remove relation (params: fromId, toId, relationType) |
| `event.emit` | Event | Emit event (params: eventType, entityId?, payload?, entityTypeSlug?) |
| `event.query` | Event | Query events (params: eventType?, entityId?, since?, limit?, entityTypeSlug?) |
| `calendar.list` | Calendar | List calendar events |
| `calendar.create` | Calendar | Create calendar event (endTime OR durationMinutes) |
| `calendar.update` | Calendar | Update calendar event |
| `calendar.delete` | Calendar | Delete calendar event |
| `calendar.freeBusy` | Calendar | Check availability |
| `whatsapp.send` | WhatsApp | Send WhatsApp message |
| `whatsapp.getConversation` | WhatsApp | Get conversation history |
| `whatsapp.getStatus` | WhatsApp | Check connection status |
| `agent.chat` | Agent | Delegate to another agent (depth limit: 3, cycle detection) |

### System Events

Entity mutations emit `{type}.created`, `{type}.updated`, `{type}.deleted` events (e.g., `session.created`). Relation events use `entity.linked`, `entity.unlinked`. Trigger events: `trigger.executed`, `trigger.failed`.

### CLI Commands
| Command | Purpose |
|---------|---------|
| `init` | Initialize org-centric project, scaffold directories, generate types |
| `dev` | Watch all files (agents/, entity-types/, roles/, triggers/, tools/, evals/), sync to Convex |
| `deploy` | Deploy all agents to production |
| `add <type> <name>` | Scaffold new agent/entity-type/role/trigger/eval/suite |
| `status` | Compare local vs remote state |
| `pull` | Pull remote resources to local files |
| `entities` | Entity management commands |
| `login/logout` | Browser-based OAuth authentication |
| `whoami` | Display current logged-in user |

### CLI Auto-Run Behavior
- **No `struere.json`?** → Auto-runs `init`
- **Not logged in?** → Auto-runs `login`

### Sync Payload
```typescript
{
  agents: [...],
  entityTypes: [...],
  roles: [...],
  triggers: [...]
}
```

Resources are upserted by slug (agents, entityTypes, triggers) or name (roles).

## Agent Execution Flow

```
HTTP Request: POST /v1/chat
    │
    ▼
[1] HTTP Router (http.ts)
    • Extract Bearer token → validate API key (SHA-256 hash lookup)
    │
    ▼
[2] Chat Action (agent.ts)
    • Load agent + config (via by_agent_env index)
    • Build ActorContext (environment from API key)
    • Process system prompt templates (permission-aware)
    │
    ▼
[3] LLM Loop (max 10 iterations)
    • Call LLM API → process tool calls → permission check → execute → loop
    │
    ▼
[4] Persist & Respond
    • threads.appendMessages() + executions.record()
    • Return { threadId, message, usage }
```

### Multi-Agent Communication (`agent.chat`)

Agents delegate to other agents via `agent.chat` tool. Safety: depth limit 3, cycle detection, per-agent 10-iteration cap, Convex action timeout. Threads share `conversationId`, child threads store `parentThreadId`.

## Environment Isolation

| Scoped per environment | Shared across environments |
|------------------------|---------------------------|
| entityTypes, entities, entityRelations | agents (name, slug, description) |
| roles, policies, scopeRules, fieldMasks | users, organizations, userOrganizations |
| agentConfigs, threads, messages | toolPermissions |
| events, executions, triggerRuns | |
| apiKeys, integrationConfigs | |
| whatsappConnections, calendarConnections | |

### ActorContext

```typescript
interface ActorContext {
  organizationId: Id<"organizations">
  actorType: "user" | "agent" | "system" | "webhook"
  actorId: string
  roleIds: Id<"roles">[]
  isOrgAdmin?: boolean
  environment: Environment
}
```

## Development

### Local Development
```bash
cd platform/convex && npx convex dev
cd apps/dashboard && bun run dev
cd platform/tool-executor && bun run dev
cd apps/docs && bun run dev
```

### Deployment
- **CLI to npm**: `cd packages/struere && npm publish`
- **Convex**: `cd platform/convex && npx convex deploy`
- **Tool executor**: `cd platform/tool-executor && fly deploy`
- **Docs**: Vercel (auto-deploy)

## Known Limitations

1. **Query performance** - Some queries filter in memory after index lookup
2. **Relation environment filtering** - `entityRelations` indexes lack environment; filtered post-index
3. **System role index** - `by_org_isSystem` lacks environment field; uses collect + find
4. **Event payload masking** - Event payloads may contain unmasked historical data

## Server Management

- Never initialize a server, always assume it is already running
- Do not manage any fallback logic
- Do not keep any legacy code or backwards compatibility
- Do not write any comments on the code
