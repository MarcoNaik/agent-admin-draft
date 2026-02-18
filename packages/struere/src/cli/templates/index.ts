export function getTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        lib: ['ES2022'],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        outDir: 'dist',
        rootDir: '.',
        types: ['bun-types'],
        paths: {
          struere: ['./.struere/index.js'],
        },
      },
      include: ['**/*.ts'],
      exclude: ['node_modules', 'dist', '.struere'],
    },
    null,
    2
  )
}

export function getExampleEvalYaml(agentSlug: string): string {
  return `suite: "Basic Agent Tests"
slug: "basic-agent-tests"
agent: "${agentSlug}"
description: "Verify agent responds correctly and uses tools appropriately"
tags: ["smoke-test"]
judgeModel: "claude-haiku-4-5-20251001"
judgePrompt: "Evaluate whether the agent responds correctly and uses appropriate tools. Be lenient on phrasing but strict on factual accuracy."

cases:
  - name: "Greeting test"
    description: "Agent should introduce itself politely"
    turns:
      - user: "Hello, who are you?"
        assertions:
          - type: llm_judge
            criteria: "Response is polite, introduces itself, and offers to help"
            weight: 3
          - type: contains
            value: "help"

  - name: "Entity query test"
    description: "Agent should use entity.query to look up data"
    turns:
      - user: "Show me all active records"
        assertions:
          - type: tool_called
            value: "entity.query"
          - type: llm_judge
            criteria: "Response presents the query results or explains there are no results"

  - name: "Multi-turn conversation"
    description: "Agent should maintain context across turns"
    turns:
      - user: "My name is Alex"
        assertions:
          - type: llm_judge
            criteria: "Agent acknowledges the user's name"
      - user: "What is my name?"
        assertions:
          - type: contains
            value: "Alex"
          - type: llm_judge
            criteria: "Agent correctly recalls the name from the previous turn"
            weight: 4

  - name: "Tool restriction test"
    description: "Agent should not call tools unnecessarily"
    turns:
      - user: "What is 2 + 2?"
        assertions:
          - type: tool_not_called
            value: "entity.create"
          - type: llm_judge
            criteria: "Response correctly answers 4 without creating any entities"
`
}

export function getEvalYamlTemplate(suiteName: string, slug: string, agentSlug: string): string {
  return `suite: "${suiteName}"
slug: "${slug}"
agent: "${agentSlug}"
description: "TODO: Describe what this eval suite tests"
tags: []
judgeModel: "claude-haiku-4-5-20251001"
judgePrompt: "TODO: Custom instructions for the judge (e.g. strictness level, focus areas)"

cases:
  - name: "Example test case"
    description: "TODO: Describe expected behavior"
    turns:
      - user: "Hello"
        assertions:
          - type: llm_judge
            criteria: "Response is helpful and relevant"
          - type: contains
            value: "hello"
`
}

export function getEnvExample(): string {
  return `# Anthropic API Key (default provider)
ANTHROPIC_API_KEY=your_api_key_here

# Optional: OpenAI API Key (if using OpenAI models)
# OPENAI_API_KEY=your_openai_api_key

# Optional: Google AI API Key (if using Gemini models)
# GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key

# Optional: Custom Convex URL
# STRUERE_CONVEX_URL=https://struere.convex.cloud
`
}

export function getGitignore(): string {
  return `node_modules/
dist/
.env
.env.local
.env.*.local
.idea/
.vscode/
*.swp
*.swo
.DS_Store
Thumbs.db
*.log
logs/
.vercel/
.struere/
`
}

export function getEntityTypeTs(name: string, slug: string): string {
  const displayName = name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return `import { defineEntityType } from 'struere'

export default defineEntityType({
  name: "${displayName}",
  slug: "${slug}",
  schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Name" },
      email: { type: "string", format: "email", description: "Email address" },
      status: { type: "string", enum: ["active", "inactive"], description: "Status" },
    },
    required: ["name"],
  },
  searchFields: ["name", "email"],
  displayConfig: {
    listFields: ["name", "email", "status"],
  },
})
`
}

export function getRoleTs(name: string): string {
  return `import { defineRole } from 'struere'

export default defineRole({
  name: "${name}",
  description: "${name.charAt(0).toUpperCase() + name.slice(1)} role",
  policies: [
    { resource: "*", actions: ["list", "read"], effect: "allow" },
  ],
  scopeRules: [],
  fieldMasks: [],
})
`
}

