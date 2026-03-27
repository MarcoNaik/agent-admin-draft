# Struere

Struere is a **full-stack AI agent platform for business automation**. Users describe what they need in natural language, and Struere creates AI agents that handle customer support, appointments, payments, and more. Built-in data layer, dynamic system prompts, event-driven automation, and integrations.

**Tagline:** Build, deploy, and manage AI agents at scale.

## Tech Stack

- Next.js 14 + TypeScript (web apps)
- Convex (backend — real-time, serverless)
- Clerk (auth)
- Hono on Fly.io (tool executor)
- Bun (package manager — always use bun, never npm)

## Monorepo Structure

```
apps/
  dashboard    Next.js 14.2 — admin UI, real-time Convex, Clerk auth, dark theme
  docs         Next.js — docs site at docs.struere.dev, LLM-first with /llms.txt
  web          Marketing site

packages/
  struere      SDK + CLI (ESM)

platform/
  convex       Backend — 42 tables, 19 HTTP endpoints, real-time subscriptions
  tool-executor  Hono Node.js on Fly.io — sandboxed custom tool execution
```

## Key Architectural Decisions

| Aspect | Decision |
|--------|----------|
| ActorContext | Eager resolution (resolve roles once per request), includes environment |
| Environments | 3: `development`, `production`, `eval` |
| Agent Config | Stored in Convex DB as JSON, looked up via `by_agent_env` index |
| Field Masks | Allowlist strategy (fail-safe, new fields hidden by default) |
| Permission Check | `canPerform()` returns result, `assertCanPerform()` throws, deny overrides allow |
| Tool Identity Modes | inherit, system, configured |
| Custom Tools | Handler code in Convex, executed on Fly.io Node.js sandbox |
| LLM Calls | Convex actions calling LLM APIs directly |
| Default Model | `openai/gpt-5-mini`, temperature 0.7, maxTokens 4096 |
| Model IDs | OpenRouter format: `provider/model-name` (e.g., `openai/gpt-5-mini`, `anthropic/claude-sonnet-4`) |
| Key Resolution | 3-tier fallback: org's direct provider key → org's OpenRouter key → platform OpenRouter key (credits) |
| Credit Billing | Reservation pattern: reserve -> execute -> consume/release (atomic) |

## Agent Execution Flow

```
HTTP Request (POST /v1/chat, Bearer token)
  -> Validate API key (SHA-256 hash lookup) -> extract org + environment
  -> Load agent + config (via by_agent_env index)
  -> Build ActorContext (eager role resolution, includes environment)
  -> Process system prompt templates (permission-aware variable injection)
  -> LLM Loop (max 10 iterations):
      -> Call LLM -> process tool calls -> permission check -> execute -> loop
  -> Credits: reserve -> execute -> consume/release
  -> Persist: threads.appendMessages() + executions.record()
  -> Return { threadId, message, usage }
```

### Multi-Agent Communication (agent.chat)

Depth limit: 3. Cycle detection. Per-agent 10-iteration cap. Shared `conversationId`, child threads store `parentThreadId`.

### System Prompt Templates

Dynamic data injection into agent system prompts:
- `{{entity.types()}}` — accessible entity types per actor
- `{{entity.query(...)}}` — live data injection
- `{{currentTime}}`, `{{organizationName}}`, `{{entityTypes}}`
- `{{roles()}}` — visible roles
- Conditional blocks supported

### System Events

Entity mutations emit `{type}.created`, `{type}.updated`, `{type}.deleted` events. Trigger events: `trigger.executed`, `trigger.failed`.

## Database Schema (42 tables)

