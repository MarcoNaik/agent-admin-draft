# Project Memory

## Overview

Struere is a **permission-aware AI agent platform** monorepo with:
- **apps/** - Frontend applications (dashboard, web)
- **packages/** - Shared libraries (struere SDK + CLI)
- **platform/** - Backend services (convex, tool-executor)

**Tech Stack**: Next.js 14, Convex, Cloudflare Workers, Clerk Auth, TypeScript, Bun

**Core Capability**: Role-based access control (RBAC) with row-level security (scope rules) and column-level security (field masks) enforced across all operations.

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
│                         │  └─────────────────────────────────────────┘    │ │
│  ┌─────────────────┐    │                      │                           │ │
│  │   CLI           │    │  ┌───────────────────┴───────────────────┐      │ │
│  │   (struere)     │────┤  │           SECURED OPERATIONS           │      │ │
│  └─────────────────┘    │  │  • Entities (CRUD + relations)         │      │ │
│                         │  │  • Events (visibility filtered)        │      │ │
│  ┌─────────────────┐    │  │  • Tools (permission checked)          │      │ │
│  │   Webhooks      │    │  │  • Templates (permission-aware)        │      │ │
│  │   - WhatsApp    │────┤  │  • Jobs (actor context preserved)      │      │ │
│  │   - Flow        │    │  └────────────────────────────────────────┘      │ │
│  └─────────────────┘    │                      │                           │ │
│                         │  ┌───────────────────┴───────────────────┐      │ │
│                         │  │           TUTORING DOMAIN              │      │ │
│                         │  │  • 6 Entity Types                      │      │ │
│                         │  │  • 3 Roles with policies               │      │ │
│                         │  │  • Scheduling constraints              │      │ │
│                         │  │  • Credit consumption                  │      │ │
│                         │  │  • Reminder/followup jobs              │      │ │
│                         │  └────────────────────────────────────────┘      │ │
│                         └─────────────────────────────────────────────────┘ │
│                                        │                                    │
│                                        ▼                                    │
│                         ┌─────────────────────────────────────────────────┐ │
│                         │           CLOUDFLARE WORKER                      │ │
│                         │           (tool-executor.struere.dev)            │ │
│                         │  • Custom tool execution                         │ │
│                         │  • Sandboxed fetch (allowlist domains)           │ │
│                         │  • Actor context passed                          │ │
│                         └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Aspect | Decision |
|--------|----------|
| **ActorContext** | Eager resolution (resolve roles once per request) |
| **Field Masks** | Allowlist strategy (fail-safe, new fields hidden by default) |
| **Permission Check API** | `canPerform()` returns result, `assertCanPerform()` throws |
| **Action Granularity** | CRUD + List (5 actions: create, read, update, delete, list) |
| **Scope Rule Types** | Field match + limited relations |
| **Tool Identity Modes** | Configurable (inherit, system, configured) |
| **Template Compilation** | Permission-aware (no privileged data paths) |
| **Policy Evaluation** | Deny overrides allow (deny-safe model) |
| **Organization Boundary** | Defense in depth (multiple protective layers) |
| **Agent Config** | Stored in Convex DB as JSON (not JS bundles) |
| **Custom Tools** | Handler code stored in Convex, executed on CF Worker |
| **Built-in Tools** | Convex mutations (`entity.create`, `event.emit`, `job.enqueue`) |
| **LLM Calls** | Convex actions calling Anthropic API directly |
| **Jobs** | Convex scheduled functions with actor context preservation |
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
| `/webhook/whatsapp` | GET | WhatsApp hub challenge verification |
| `/webhook/whatsapp` | POST | WhatsApp inbound messages |
| `/webhook/flow` | POST | Flow payment status updates |

### Database Schema

| Category | Tables |
|----------|--------|
| **User & Org** | organizations, users, apiKeys, userRoles |
| **Agents** | agents, agentConfigs |
| **Conversation** | threads, messages |
| **Business Data** | entityTypes, entities, entityRelations |
| **Events & Audit** | events, executions |
| **Jobs** | jobs (with actorContext) |
| **RBAC** | roles, policies, scopeRules, fieldMasks, toolPermissions |
| **Packs** | installedPacks (with customizations, upgradeHistory) |
| **Integrations** | integrationConfigs, whatsappConversations, whatsappTemplates, whatsappMessages |

## Permission Engine

### Core Files (`platform/convex/lib/permissions/`)

| File | Purpose |
|------|---------|
| `types.ts` | Action, ActorContext, PermissionResult, PermissionError, ScopeFilter, FieldMaskResult |
| `context.ts` | `buildActorContext()`, `buildSystemActorContext()` |
| `evaluate.ts` | `canPerform()`, `assertCanPerform()`, `logPermissionDenied()` |
| `scope.ts` | `getScopeFilters()`, `applyScopeFiltersToQuery()` |
| `mask.ts` | `getFieldMask()`, `applyFieldMask()` |
| `tools.ts` | `canUseTool()`, `getToolIdentity()` |
| `index.ts` | Exports + `queryEntitiesAsActor()`, `getEntityAsActor()` |

### Permission Flow

```
Request
    │
    ▼
┌─────────────────────────────────┐
│ 1. Build ActorContext           │
│    - organizationId             │
│    - actorType (user/agent/job) │
│    - actorId                    │
│    - roleIds (eager resolved)   │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ 2. Check Permission             │
│    - Find matching policies     │
│    - Deny overrides allow       │
│    - No roles = denied          │
│    - System actor = allowed     │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ 3. Apply Scope Rules            │
│    - Filter by field match      │
│    - Teacher sees own sessions  │
│    - Guardian sees own children │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ 4. Apply Field Masks            │
│    - Allowlist (whitelist)      │
│    - Teachers: no payment info  │
│    - Guardians: no teacher notes│
└─────────────┬───────────────────┘
              │
              ▼
           Response
```

### Security Properties

1. **No privileged data paths** - Templates, tools, jobs all go through permissions
2. **Defense in depth** - Organization boundary checked at multiple layers
3. **Deny overrides allow** - Any deny policy blocks access
4. **Fail safe** - New fields hidden by default (allowlist)
5. **Audit trail** - Events capture actor for all mutations

## Tutoring Domain

### Entity Types

| Type | Key Fields | Notes |
|------|------------|-------|
| `teacher` | name, email, subjects, availability, hourlyRate, userId | Linked to Clerk user |
| `student` | name, grade, subjects, notes, guardianId, preferredTeacherId | Linked to guardian |
| `guardian` | name, email, phone, whatsappNumber, billingAddress, userId | Primary contact |
| `session` | teacherId, studentId, guardianId, startTime, duration, status | Full lifecycle |
| `payment` | guardianId, amount, status, providerReference, sessionId | Flow integration |
| `entitlement` | guardianId, studentId, totalCredits, remainingCredits, expiresAt | Pack credits |

### Roles & Permissions

| Role | Can See | Can Do |
|------|---------|--------|
| Admin | Everything | Everything |
| Teacher | Own sessions, assigned students (limited fields) | Update sessions, submit reports |
| Guardian | Children's sessions, own payments | Update student info |

### Session Lifecycle

```
pending_payment ──[payment.success]──► scheduled
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
               cancelled            in_progress              no_show
                                          │
                                          ▼
                                      completed
```

### Scheduling Constraints

- 24-hour minimum booking lead time
- 2-hour reschedule cutoff
- Teacher availability validation
- No double booking
- Credit consumption on completion

### Scheduling & Workflow Files (`platform/convex/lib/`)

| File | Purpose |
|------|---------|
| `scheduling.ts` | Booking validation, availability, overlap detection |
| `workflows/session.ts` | Session lifecycle, credit consumption |

### Job Handlers (`platform/convex/jobs/`)

| File | Purpose |
|------|---------|
| `sessionReminder.ts` | 20-hour pre-session reminder |
| `sessionFollowup.ts` | Post-session follow-up (trial/pack) |

## Integrations

### WhatsApp Integration (`platform/convex/lib/integrations/whatsapp.ts`)

- Template message sending (approved templates only)
- 24-hour window tracking for freeform messages
- Inbound message processing via webhook
- Conversation state management

### Flow Payments (`platform/convex/lib/integrations/flow.ts`)

- Payment link generation
- HMAC-SHA256 request signing
- Webhook processing for status updates
- Reconciliation job for missed webhooks

### Integration Functions (`platform/convex/`)

| File | Purpose |
|------|---------|
| `whatsapp.ts` | WhatsApp mutations (send, receive, conversations) |
| `payments.ts` | Payment mutations (create, mark paid/failed, reconcile) |
| `integrations.ts` | Integration config management |
| `sessions.ts` | Session CRUD with scheduling constraints |

## Pack System

### Core Files (`platform/convex/lib/packs/`)

| File | Purpose |
|------|---------|
| `version.ts` | `compareVersions()`, `isUpgrade()`, `isMajorUpgrade()` |
| `migrate.ts` | Migration execution, field operations |

### Pack Functions (`platform/convex/packs/`)

| File | Purpose |
|------|---------|
| `tutoring.ts` | Complete pack definition with 6 types, 3 roles |
| `index.ts` | Pack types with migrations, scope rules, field masks |

### Current Packs

| Pack | Version | Entity Types | Roles |
|------|---------|--------------|-------|
| Tutoring | 1.0.0 | 6 | 3 |

### Migration Support

- Add/remove/rename fields
- Add entity types
- Modify schemas
- Run custom scripts
- Customization preservation

## Platform Services

### Convex (platform/convex)

Core backend with real-time subscriptions and scheduled functions.

**Key Files**:
- `schema.ts` - Database schema
- `agents.ts` - Agent CRUD, syncDevelopment, deploy
- `agent.ts` - LLM execution action (chat) with actor context
- `entities.ts` - Permission-aware entity CRUD, search, relations
- `entityTypes.ts` - Admin-only entity type definitions
- `events.ts` - Visibility-filtered event logging and queries
- `jobs.ts` - Job scheduling with actor context preservation
- `threads.ts` - Conversation management
- `roles.ts` - RBAC roles and policies
- `apiKeys.ts` - API key management
- `executions.ts` - Usage tracking
- `users.ts` - User queries + Clerk integration
- `organizations.ts` - Organization queries
- `packs.ts` - Pack installation/management with migrations
- `permissions.ts` - Internal query wrappers for permissions
- `http.ts` - HTTP endpoints including webhooks
- `auth.config.ts` - Clerk authentication config
- `tools/` - Permission-aware built-in tool implementations
  - `entities.ts` - entity.create, entity.get, entity.query, etc.
  - `events.ts` - event.emit, event.query
  - `jobs.ts` - job.enqueue, job.status
  - `helpers.ts` - Tool helper utilities
- `lib/permissions/` - Permission engine
- `lib/integrations/` - WhatsApp, Flow integrations
- `lib/scheduling.ts` - Booking validation
- `lib/workflows/` - Session lifecycle
- `lib/packs/` - Pack versioning and migrations
- `lib/auth.ts` - Auth context helpers
- `lib/utils.ts` - Common utilities (nanoid, slug generation)
- `lib/templateEngine.ts` - System prompt template processing
- `jobs/` - Job handlers (reminders, followups)

**Environment Variables**:
```env
ANTHROPIC_API_KEY=sk-ant-...
TOOL_EXECUTOR_URL=https://tool-executor.struere.dev
TOOL_EXECUTOR_SECRET=...
CLERK_JWT_ISSUER_DOMAIN=...
WHATSAPP_API_URL=...
WHATSAPP_ACCESS_TOKEN=...
FLOW_API_KEY=...
FLOW_SECRET_KEY=...
```

### Tool Executor (platform/tool-executor)

Cloudflare Worker for executing custom tool handlers in a sandboxed environment.

**Key Files**:
- `src/index.ts` - Hono app with endpoints
- `wrangler.toml` - Worker configuration

**Endpoints**:
- `GET /health` - Health check
- `POST /execute` - Execute custom tool handler (receives actor context)
- `POST /validate` - Validate handler code syntax

**Sandboxed Fetch Allowlist**:
- api.openai.com, api.anthropic.com, api.stripe.com
- api.sendgrid.com, api.twilio.com, hooks.slack.com
- discord.com, api.github.com

**Execution Context**:
```typescript
handler(args, context, sandboxedFetch)
// context: { organizationId, actorId, actorType }
// sandboxedFetch: fetch wrapper with domain allowlist
```

## Dashboard App (apps/dashboard)

### Framework & Architecture
- **Next.js 14.1.0** with React 18.2, TypeScript, App Router
- **Convex React** for real-time data via hooks
- **Clerk** for authentication
- Client Components for all data-fetching (real-time)
- Dark theme only
- Role-based navigation and views

### Convex Integration
- `convex.json` - Points to `../../platform/convex`
- `src/providers/convex-provider.tsx` - ConvexProviderWithClerk wrapper
- `src/providers/ensure-user.tsx` - User provisioning on first login
- `src/hooks/use-convex-data.ts` - All typed Convex hooks (62+ hooks)

### Context Providers
- `AgentContext` - Current agent info when viewing agent details
- `EnvironmentContext` - Dev/prod environment selection via URL query param
- `RoleContext` - Current user role for permission-based UI

### Role Detection & Context

| File | Purpose |
|------|---------|
| `hooks/use-current-role.ts` | Role detection hook |
| `contexts/role-context.tsx` | Role context provider |
| `components/role-redirect.tsx` | Access control components |

### Dashboard Modules

#### Admin Module (default)

- Full dashboard access
- Agent management
- Pack management
- Integration settings
- User/role management

#### Teacher Module (`/teacher/*`)

| Route | Feature |
|-------|---------|
| `/teacher/sessions` | Session list with filters |
| `/teacher/sessions/[id]` | Detail + report form |
| `/teacher/students` | Assigned students |
| `/teacher/profile` | Own profile |

**Teacher Components**:
- `components/teacher/report-form.tsx` - Session report submission
- `components/teacher/session-actions.tsx` - Role-aware action buttons

#### Guardian Module (`/guardian/*`)

| Route | Feature |
|-------|---------|
| `/guardian/sessions` | Children's sessions |
| `/guardian/students` | Children's profiles |
| `/guardian/payments` | Payment history |
| `/guardian/profile` | Own profile |

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
| `/entities/[type]/[id]/edit` | Entity edit |
| `/jobs` | Job dashboard (real-time) |
| `/api-keys` | API key management |
| `/usage` | Usage statistics |
| `/settings` | Organization settings |
| `/settings/integrations` | Integration settings |
| `/settings/integrations/whatsapp` | WhatsApp config |
| `/settings/integrations/flow` | Flow payments config |
| `/settings/packs` | Pack catalog |

### Real-time Components
- `agents-list-realtime.tsx` - Real-time agents list with CRUD
- `entities-list-realtime.tsx` - Real-time entity list with search
- `events-timeline-realtime.tsx` - Real-time event timeline
- `jobs-dashboard-realtime.tsx` - Real-time job dashboard with stats
- `components/entities/entity-actions.tsx` - Entity CRUD buttons

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

**Packs**: usePacks, usePack, useInstallPack, useUninstallPack, useUpgradePack

**Integrations**: useIntegrationConfigs, useIntegrationConfig, useUpdateIntegrationConfig

### Environment Variables
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CONVEX_URL=https://struere.convex.cloud
```

## Struere Package (packages/struere)

Unified SDK and CLI package for building AI agents. **Organization-centric architecture** - manage all agents, entity types, roles, and permissions from a single project.

### Installation
```bash
npm install struere
npx struere init
```

### Project Structure (v2)
```
my-org/
├── struere.json              # Organization config (v2.0)
├── agents/
│   ├── scheduler.ts          # Agent definition
│   ├── support.ts
│   └── index.ts              # Re-exports all agents
├── entity-types/
│   ├── teacher.ts            # Entity type schema
│   ├── student.ts
│   └── index.ts
├── roles/
│   ├── admin.ts              # Role + policies + scope rules + field masks
│   ├── teacher.ts
│   └── index.ts
├── tools/
│   └── index.ts              # Shared custom tools
└── struere.config.ts
```

### struere.json (v2 Schema)
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

### SDK Exports
```typescript
import { defineAgent, defineTools, defineConfig, defineEntityType, defineRole } from 'struere'
```

- `defineAgent(config)` - Creates/validates agent configurations
- `defineTools(tools)` - Validates and wraps tool definitions
- `defineConfig(config)` - Creates framework config with defaults
- `defineEntityType(config)` - Creates entity type schema definitions
- `defineRole(config)` - Creates role with policies, scope rules, field masks

### Key Types
- **AgentConfigV2**: name, slug, version, systemPrompt, model, tools (string array of tool names)
- **EntityTypeConfig**: name, slug, schema, searchFields, displayConfig
- **RoleConfig**: name, description, policies, scopeRules, fieldMasks
- **PolicyConfig**: resource, actions, effect, priority
- **ScopeRuleConfig**: entityType, field, operator, value
- **FieldMaskConfig**: entityType, fieldPath, maskType, maskConfig

### Definition Examples

**Agent** (`agents/scheduler.ts`):
```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Scheduler",
  slug: "scheduler",
  version: "0.1.0",
  systemPrompt: "You are a scheduling assistant...",
  model: { provider: "anthropic", name: "claude-sonnet-4-20250514" },
  tools: ["entity.create", "entity.query", "event.emit"],
})
```

**Entity Type** (`entity-types/teacher.ts`):
```typescript
import { defineEntityType } from 'struere'

export default defineEntityType({
  name: "Teacher",
  slug: "teacher",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string", format: "email" },
      hourlyRate: { type: "number" },
    },
    required: ["name", "email"],
  },
  searchFields: ["name", "email"],
})
```

**Role** (`roles/teacher.ts`):
```typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "teacher",
  description: "Tutors who conduct sessions",
  policies: [
    { resource: "session", actions: ["list", "read", "update"], effect: "allow", priority: 50 },
    { resource: "payment", actions: ["*"], effect: "deny", priority: 100 },
  ],
  scopeRules: [
    { entityType: "session", field: "data.teacherId", operator: "eq", value: "actor.userId" },
  ],
  fieldMasks: [
    { entityType: "session", fieldPath: "data.paymentId", maskType: "hide" },
  ],
})
```

### Built-in Tools Reference

Agents can enable any combination of these 11 built-in tools:

| Tool | Category | Description |
|------|----------|-------------|
| `entity.create` | Entity | Create a new entity of a specified type |
| `entity.get` | Entity | Retrieve a single entity by ID |
| `entity.query` | Entity | Query entities by type with filters |
| `entity.update` | Entity | Update an existing entity's data |
| `entity.delete` | Entity | Soft-delete an entity |
| `entity.link` | Entity | Create a relation between two entities |
| `entity.unlink` | Entity | Remove a relation between entities |
| `event.emit` | Event | Emit a custom event for audit logging |
| `event.query` | Event | Query historical events with filters |
| `job.enqueue` | Job | Schedule a background job |
| `job.status` | Job | Check the status of a scheduled job |

**Tool Parameters:**

```typescript
"entity.create": { type: string, data: object, status?: string }
"entity.get": { id: string }
"entity.query": { type: string, filters?: object, status?: string, limit?: number }
"entity.update": { id: string, data: object, status?: string }
"entity.delete": { id: string }
"entity.link": { fromEntityId: string, toEntityId: string, relationType: string }
"entity.unlink": { fromEntityId: string, toEntityId: string, relationType: string }
"event.emit": { eventType: string, entityId?: string, payload?: object }
"event.query": { eventType?: string, entityId?: string, since?: number, limit?: number }
"job.enqueue": { jobType: string, payload?: object, runAt?: number }
"job.status": { jobId: string }
```

### Model Configuration

**Available Providers:**
| Provider | Model Names | Notes |
|----------|-------------|-------|
| `anthropic` | `claude-sonnet-4-20250514`, `claude-opus-4-20250514`, `claude-3-5-haiku-20241022` | Default provider |
| `openai` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo` | Requires OPENAI_API_KEY |
| `google` | `gemini-1.5-pro`, `gemini-1.5-flash` | Requires GOOGLE_API_KEY |

**Model Config Options:**
```typescript
model: {
  provider: "anthropic",
  name: "claude-sonnet-4-20250514",
  temperature?: 0.7,
  maxTokens?: 4096,
}
```

**Default Model:** `anthropic/claude-sonnet-4-20250514` with temperature 0.7, maxTokens 4096

### System Prompt Templates

System prompts support Handlebars-style templates with these variables:

| Variable | Type | Description |
|----------|------|-------------|
| `{{currentTime}}` | string | Current ISO 8601 timestamp |
| `{{organizationName}}` | string | Current organization name |
| `{{agentName}}` | string | Agent's display name |
| `{{entityTypes}}` | array | All entity types with schemas |
| `{{roles}}` | array | All roles with policies |

**Example System Prompt:**
```typescript
systemPrompt: `You are {{agentName}}, an assistant for {{organizationName}}.
Current time: {{currentTime}}

Available entity types:
{{#each entityTypes}}
- {{this.name}} ({{this.slug}}): {{this.description}}
{{/each}}

You can create, query, update, and delete entities using the tools provided.`
```

**Entity Type Context Structure:**
```typescript
{
  name: "Teacher",
  slug: "teacher",
  description: "Tutors who conduct sessions",
  schema: { type: "object", properties: {...} },
  searchFields: ["name", "email"]
}
```

### Custom Tools Definition

Custom tools are defined in `tools/index.ts` and can be used by any agent:

```typescript
import { defineTools } from 'struere'

export default defineTools([
  {
    name: "send_email",
    description: "Send an email to a recipient",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body content" },
      },
      required: ["to", "subject", "body"],
    },
    handler: async (args, context, fetch) => {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: args.to }] }],
          from: { email: "noreply@example.com" },
          subject: args.subject,
          content: [{ type: "text/plain", value: args.body }],
        }),
      })
      return { success: response.ok }
    },
  },
  {
    name: "get_weather",
    description: "Get current weather for a location",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
    handler: async (args, context, fetch) => {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${args.city}&appid=${process.env.WEATHER_API_KEY}`)
      return await res.json()
    },
  },
])
```

**Handler Function Signature:**
```typescript
handler: (args: object, context: ExecutionContext, fetch: SandboxedFetch) => Promise<any>
```

**ExecutionContext:**
```typescript
{
  organizationId: string,
  actorId: string,
  actorType: "user" | "agent" | "system",
}
```

**Sandboxed Fetch Allowlist:**
Custom tool handlers execute on Cloudflare Workers with fetch restricted to:
- api.openai.com, api.anthropic.com, api.stripe.com
- api.sendgrid.com, api.twilio.com, hooks.slack.com
- discord.com, api.github.com

**Using Custom Tools in Agents:**
```typescript
export default defineAgent({
  name: "Support Agent",
  slug: "support",
  tools: [
    "entity.query",
    "entity.update",
    "event.emit",
    "send_email",
    "get_weather",
  ],
})
```

### CLI Commands
| Command | Purpose |
|---------|---------|
| `init` | Initialize org-centric project, scaffold directories |
| `dev` | Watch all files, sync everything to Convex on change |
| `deploy` | Deploy all agents to production |
| `add <type> <name>` | Scaffold new agent/entity-type/role |
| `status` | Compare local vs remote state |
| `login/logout` | Browser-based OAuth authentication |
| `whoami` | Display current logged-in user |

### CLI Auto-Run Behavior
Commands automatically run prerequisites without manual intervention:
- **No `struere.json`?** → Auto-runs `init`
- **Not logged in?** → Auto-runs `login`

### CLI Architecture

**Entry Point**: `src/cli/index.ts`
- Uses Commander.js for command parsing
- Version check against npm on startup (2s timeout)

**Command Files** (`src/cli/commands/`):
| File | Purpose |
|------|---------|
| `init.ts` | Org-centric project initialization |
| `dev.ts` | Bulk sync with chokidar file watching |
| `deploy.ts` | Deploy all agents to production |
| `add.ts` | Scaffold new resources |
| `status.ts` | Compare local vs remote state |
| `login.ts` | Browser-based OAuth flow |
| `logout.ts` | Clear credentials |
| `whoami.ts` | Display current user/org |

**Utility Files** (`src/cli/utils/`):
| File | Purpose |
|------|---------|
| `loader.ts` | Load agents, entity types, roles from directories |
| `extractor.ts` | Build sync payload from loaded resources |
| `project.ts` | Load/save struere.json (v1 and v2) |
| `convex.ts` | API calls (syncOrganization, getSyncState, deployAllAgents) |
| `scaffold.ts` | Create files for new resources |
| `credentials.ts` | Auth token management |

### CLI-Convex Sync Mechanism

**Dev Command Flow** (`dev.ts`):
1. Auto-init if no `struere.json`
2. Auto-login if not authenticated
3. Load all resources from `agents/`, `entity-types/`, `roles/`, `tools/`
4. Build sync payload via `extractSyncPayload()`
5. Sync to Convex via `syncOrganization()` mutation
6. Watch directories with chokidar
7. Re-sync on any file change (add/change/delete)

**Sync Payload**:
```typescript
{
  agents: [...],      // All agent configs
  entityTypes: [...], // All entity type schemas
  roles: [...]        // All roles with policies, scope rules, field masks
}
```

**Sync HTTP Request**:
```
POST /api/mutation
Authorization: Bearer {token}
Body: { path: "sync:syncOrganization", args: { agents, entityTypes, roles } }
```

### Convex Sync Functions (`platform/convex/sync.ts`)

| Function | Purpose |
|----------|---------|
| `syncOrganization` | Bulk sync all resources (upsert by slug/name) |
| `getSyncState` | Get current remote state for comparison |
| `deployAllAgents` | Deploy all agents to production |

**Sync Helpers** (`platform/convex/lib/sync/`):
| File | Purpose |
|------|---------|
| `entityTypes.ts` | Upsert entity types by slug |
| `roles.ts` | Upsert roles with policies, scope rules, field masks |
| `agents.ts` | Upsert agents with configs |

### Key Files
- `src/index.ts` - SDK exports (defineAgent, defineEntityType, defineRole, etc.)
- `src/types.ts` - TypeScript type definitions
- `src/define/agent.ts` - Agent definition function
- `src/define/entityType.ts` - Entity type definition function
- `src/define/role.ts` - Role definition function
- `src/cli/index.ts` - CLI entry point
- `src/cli/commands/` - Command implementations
- `src/cli/utils/` - Utilities
- `src/cli/templates/` - Project scaffolding templates

### Configuration Files
- `struere.json` - Organization metadata (v2 schema)
- `struere.config.ts` - Framework config (port, CORS, logging)
- `~/.struere/credentials.json` - Auth tokens

### Environment Variables
- `STRUERE_CONVEX_URL` - Convex deployment URL (default: rapid-wildebeest-172.convex.cloud)
- `STRUERE_API_KEY` - For production deployments
- `STRUERE_AUTH_URL` - Auth callback URL (default: app.struere.dev)

## Agent/Resource Creation Flow

### Via CLI (`struere add`)
```
1. Auto-init if needed
2. struere add agent my-agent
3. Scaffold agents/my-agent.ts with template
4. struere dev to sync
```

### Via CLI (`struere init`)
```
1. Auto-login if needed
2. Create project structure (agents/, entity-types/, roles/, tools/)
3. Write struere.json with organization info
4. Run bun install
```

### Via Dashboard (/agents/new)
```
1. User fills form (name, slug, description)
2. Click Create Agent
3. useCreateAgent() mutation
4. Convex creates agent record
5. Redirect to /agents/{agentId}
```

### Database Structure

**agents table**:
- organizationId, name, slug, description
- developmentConfigId (FK to agentConfigs)
- productionConfigId (FK to agentConfigs)
- status: "active" | "paused" | "deleted"

**agentConfigs table**:
- agentId, version, environment
- name, systemPrompt
- model: { provider, name, temperature?, maxTokens? }
- tools: [{ name, description, parameters, handlerCode?, isBuiltin }]
- createdAt, deployedBy

## Agent Execution Flow

### Complete Execution Flow

```
HTTP Request: POST /v1/chat
    │
    ▼
[1] HTTP Router (http.ts)
    • Extract Bearer token
    • Validate API key (SHA-256 hash lookup)
    • Call internal.agent.chat
    │
    ▼
[2] Chat Action (agent.ts)
    • Load agent and config
    • Build ActorContext
    • Get/create thread
    • Load message history
    • Build template context
    • Process system prompt templates (permission-aware)
    │
    ▼
[3] LLM Loop (max 10 iterations)
    │
    ├──► Call Anthropic API
    │    POST https://api.anthropic.com/v1/messages
    │    • model, max_tokens, system, messages, tools
    │
    ├──► Process Tool Calls
    │    ├─► Check tool permission (canUseTool)
    │    ├─► Built-in: executeBuiltinTool()
    │    │   └─► Permission-aware Convex mutation
    │    │
    │    └─► Custom: executeCustomTool()
    │        └─► POST to Cloudflare Worker /execute
    │            └─► Sandboxed execution with actor context
    │
    └──► Add tool results to messages
         Continue loop or exit
    │
    ▼
[4] Persist & Respond
    • threads.appendMessages()
    • executions.record() (tokens, duration, status)
    • Return { threadId, message, usage }
```

### Built-in Tool Implementations

All tools are permission-aware and pass actor context:

| Tool | Convex Mutation | Purpose |
|------|-----------------|---------|
| `entity.create` | `tools.entities.entityCreate` | Create entity + emit event |
| `entity.get` | `tools.entities.entityGet` | Get entity by ID (field-masked) |
| `entity.query` | `tools.entities.entityQuery` | Query with scope filters |
| `entity.update` | `tools.entities.entityUpdate` | Update data + emit event |
| `entity.delete` | `tools.entities.entityDelete` | Soft delete + emit event |
| `entity.link` | `tools.entities.entityLink` | Create relation |
| `entity.unlink` | `tools.entities.entityUnlink` | Remove relation |
| `event.emit` | `tools.events.eventEmit` | Emit custom event |
| `event.query` | `tools.events.eventQuery` | Query events (visibility filtered) |
| `job.enqueue` | `tools.jobs.jobEnqueue` | Schedule job (preserves actor) |
| `job.status` | `tools.jobs.jobStatus` | Get job status |

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

## Known Limitations

1. **Query performance** - Some queries filter in memory after index lookup (documented trade-off for V1)
2. **Relation scope patterns** - Only `field_match` implemented, complex relations require code patterns
3. **Event payload masking** - Event payloads may contain unmasked historical data
4. **Single payment provider** - Only Flow implemented

## Server Management

- Never initialize a server, always assume it is already running
- Do not manage any fallback logic
- Do not keep any legacy code or backwards compatibility
- Do not write any comments on the code