export function getAgentTs(name: string, slug: string): string {
  const displayName = name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return `import { defineAgent } from 'struere'

export default defineAgent({
  name: "${displayName}",
  slug: "${slug}",
  version: "0.1.0",
  description: "${displayName} Agent",
  model: {
    provider: "anthropic",
    name: "claude-haiku-4-5",
    temperature: 0.7,
    maxTokens: 4096,
  },
  systemPrompt: \`You are {{agentName}}, an AI assistant for {{organizationName}}.

Current time: {{currentTime}}

Your capabilities:
- Answer questions accurately and helpfully
- Use available tools when appropriate
- Maintain conversation context

Always be concise, accurate, and helpful.\`,
  tools: ["entity.query", "entity.get", "event.emit"],
})
`
}

export function getToolsIndexTs(): string {
  return `import { defineTools } from 'struere'

export default defineTools([
  {
    name: 'get_current_time',
    description: 'Get the current date and time in a specific timezone',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Timezone (e.g., "America/New_York", "UTC")',
        },
      },
    },
    handler: async (args, context, fetch) => {
      const timezone = (args.timezone as string) || 'UTC'
      const now = new Date()
      return {
        timestamp: now.toISOString(),
        formatted: now.toLocaleString('en-US', { timeZone: timezone }),
        timezone,
        organizationId: context.organizationId,
      }
    },
  },

  {
    name: 'send_slack_message',
    description: 'Send a message to a Slack channel via webhook',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send',
        },
        channel: {
          type: 'string',
          description: 'Channel name (for logging purposes)',
        },
      },
      required: ['message'],
    },
    handler: async (args, context, fetch) => {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL
      if (!webhookUrl) {
        return { success: false, error: 'SLACK_WEBHOOK_URL not configured' }
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: args.message,
          username: 'Struere Agent',
        }),
      })

      return {
        success: response.ok,
        status: response.status,
        actorId: context.actorId,
        actorType: context.actorType,
      }
    },
  },
])
`
}

export function getStruereJson(orgId: string, orgSlug: string, orgName: string): string {
  return JSON.stringify(
    {
      version: '2.0',
      organization: {
        id: orgId,
        slug: orgSlug,
        name: orgName,
      },
    },
    null,
    2
  )
}

export function getPackageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'struere dev',
        deploy: 'struere deploy',
        status: 'struere status',
      },
      devDependencies: {
        'bun-types': '^1.0.0',
        typescript: '^5.3.0',
      },
    },
    null,
    2
  )
}