| Category | Tables |
|----------|--------|
| User & Org | organizations, users, userOrganizations, userRoles, pendingRoleAssignments |
| API | apiKeys (env-scoped) |
| Agents | agents (shared), agentConfigs (env-scoped via `by_agent_env`) |
| Conversation | threads (env-scoped), messages |
| Data | entityTypes (env-scoped), entities (env-scoped), entityRelations (env-scoped) |
| Events & Audit | events (env-scoped), executions (env-scoped) |
| Triggers | triggers (env-scoped), triggerRuns (env-scoped) |
| RBAC | roles (env-scoped), policies, scopeRules, fieldMasks, toolPermissions |
| Integrations | integrationConfigs (env-scoped), providerConfigs (org-scoped), whatsappConnections (env-scoped), whatsappOwnedTemplates (org-scoped), emailMessages (env-scoped), calendarConnections (env-scoped) |
| Billing | creditBalances, creditTransactions |
| Evals | evalSuites, evalCases, evalRuns (env-scoped), evalResults |
| Sandbox | sandboxSessions (env-scoped), sandboxEvents |
| Test Data | fixtures (env-scoped) |

## Environment Isolation

3 environments: `development`, `production`, `eval`

**Scoped per environment:** entityTypes, entities, entityRelations, roles, policies, scopeRules, fieldMasks, agentConfigs, threads, messages, executions, events, apiKeys, integrationConfigs, whatsappConnections, calendarConnections, triggers, triggerRuns, evalSuites, evalCases, evalRuns, sandboxSessions, sandboxEvents, fixtures, emailMessages

**Shared across environments:** agents, users, organizations, userOrganizations, toolPermissions, whatsappOwnedTemplates, providerConfigs, creditBalances, creditTransactions

## HTTP Endpoints (20 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /health | GET | Health check |
| /v1/chat | POST | Chat by agent ID (Bearer token) |
| /v1/agents/{slug}/chat | POST | Chat by agent slug (Bearer token, pathPrefix) |
| /v1/auth/refresh | POST | Auth refresh (rate-limited) |
| /v1/sync | POST | Sync resources from CLI |
| /v1/sync/state | GET | Get sync state |
| /v1/sync/pull | GET | Get remote state for pull |
| /v1/templates/connections | GET | List WhatsApp connections |
| /v1/templates/list | GET | List WhatsApp templates |
| /v1/templates/create | POST | Create WhatsApp template |
| /v1/templates/delete | POST | Delete WhatsApp template |
| /v1/templates/status | GET | Check template status |
| /v1/compile-prompt | POST | Compile agent system prompt |
| /v1/run-tool | POST | Run a tool as it would in a real conversation |
| /internal/tool-callback | POST | Custom tool callback from tool-executor |
| /webhook/clerk | POST | Clerk user/org sync |
| /webhook/kapso/project | POST | Kapso WhatsApp phone connection |
| /webhook/kapso/messages | POST | Kapso WhatsApp inbound messages |
| /webhook/flow | POST | Flow payment status |
| /webhook/polar | POST | Polar payment webhook |
| /webhook/resend | POST | Resend email status |

## Built-in Tools (32)

| Tool | Category |
|------|----------|
| entity.create, entity.get, entity.query, entity.update, entity.delete | Entity (5) |
| event.emit, event.query | Event (2) |
| calendar.list, calendar.create, calendar.update, calendar.delete, calendar.freeBusy | Calendar (5) |
| whatsapp.send, whatsapp.sendTemplate, whatsapp.sendInteractive, whatsapp.sendMedia, whatsapp.listTemplates, whatsapp.getConversation, whatsapp.getStatus | WhatsApp (7) |
| airtable.listBases, airtable.listTables, airtable.listRecords, airtable.getRecord, airtable.createRecords, airtable.updateRecords, airtable.deleteRecords | Airtable (7) |
| email.send | Email (1) |
| payment.create, payment.getStatus | Payment (2) |
| agent.chat | Agent (1) |
| web.search, web.fetch | Web (2) |

## Integrations (6 providers)

| Provider | Service | Config |
|----------|---------|--------|
| whatsapp | Kapso WhatsApp Cloud API | Kapso API key, phone webhooks |
| google | Google Calendar | OAuth via Clerk |
| airtable | Airtable | Personal access token |
| resend | Resend Email | API key, from email/name |
| flow | Flow Payments | API key, secret key, HMAC-SHA256 |
| polar | Polar Payments | Webhook verification |

LLM Providers (providerConfigs table): anthropic, openai, google, xai, openrouter. 3-tier key resolution: org direct key → org OpenRouter key → platform OpenRouter key (credits)

## Permission Engine

Located in `platform/convex/lib/permissions/`:

| File | Purpose |
|------|---------|
| types.ts | ActorContext, PermissionResult, ScopeFilter, FieldMaskResult |
| context.ts | buildActorContext(), buildSystemActorContext() |
| evaluate.ts | canPerform(), assertCanPerform() |
| scope.ts | getScopeFilters(), applyScopeFiltersToQuery() |
| mask.ts | getFieldMask(), applyFieldMask() |
| tools.ts | canUseTool(), getToolIdentity() |

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

### Permission Flow

Request -> Build ActorContext -> Check Permission (deny overrides allow) -> Apply Scope Rules (row-level) -> Apply Field Masks (column-level) -> Response

## SDK (packages/struere)

### Exports

```typescript
import { defineAgent, defineTools, defineData, defineRole, defineTrigger } from 'struere'
```

### Key Types

- **AgentConfig**: name, slug, version, systemPrompt, model, tools
- **ModelConfig**: model (OpenRouter format string, e.g., `xai/grok-4-1-fast`), temperature?, maxTokens?
- **EntityTypeConfig**: name, slug, schema, searchFields, displayConfig
- **RoleConfig**: name, description, policies, scopeRules, fieldMasks
- **PolicyConfig**: resource, actions, effect (NO `priority` field)
- **ScopeRuleConfig**: entityType, field, operator (`eq` | `neq` | `in` | `contains`), value
- **TriggerConfig**: name, slug, on (entityType, action, condition?), actions
- **ToolReference**: tool definitions with optional `templateOnly` flag

Resources are upserted by slug (agents, entityTypes, triggers) or name (roles).

## CLI Commands (19)

| Command | Purpose |
|---------|---------|
| init | Initialize project, scaffold directories, authenticate |
| dev | Watch agents/, entity-types/, roles/, triggers/, tools/, evals/, fixtures/ and sync to dev + eval |
| deploy | Deploy all resources to production (supports --dry-run, --force, --json) |
| sync | Sync to Convex and exit (supports --env: development/production/eval) |
| add \<type\> \<name\> | Scaffold: agent, data-type, role, trigger, eval, fixture |
| status | Compare local vs remote state |
| pull | Pull remote resources to local files |
| entities | Entity management subcommands |
| eval | Run eval suites (start, list, watch) |
| templates | WhatsApp template management (list, sync, delete) |
| integration | Integration config management (airtable, resend, flow) |
| compile-prompt | Compile agent system prompts |
| run-tool | Run a tool as it would execute during a real agent conversation |
| org | Organization management |
| docs | Generate documentation |
| login | Browser-based OAuth |
| logout | Clear credentials |
| whoami | Display current user |
| check-updates | Auto-runs on startup |

Auto-run behavior: no `struere.json` -> auto-runs `init`; not logged in -> auto-runs `login`.

## Platform Services

### Convex Backend (platform/convex)

Key files:
- `schema.ts` — 42 tables
- `http.ts` — 19 HTTP endpoints + webhooks
- `agent.ts` — LLM execution with actor context
- `chat.ts` — Authenticated chat actions
- `sync.ts` — CLI sync mechanism
- `entities.ts`, `events.ts`, `triggers.ts`, `roles.ts`, `threads.ts` — Domain logic
- `tools/` — 30 built-in tool implementations
- `lib/permissions/` — Permission engine
- `lib/integrations/` — Kapso, Flow, Google Calendar, Resend, Airtable
- `lib/templateEngine.ts` — System prompt template processing
- `lib/sync/` — Sync helpers (agents, entityTypes, roles, triggers, evalSuites, fixtures)
- `lib/llm.ts` — LLM model creation and message conversion
- `lib/toolExecution.ts` — Tool executor orchestration
- `lib/creditPricing.ts` — Token-based pricing calculation
- `crons.ts` — 6 scheduled jobs (sandbox cleanup, payment reconciliation, credit reconciliation, old data cleanup)