export function getClaudeMD(orgName: string): string {
  return `# ${orgName} - Struere Workspace

> **This is a workspace project**, not the Struere framework source code. You define agents, entity types, roles, and custom tools here. The CLI syncs them to Convex. Framework source: github.com/struere/struere

Struere is a framework for building production AI agents with Convex as the real-time backend. Agents can manage entities (business data), emit events, and automate workflows with triggers—all with built-in RBAC permissions.

## How It Works

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  Your Project (this folder)                                     │
│  ├── agents/*.ts        → Agent configs synced to Convex        │
│  ├── entity-types/*.ts  → Schema definitions synced to Convex   │
│  ├── roles/*.ts         → RBAC policies synced to Convex        │
│  ├── triggers/*.ts      → Automation rules synced to Convex     │
│  ├── tools/index.ts     → Custom tools (run on CF Worker)       │
│  └── evals/*.eval.yaml  → Test suites (synced + executed)       │
└─────────────────────┬───────────────────────────────────────────┘
                      │ struere dev (watches & syncs)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Convex (Real-time Backend)                                      │
│  • Stores agent configs, entities, events, triggers              │
│  • Runs LLM calls (Anthropic/OpenAI)                             │
│  • Enforces RBAC on every operation                              │
│  • Executes custom tools via Cloudflare Worker                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP API
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Clients                                                         │
│  • Dashboard (chat UI, entity browser)                           │
│  • Your app (REST API with Bearer token)                         │
│  • WhatsApp/Webhooks                                             │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

## Project Structure

\`\`\`
agents/              # Agent definitions (synced to Convex)
└── my-agent.ts      # One file per agent

entity-types/        # Data schemas (like DB tables)
└── customer.ts      # Defines shape of "customer" entities

roles/               # RBAC: who can do what
├── admin.ts         # Full access
└── support.ts       # Limited access

triggers/            # Automation rules (react to entity changes)
└── notify-on-create.ts

tools/               # Custom tools shared by all agents
└── index.ts         # defineTools([...])

evals/               # Eval suites (YAML test definitions)
├── basic.eval.yaml  # One file per suite
└── tools.eval.yaml

struere.json         # Organization ID (don't edit)
\`\`\`

## Configuration Files

### struere.json (auto-generated, don't edit)
Links this project to your Convex organization:
\`\`\`json
{
  "version": "2.0",
  "organization": { "id": "org_xxx", "slug": "my-org", "name": "My Org" }
}
\`\`\`

## CLI Commands

| Command | What it does |
|---------|--------------|
| \`struere dev\` | Watch files, sync to Convex on every save |
| \`struere deploy\` | Copy dev config to production for all agents |
| \`struere add agent <name>\` | Create agents/name.ts with template |
| \`struere add entity-type <name>\` | Create entity-types/name.ts |
| \`struere add role <name>\` | Create roles/name.ts |
| \`struere add trigger <name>\` | Create triggers/name.ts with template |
| \`struere add eval <name>\` | Create evals/name.eval.yaml with template |
| \`struere status\` | Show what's synced vs local-only |
| \`struere pull\` | Pull remote resources to local files |

## Defining Agents

Create \`agents/support.ts\`:
\`\`\`typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Support Agent",
  slug: "support",
  version: "0.1.0",
  model: {
    provider: "anthropic",  // or "openai", "google"
    name: "claude-haiku-4-5",  // Best cost/intelligence ratio
    temperature: 0.7,
    maxTokens: 4096,
  },
  systemPrompt: \\\`You are {{agentName}}, a support agent for {{organizationName}}.
Current time: {{currentTime}}

Use entity.query to look up customer info before responding.
Available entity types: {{entityTypes}}\\\`,
  tools: [
    "entity.query",
    "entity.get",
    "entity.update",
    "event.emit",
    "send_email",  // custom tool from tools/index.ts
  ],
})
\`\`\`

### Model Selection Guide

| Model | Cost (Input/Output) | Best For |
|-------|---------------------|----------|
| \`claude-haiku-4-5\` | $1/$5 per MTok | **Default** - Best cost/intelligence ratio |
| \`claude-sonnet-4\` | $3/$15 per MTok | Complex reasoning, nuanced tasks |
| \`claude-opus-4-5\` | $5/$25 per MTok | Most capable, research-grade tasks |

Start with Haiku 4.5 for most agents. Upgrade to Sonnet only if you need better reasoning.

### System Prompt Template Variables

The template engine supports \`{{variable}}\` syntax for simple variable resolution and \`{{function(args)}}\` syntax for function calls.

**Available Variables:**

| Variable | Type | Description |
|----------|------|-------------|
| \`{{currentTime}}\` | string | ISO 8601 timestamp |
| \`{{datetime}}\` | string | ISO 8601 timestamp (alias) |
| \`{{timestamp}}\` | number | Unix timestamp in milliseconds |
| \`{{organizationName}}\` | string | Your organization name |
| \`{{organizationId}}\` | string | Organization ID |
| \`{{agentName}}\` | string | This agent's display name |
| \`{{agent.name}}\` | string | Agent name |
| \`{{agent.slug}}\` | string | Agent slug |
| \`{{message}}\` | string | Current user message |
| \`{{thread.metadata.X}}\` | any | Thread metadata field X |
| \`{{entityTypes}}\` | array | JSON array of all entity types |
| \`{{roles}}\` | array | JSON array of all roles |

**Function Calls (embedded queries):**

\`\`\`
{{entity.query({"type": "customer", "limit": 5})}}
{{entity.get({"id": "ent_123"})}}
\`\`\`

**Note:** Handlebars block helpers (\`{{#each}}\`, \`{{#if}}\`) are NOT supported. Use function calls instead.

## Defining Entity Types

Create \`entity-types/customer.ts\`:
\`\`\`typescript
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
      metadata: { type: "object", properties: { source: { type: "string" }, tags: { type: "array", items: { type: "string" } } } },
    },
    required: ["name", "email"],
  },
  searchFields: ["name", "email"],  // Fields indexed for search
})
\`\`\`

### Binding Entity Types to Roles (\`boundToRole\`)

When an entity type represents users of a specific role (e.g. a "teacher" entity type for users with the "teacher" role), declare the binding explicitly:

\`\`\`typescript
import { defineEntityType } from 'struere'

export default defineEntityType({
  name: "Teacher",
  slug: "teacher",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string", format: "email" },
      userId: { type: "string" },  // Links to the Convex user _id
    },
    required: ["name", "email", "userId"],
  },
  searchFields: ["name", "email"],
  boundToRole: "teacher",    // Role name this entity type represents
  userIdField: "userId",     // Field in data that holds the user's Convex _id (defaults to "userId")
})
\`\`\`

This enables \`actor.entityId\` in scope rules to automatically resolve which entity record belongs to the current user. Without \`boundToRole\`, scope rules using \`actor.entityId\` will match nothing.

**Rules:**
- Each role can only be bound to one entity type (enforced at sync time)
- \`userIdField\` defaults to \`"userId"\` if not specified
- \`userIdField\` requires \`boundToRole\` to be set
- The entity's \`data[userIdField]\` must contain the Convex user \`_id\`

Entities are stored as:
\`\`\`json
{
  "_id": "ent_abc123",
  "type": "customer",
  "data": { "name": "John", "email": "john@example.com", "plan": "pro" },
  "status": "active",
  "createdAt": 1706745600000
}
\`\`\`

## Defining Roles (RBAC)

Create \`roles/support.ts\`:
\`\`\`typescript
import { defineRole } from 'struere'

export default defineRole({
  name: "support",
  description: "Support staff with limited access",

  // What actions are allowed/denied
  policies: [
    { resource: "customer", actions: ["list", "read"], effect: "allow" },
    { resource: "customer", actions: ["delete"], effect: "deny" },
    { resource: "payment", actions: ["*"], effect: "deny" },
  ],

  // Row-level security: only see assigned customers
  scopeRules: [
    {
      entityType: "customer",
      field: "data.assignedTo",  // Field in entity data
      operator: "eq",
      value: "actor.userId"      // Current user's Convex _id
    },
  ],

  // Column-level security: hide sensitive fields
  fieldMasks: [
    { entityType: "customer", fieldPath: "data.ssn", maskType: "hide" },
    { entityType: "customer", fieldPath: "data.creditCard", maskType: "redact" },
  ],
})
\`\`\`

### RBAC Enforcement

Every tool call goes through permission checks:
1. **Policy check**: Does this role allow the action on this resource?
2. **Scope filter**: Query results filtered to rows user can access
3. **Field mask**: Sensitive fields hidden/redacted in response

Deny policies always override allow.

### Scope Rule Values

| Value | Resolves To |
|-------|-------------|
| \`"actor.userId"\` | Current user's Convex \`_id\` |
| \`"actor.organizationId"\` | Current organization ID |
| \`"actor.entityId"\` | Entity record bound to this user via \`boundToRole\` (requires entity type with \`boundToRole\` set) |
| \`"actor.relatedIds:TYPE"\` | IDs of entities related to the actor's entity via relation type TYPE |
| \`"literal:VALUE"\` | Literal string value |

**Example using \`actor.entityId\`:**

\`\`\`typescript
// roles/teacher.ts — Teacher sees only their own sessions
export default defineRole({
  name: "teacher",
  policies: [
    { resource: "session", actions: ["list", "read", "update"], effect: "allow" },
  ],
  scopeRules: [
    {
      entityType: "session",
      field: "data.teacherId",
      operator: "eq",
      value: "actor.entityId"  // Resolves to the teacher entity _id for this user
    },
  ],
})

// entity-types/teacher.ts — Must declare boundToRole for actor.entityId to work
export default defineEntityType({
  name: "Teacher",
  slug: "teacher",
  boundToRole: "teacher",
  userIdField: "userId",
  // ...schema
})
\`\`\`

## Defining Custom Tools

Edit \`tools/index.ts\`:
\`\`\`typescript
import { defineTools } from 'struere'

export default defineTools([
  {
    name: "send_email",
    description: "Send an email to a recipient",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body" },
      },
      required: ["to", "subject", "body"],
    },
    // Handler runs on Cloudflare Worker (sandboxed)
    handler: async (args, context, fetch) => {
      // context = { organizationId, actorId, actorType }
      // fetch = sandboxed fetch (limited domains)

      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": \\\`Bearer \\\${process.env.SENDGRID_API_KEY}\\\`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: args.to }] }],
          from: { email: "noreply@example.com" },
          subject: args.subject,
          content: [{ type: "text/plain", value: args.body }],
        }),
      })
      return { success: response.ok, status: response.status }
    },
  },

  {
    name: "lookup_order",
    description: "Look up order by ID",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Order ID" },
      },
      required: ["orderId"],
    },
    handler: async (args, context, fetch) => {
      const res = await fetch(\\\`https://api.myshop.com/orders/\\\${args.orderId}\\\`, {
        headers: { "X-Org-Id": context.organizationId },
      })
      return await res.json()
    },
  },
])
\`\`\`

### Allowed Domains for Custom Tools

Custom tool handlers can only fetch from:
- api.openai.com, api.anthropic.com
- api.stripe.com, api.sendgrid.com, api.twilio.com
- hooks.slack.com, discord.com, api.github.com

## Defining Triggers

Triggers are automated actions that fire when entities are created, updated, or deleted. They run asynchronously after the mutation completes.

Create \\\`triggers/notify-on-session.ts\\\`:
\\\`\\\`\\\`typescript
import { defineTrigger } from 'struere'

export default defineTrigger({
  name: "Notify Teacher on New Session",
  slug: "notify-teacher-on-session",
  on: {
    entityType: "session",
    action: "created",
    condition: { "data.status": "scheduled" }  // optional
  },
  actions: [
    {
      tool: "entity.get",
      args: { id: "{{trigger.data.teacherId}}" },
      as: "teacher"  // store result for later steps
    },
    {
      tool: "event.emit",
      args: {
        eventType: "notification.sent",
        entityId: "{{trigger.entityId}}",
        payload: {
          teacherName: "{{steps.teacher.data.name}}",
          sessionTime: "{{trigger.data.startTime}}"
        }
      }
    }
  ]
})
\\\`\\\`\\\`

### Trigger Config

| Field | Required | Description |
|-------|----------|-------------|
| \\\`name\\\` | Yes | Display name |
| \\\`slug\\\` | Yes | Unique identifier (used for sync) |
| \\\`on.entityType\\\` | Yes | Entity type slug to watch |
| \\\`on.action\\\` | Yes | \\\`"created"\\\`, \\\`"updated"\\\`, or \\\`"deleted"\\\` |
| \\\`on.condition\\\` | No | Dot-notation equality conditions on entity data |
| \\\`schedule\\\` | No | Delay or schedule execution (see Scheduled Triggers) |
| \\\`retry\\\` | No | Retry on failure (see Retry Options) |
| \\\`actions\\\` | Yes | Ordered list of tool calls to execute |

### Action Pipeline

Each action in the \\\`actions\\\` array runs sequentially:

| Field | Required | Description |
|-------|----------|-------------|
| \\\`tool\\\` | Yes | Built-in or custom tool name |
| \\\`args\\\` | Yes | Arguments (supports \\\`{{template}}\\\` variables) |
| \\\`as\\\` | No | Store result under this name for later steps |

### Template Variables

Use \\\`{{...}}\\\` in action args to reference trigger context and previous step results:

| Variable | Description |
|----------|-------------|
| \\\`{{trigger.entityId}}\\\` | ID of the entity that changed |
| \\\`{{trigger.entityType}}\\\` | Entity type slug |
| \\\`{{trigger.action}}\\\` | \\\`"created"\\\`, \\\`"updated"\\\`, or \\\`"deleted"\\\` |
| \\\`{{trigger.data.X}}\\\` | Entity data field (e.g. \\\`{{trigger.data.email}}\\\`) |
| \\\`{{trigger.previousData.X}}\\\` | Previous value (updates/deletes only) |
| \\\`{{steps.NAME.X}}\\\` | Result from a prior action with \\\`as: "NAME"\\\` |

### Conditions

Conditions use dot-notation path equality matching:
\\\`\\\`\\\`typescript
condition: {
  "data.status": "scheduled",       // field must equal value
  "data.priority": "high"           // all conditions must match (AND)
}
\\\`\\\`\\\`

### Execution Model

- **Async**: Triggers are scheduled after the mutation, keeping writes fast
- **System actor**: Actions execute with full admin access (not the user's role)
- **Fail-fast**: If any action fails, remaining actions are skipped
- **Events**: Emits \\\`trigger.executed\\\` on success, \\\`trigger.failed\\\` on error
- **Both paths**: Triggers fire from dashboard CRUD, agent tool calls, and API mutations

### Scheduled Triggers

Add \\\`schedule\\\` to delay execution or run at a specific time derived from entity data:

\\\`\\\`\\\`typescript
defineTrigger({
  name: "Session Reminder",
  slug: "session-reminder",
  on: { entityType: "session", action: "created" },
  schedule: {
    at: "{{trigger.data.startTime}}",
    offset: -3600000,
  },
  retry: { maxAttempts: 3, backoffMs: 60000 },
  actions: [
    { tool: "entity.get", args: { id: "{{trigger.entityId}}" }, as: "session" },
    { tool: "event.emit", args: { eventType: "session.reminder", entityId: "{{trigger.entityId}}" } },
  ],
})
\\\`\\\`\\\`

**Schedule Options:**

| Field | Type | Description |
|-------|------|-------------|
| \\\`delay\\\` | number | Fixed delay in ms after entity mutation |
| \\\`at\\\` | string | Template expression resolving to a timestamp (e.g. \\\`"{{trigger.data.startTime}}"\\\`) |
| \\\`offset\\\` | number | Offset from \\\`at\\\` time in ms (negative = before, positive = after) |
| \\\`cancelPrevious\\\` | boolean | Cancel pending runs for same trigger+entity when new run created |

Cannot use both \\\`delay\\\` and \\\`at\\\` on the same trigger.

**Retry Options:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| \\\`maxAttempts\\\` | number | 1 | Max execution attempts |
| \\\`backoffMs\\\` | number | 60000 | Base backoff (exponential: \\\`min(backoffMs * 2^(attempt-1), 3600000)\\\`) |

Scheduled triggers create **trigger runs** visible in the dashboard with status tracking (pending → running → completed/failed/dead).

### Scaffold a new trigger

\\\`\\\`\\\`bash
struere add trigger my-trigger
\\\`\\\`\\\`

Creates \\\`triggers/my-trigger.ts\\\` with a starter template.

## Built-in Tools Reference

### Entity Tools

\`\`\`typescript
// entity.create - Create new entity
{ type: "customer", data: { name: "John", email: "j@example.com" }, status: "active" }

// entity.get - Get by ID
{ id: "ent_abc123" }

// entity.query - Search/filter
{ type: "customer", filters: { "data.plan": "pro" }, status: "active", limit: 50 }

// entity.update - Partial update
{ id: "ent_abc123", data: { plan: "enterprise" } }

// entity.delete - Soft delete
{ id: "ent_abc123" }

// entity.link - Create relation
{ fromEntityId: "ent_abc", toEntityId: "ent_xyz", relationType: "assigned_to" }

// entity.unlink - Remove relation
{ fromEntityId: "ent_abc", toEntityId: "ent_xyz", relationType: "assigned_to" }
\`\`\`

### Event Tools

\`\`\`typescript
// event.emit - Log an event
{ eventType: "support.ticket.resolved", entityId: "ent_abc", payload: { rating: 5 } }

// event.query - Query event history
{ eventType: "support.ticket.*", entityId: "ent_abc", limit: 20 }
\`\`\`

Events are immutable audit logs. Use for analytics, debugging, compliance.

### Calendar Tools

Requires a connected Google Calendar (via Settings > Integrations). The \`userId\` must be a user with a linked Google account.

\`\`\`typescript
// calendar.list - List events in a time range
{ userId: "user_abc", timeMin: "2024-01-01T00:00:00Z", timeMax: "2024-01-31T23:59:59Z", maxResults: 50 }

// calendar.create - Create a calendar event
{
  userId: "user_abc",
  summary: "Session with Student",
  startTime: "2024-01-15T10:00:00Z",
  endTime: "2024-01-15T11:00:00Z",
  description: "Weekly tutoring session",  // optional
  attendees: ["student@example.com"],       // optional
  timeZone: "America/New_York"              // optional
}

// calendar.update - Update an existing event
{ userId: "user_abc", eventId: "evt_123", summary: "Updated title", startTime: "2024-01-15T11:00:00Z" }

// calendar.delete - Delete a calendar event
{ userId: "user_abc", eventId: "evt_123" }

// calendar.freeBusy - Check availability
{ userId: "user_abc", timeMin: "2024-01-15T00:00:00Z", timeMax: "2024-01-15T23:59:59Z" }
// Returns: { busy: [{ start: "...", end: "..." }, ...] }
\`\`\`

Calendar tools work in both agent tool calls and trigger actions. Example trigger:
\`\`\`typescript
defineTrigger({
  name: "Add Session to Calendar",
  slug: "add-session-to-calendar",
  on: { entityType: "session", action: "created" },
  actions: [
    {
      tool: "calendar.create",
      args: {
        userId: "{{trigger.data.teacherId}}",
        summary: "Session: {{trigger.data.studentName}}",
        startTime: "{{trigger.data.startTime}}",
        endTime: "{{trigger.data.endTime}}"
      },
      as: "calendarEvent"
    }
  ]
})
\`\`\`

### Agent Communication Tools

The \\\`agent.chat\\\` tool lets agents delegate work to other agents within the same organization and environment. The calling agent sends a message to a target agent (by slug), waits for its response, and uses the result to continue its own execution.

\`\`\`typescript
// agent.chat - Send a message to another agent
{ agent: "billing-agent", message: "How many credits does guardian ent_abc have?", context: { guardianId: "ent_abc" } }
// Returns: { response: "Guardian has 5 remaining credits...", threadId: "thread_xyz", agentSlug: "billing-agent", usage: {...} }
\`\`\`

**Safety limits:**
- **Depth limit**: Max 3 levels of agent-to-agent delegation (A→B→C allowed, A→B→C→D rejected)
- **Cycle detection**: An agent cannot call itself
- **Per-agent iteration cap**: Each agent's LLM loop is independently limited to 10 steps

**How it works:**
1. Caller agent invokes \\\`agent.chat\\\` with a target slug and message
2. Target agent is resolved by slug within the same organization
3. A new thread is created for the target agent (linked via shared \\\`conversationId\\\`)
4. Target agent runs its own LLM loop with its own system prompt, tools, and permissions
5. Response is returned as a tool result to the calling agent

**Example: Coordinator delegates to specialist**
\`\`\`typescript
// agents/coordinator.ts
export default defineAgent({
  name: "Coordinator",
  slug: "coordinator",
  version: "0.1.0",
  systemPrompt: \\\\\\\`You coordinate between specialist agents.
When asked about billing, delegate to the billing agent using agent.chat.
When asked about scheduling, delegate to the scheduler agent.\\\\\\\`,
  tools: ["agent.chat", "entity.query", "event.emit"],
})
\`\`\`

## Invoking Agents (API)

### Chat Endpoint
\`\`\`bash
curl -X POST https://your-convex-url.convex.cloud/v1/chat \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent_abc123",
    "message": "What is the status of order #12345?",
    "threadId": "thread_xyz",  // optional, creates new if omitted
    "metadata": { "customerId": "ent_cust_789" }  // available in system prompt
  }'
\`\`\`

### Response
\`\`\`json
{
  "threadId": "thread_xyz",
  "message": "Order #12345 is currently being shipped...",
  "usage": { "inputTokens": 150, "outputTokens": 89 }
}
\`\`\`

### By Slug (production)
\`\`\`bash
curl -X POST https://your-convex-url.convex.cloud/v1/agents/support/chat \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -d '{"message": "Hello"}'
\`\`\`

## Development Workflow

1. \`struere dev\` - Start watching
2. Edit files in agents/, entity-types/, roles/, tools/
3. Save → auto-syncs to Convex (you'll see "Synced" message)
4. Test via dashboard or curl
5. \`struere deploy\` - Push to production

## Evaluations (Evals)

Evals let you test agent behavior with automated assertions and LLM-as-judge scoring. Define test suites in YAML, run them via CLI or dashboard.

### Project Structure

\`\`\`
evals/                           # Eval suite definitions
├── basic-agent-tests.eval.yaml  # One file per suite
├── tool-usage.eval.yaml
└── edge-cases.eval.yaml
\`\`\`

### YAML Format

\`\`\`yaml
suite: "My Test Suite"           # Display name
slug: "my-test-suite"            # Unique identifier
agent: "my-agent-slug"           # Agent to test (by slug)
description: "What this tests"
tags: ["regression", "tools"]
judgeModel: "claude-haiku-4-5-20251001"  # LLM judge model
judgePrompt: "Be strict on factual accuracy but lenient on phrasing."  # Custom judge instructions

cases:
  - name: "Greeting test"
    description: "Agent introduces itself"
    turns:
      - user: "Hello, who are you?"
        assertions:
          - type: llm_judge
            criteria: "Response is polite and offers help"
            weight: 3
          - type: contains
            value: "help"

  - name: "Tool usage test"
    turns:
      - user: "Show me all customers"
        assertions:
          - type: tool_called
            value: "entity.query"
          - type: tool_not_called
            value: "entity.delete"

  - name: "Multi-turn context"
    turns:
      - user: "My name is Alex"
        assertions:
          - type: llm_judge
            criteria: "Acknowledges the name"
      - user: "What is my name?"
        assertions:
          - type: contains
            value: "Alex"
    finalAssertions:
      - type: llm_judge
        criteria: "Agent maintained context across the conversation"
\`\`\`

### Assertion Types

| Type | Field | Description |
|------|-------|-------------|
| \`llm_judge\` | \`criteria\` | LLM evaluates response against criteria (1-5 score, pass >= 3) |
| \`contains\` | \`value\` | Response contains substring (case-insensitive) |
| \`matches\` | \`value\` | Response matches regex pattern |
| \`tool_called\` | \`value\` | Specific tool was called during this turn |
| \`tool_not_called\` | \`value\` | Specific tool was NOT called during this turn |

Each assertion can have an optional \`weight\` (1-5, default 1) that affects the overall score.

Eval suites are synced via \\\`struere dev\\\` and can be run from the dashboard.

### Scaffold a new eval suite

\`\`\`bash
struere add eval my-new-suite
\`\`\`

Creates \`evals/my-new-suite.eval.yaml\` with a starter template.

### Writing Good Evals

1. **Be specific in \`llm_judge\` criteria** — "Response mentions the order status and delivery date" is better than "Good response"
2. **Use \`contains\`/\`matches\` for exact checks** — When you need a specific word or pattern, don't rely on the judge
3. **Use \`tool_called\`/\`tool_not_called\` for tool behavior** — Verify agents use the right tools
4. **Multi-turn tests** catch context loss — Test that the agent remembers info from earlier turns
5. **Use \`weight\`** to prioritize critical assertions — A weight-5 assertion matters 5x more than weight-1
6. **Use \`finalAssertions\`** to evaluate the overall conversation after all turns complete
7. **Use \`judgePrompt\`** to customize judge behavior per suite — e.g. strict for safety tests, lenient for quality tests

## Common Patterns

### Customer Support Agent
\`\`\`typescript
// agents/support.ts
export default defineAgent({
  name: "Support",
  slug: "support",
  version: "0.1.0",
  systemPrompt: \\\`You help customers with their orders and account issues.

When a customer asks about an order, use entity.query to find it first.
Always be polite and helpful. If you can't help, offer to escalate.\\\`,
  model: { provider: "anthropic", name: "claude-haiku-4-5" },
  tools: ["entity.query", "entity.get", "entity.update", "event.emit"],
})
\`\`\`

### Scheduling Agent
\`\`\`typescript
// agents/scheduler.ts
export default defineAgent({
  name: "Scheduler",
  slug: "scheduler",
  version: "0.1.0",
  systemPrompt: \\\`You help schedule appointments between teachers and students.

Check teacher availability before booking. Create session entities for confirmed bookings.
Send confirmation via the send_notification custom tool.\\\`,
  model: { provider: "anthropic", name: "claude-haiku-4-5" },
  tools: ["entity.create", "entity.query", "event.emit", "send_notification"],
})
\`\`\`

### Data Entry Agent
\`\`\`typescript
// agents/data-entry.ts
export default defineAgent({
  name: "Data Entry",
  slug: "data-entry",
  version: "0.1.0",
  systemPrompt: \\\`You help users create and update records in the system.

When creating entities, validate the data matches the schema.
Always confirm what was created/updated.\\\`,
  model: { provider: "anthropic", name: "claude-haiku-4-5" },
  tools: ["entity.create", "entity.update", "entity.query"],
})
\`\`\`
`
}

export function getTriggerTs(name: string, slug: string): string {
  return `import { defineTrigger } from 'struere'

export default defineTrigger({
  name: "${name}",
  slug: "${slug}",
  on: {
    entityType: "ENTITY_TYPE_HERE",
    action: "created",
  },
  actions: [
    {
      tool: "event.emit",
      args: {
        eventType: "trigger.${slug}.fired",
        entityId: "{{trigger.entityId}}",
        payload: { triggeredBy: "${slug}" },
      },
    },
  ],
})
`
}