### Tool Executor (platform/tool-executor)

Hono Node.js server on Fly.io:
- POST /execute — Execute custom tool handler (sandboxed)
- POST /validate — Validate handler code
- Fetch allowlist: api.openai.com, api.anthropic.com, api.stripe.com, api.sendgrid.com, api.twilio.com, hooks.slack.com, discord.com, api.github.com
- Custom tools receive full Struere SDK (entity, event, whatsapp, calendar, airtable, email, payment, agent)

### Dashboard (apps/dashboard)

Next.js 14.2 with Convex real-time, Clerk auth, dark theme:
- 13 modules: Agents, Conversations, Data, Roles, Tools, Automations, Settings, API Keys, Integrations, Billing, Users, Providers, Profile
- Studio panel: Embedded AI sandbox (E2B), real-time chat, HITL support
- Environment switcher: dev (amber) / prod (green), admin-only dev access
- 22 hook modules for real-time data
- 4 context providers: RoleContext, EnvironmentContext, AgentContext, StudioContext
- `convex.json` points to `../../platform/convex`

### Docs (apps/docs)

- 58 markdown pages in 8 sections at docs.struere.dev
- LLM endpoints: /llms.txt, /llms-full.txt, /{path}.md
- `content.ts` strips leading `# Heading` to prevent duplicate headings
- Brand: cream bg (#F5F1E8), forest green (#1B4332), DM Mono + Fira Code

## Convex CLI — Dev vs Prod

| Command | Target |
|---------|--------|
| `npx convex run <fn>` | Dev deployment |
| `npx convex run --prod <fn>` | Production deployment |
| `npx convex deploy --yes` | Deploy code to production |
| `npx convex run --push <fn>` | Push code to dev, then run |
| `npx convex run --prod --push <fn>` | Push to prod, then run |

NEVER use `CONVEX_DEPLOYMENT=<name>` env var — `.env.local` takes precedence and silently runs against dev.

Dev deployment: `giddy-wombat-967`, Prod: `rapid-wildebeest-172`

`"use node"` files can ONLY export actions (not queries/mutations) — split helpers into separate files.

## Development

### Local Dev

```bash
cd platform/convex && npx convex dev
cd apps/dashboard && bun run dev
cd platform/tool-executor && bun run dev
cd apps/docs && bun run dev
```

### Deployment

- CLI to npm: `cd packages/struere && npm publish`
- Convex: `cd platform/convex && npx convex deploy`
- Tool executor: `cd platform/tool-executor && fly deploy`
- Docs/Dashboard: Vercel (auto-deploy)

## Known Constraints

1. `entityRelations` indexes (`by_from`/`by_to`) lack environment field — filtered post-index
2. `roles` `by_org_isSystem` index lacks environment — uses collect + find
3. Event payloads may contain unmasked historical data
4. Convex httpActions do NOT have `ctx.scheduler` — must use `ctx.runMutation` to a mutation that calls `ctx.scheduler`
5. `whatsappOwnedTemplates` is org-scoped (NOT env-scoped)
6. `messages.toolCalls` and `triggers.condition` are fully typed validators (not `v.any()`)

## Code Style

- No comments in code
- No legacy code or backwards compatibility
- No fallback logic
- No over-engineering — only make changes that are directly requested
- Never initialize a server (always assume running)
- Always use bun over npm
- After code changes, run typecheck: `bunx tsc --noEmit`
