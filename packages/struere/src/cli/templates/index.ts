export function getPackageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'struere dev',
        build: 'struere build',
        test: 'struere test',
        deploy: 'struere deploy',
      },
      dependencies: {
        struere: '^0.3.0',
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
        rootDir: 'src',
        types: ['bun-types'],
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2
  )
}

export function getStruereConfig(): string {
  return `import { defineConfig } from 'struere'

export default defineConfig({
  port: 3000,
  host: 'localhost',
  cors: {
    origins: ['http://localhost:3000'],
    credentials: true,
  },
  logging: {
    level: 'info',
    format: 'pretty',
  },
})
`
}

export function getAgentTs(name: string): string {
  const displayName = name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return `import { defineAgent } from 'struere'
import { tools } from './tools'

export default defineAgent({
  name: '${name}',
  version: '0.1.0',
  description: '${displayName} Agent',
  model: {
    provider: 'anthropic',
    name: 'claude-haiku-4-5',
    temperature: 0.7,
    maxTokens: 4096,
  },
  systemPrompt: \`You are ${displayName}, a helpful AI assistant.

Current time: {{datetime}}

Your capabilities:
- Answer questions accurately and helpfully
- Use available tools when appropriate
- Maintain conversation context

Always be concise, accurate, and helpful.\`,
  tools,
})
`
}

export function getToolsTs(): string {
  return `import { defineTools } from 'struere'

export const tools = defineTools([
  {
    name: 'get_current_time',
    description: 'Get the current date and time',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Timezone (e.g., "America/New_York", "UTC")',
        },
      },
    },
    handler: async (params) => {
      const timezone = (params.timezone as string) || 'UTC'
      const now = new Date()
      return {
        timestamp: now.toISOString(),
        formatted: now.toLocaleString('en-US', { timeZone: timezone }),
        timezone,
      }
    },
  },
  {
    name: 'calculate',
    description: 'Perform a mathematical calculation',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2")',
        },
      },
      required: ['expression'],
    },
    handler: async (params) => {
      const expression = params.expression as string
      const sanitized = expression.replace(/[^0-9+*/().\\s-]/g, '')
      try {
        const result = new Function(\`return \${sanitized}\`)()
        return { expression, result }
      } catch {
        return { expression, error: 'Invalid expression' }
      }
    },
  },
])
`
}

export function getBasicTestYaml(): string {
  return `name: Basic conversation test
description: Verify the agent responds correctly to basic queries

conversation:
  - role: user
    content: Hello, what can you do?
  - role: assistant
    assertions:
      - type: contains
        value: help

  - role: user
    content: What time is it?
  - role: assistant
    assertions:
      - type: toolCalled
        value: get_current_time
`
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
`
}

export function getStruereJson(agentId: string, team: string, slug: string, name: string): string {
  return JSON.stringify(
    {
      agentId,
      team,
      agent: {
        slug,
        name,
      },
    },
    null,
    2
  )
}

export function getEnvLocal(deploymentUrl: string): string {
  return `STRUERE_DEPLOYMENT_URL=${deploymentUrl}
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
    { resource: "*", actions: ["list", "read"], effect: "allow", priority: 50 },
  ],
  scopeRules: [],
  fieldMasks: [],
})
`
}

export function getAgentTsV2(name: string, slug: string): string {
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

export function getIndexTs(type: 'agents' | 'entity-types' | 'roles'): string {
  return `// Export all ${type} from this directory
// Example: export { default as myAgent } from './my-agent'
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

export function getStruereJsonV2(orgId: string, orgSlug: string, orgName: string): string {
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

export function getPackageJsonV2(name: string): string {
  return JSON.stringify(
    {
      name,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'struere dev',
        build: 'struere build',
        deploy: 'struere deploy',
        status: 'struere status',
      },
      dependencies: {
        struere: '^0.4.0',
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

export function getClaudeMDV2(orgName: string): string {
  return `# ${orgName} - Struere Workspace

> **This is a workspace project**, not the Struere framework source code. You define agents, entity types, roles, and custom tools here. The CLI syncs them to Convex. Framework source: github.com/struere/struere

Struere is a framework for building production AI agents with Convex as the real-time backend. Agents can manage entities (business data), emit events, and schedule background jobs—all with built-in RBAC permissions.

## How It Works

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  Your Project (this folder)                                     │
│  ├── agents/*.ts        → Agent configs synced to Convex        │
│  ├── entity-types/*.ts  → Schema definitions synced to Convex   │
│  ├── roles/*.ts         → RBAC policies synced to Convex        │
│  ├── tools/index.ts     → Custom tools (run on CF Worker)       │
│  └── evals/*.eval.yaml  → Test suites (synced + executed)       │
└─────────────────────┬───────────────────────────────────────────┘
                      │ struere dev (watches & syncs)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Convex (Real-time Backend)                                      │
│  • Stores agent configs, entities, events, jobs                  │
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
├── my-agent.ts      # One file per agent
└── index.ts         # Re-exports (optional)

entity-types/        # Data schemas (like DB tables)
├── customer.ts      # Defines shape of "customer" entities
└── index.ts

roles/               # RBAC: who can do what
├── admin.ts         # Full access
├── support.ts       # Limited access
└── index.ts

tools/               # Custom tools shared by all agents
└── index.ts         # defineTools([...])

evals/               # Eval suites (YAML test definitions)
├── basic.eval.yaml  # One file per suite
└── tools.eval.yaml

struere.json         # Organization ID (don't edit)
struere.config.ts    # Local dev settings (port, CORS)
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

### struere.config.ts (optional local settings)
\`\`\`typescript
import { defineConfig } from 'struere'
export default defineConfig({
  port: 3000,           // Local dev server port
  logging: { level: 'debug' }
})
\`\`\`

## CLI Commands

| Command | What it does |
|---------|--------------|
| \`struere dev\` | Watch files, sync to Convex on every save |
| \`struere deploy\` | Copy dev config to production for all agents |
| \`struere add agent <name>\` | Create agents/name.ts with template |
| \`struere add entity-type <name>\` | Create entity-types/name.ts |
| \`struere add role <name>\` | Create roles/name.ts |
| \`struere add eval <name>\` | Create evals/name.eval.yaml with template |
| \`struere eval\` | Run all eval suites |
| \`struere eval --suite <name>\` | Run a specific eval suite |
| \`struere status\` | Show what's synced vs local-only |

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
    { resource: "customer", actions: ["list", "read"], effect: "allow", priority: 50 },
    { resource: "customer", actions: ["delete"], effect: "deny", priority: 100 },
    { resource: "payment", actions: ["*"], effect: "deny", priority: 100 },
  ],

  // Row-level security: only see assigned customers
  scopeRules: [
    {
      entityType: "customer",
      field: "data.assignedTo",  // Field in entity data
      operator: "eq",
      value: "actor.userId"      // Current user's ID
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

Deny policies override allow. Higher priority wins.

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

### Job Tools

\`\`\`typescript
// job.enqueue - Schedule background work
{
  jobType: "send_reminder",
  payload: { customerId: "ent_abc", message: "Your trial ends soon" },
  runAt: 1706832000000  // Unix timestamp (optional, runs immediately if omitted)
}

// job.status - Check job status
{ jobId: "job_xyz123" }
// Returns: { status: "pending" | "running" | "completed" | "failed", result: {...} }
\`\`\`

Jobs run asynchronously with retry logic. Use for: emails, notifications, data sync.

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

### CLI Commands

\`\`\`bash
# Run all eval suites
struere eval

# Run a specific suite
struere eval --suite my-test-suite

# Dry run (parse only, no execution)
struere eval --dry-run

# Verbose output (shows judge reasoning on failures)
struere eval --verbose

# JSON output (for CI/CD)
struere eval --json

# Skip syncing (use already-synced suites)
struere eval --no-sync
\`\`\`

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
  tools: ["entity.create", "entity.query", "job.enqueue", "send_notification"],
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

export function getClaudeMD(name: string): string {
  const displayName = name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return `# ${displayName} Agent

This is a Struere AI agent project. Struere is a framework for building production AI agents with built-in data management, event tracking, and job scheduling.

## Project Structure

\`\`\`
src/
├── agent.ts      # Agent definition (system prompt, model, tools)
├── tools.ts      # Custom tool definitions
└── workflows/    # Multi-step workflow definitions
tests/
└── *.test.yaml   # YAML-based conversation tests
struere.json      # Project configuration (agentId, team, slug)
struere.config.ts # Framework settings (port, CORS, logging)
\`\`\`

## Agent Definition

Define your agent in \`src/agent.ts\`:

\`\`\`typescript
import { defineAgent } from 'struere'
import { tools } from './tools'

export default defineAgent({
  name: 'my-agent',
  version: '0.1.0',
  description: 'My AI Agent',
  model: {
    provider: 'anthropic',
    name: 'claude-haiku-4-5',  // Best cost/intelligence ratio
    temperature: 0.7,
    maxTokens: 4096,
  },
  systemPrompt: \\\`You are a helpful assistant.

Current time: {{datetime}}
Customer: {{entity.get({"id": "{{thread.metadata.customerId}}"})}}\\\`,
  tools,
})
\`\`\`

## System Prompt Templates

System prompts support dynamic \`{{...}}\` templates that are resolved at runtime before the LLM call.

### Available Variables

| Variable | Type | Description |
|----------|------|-------------|
| \`{{currentTime}}\` | string | ISO 8601 timestamp |
| \`{{datetime}}\` | string | ISO 8601 timestamp (alias) |
| \`{{timestamp}}\` | number | Unix timestamp (ms) |
| \`{{organizationName}}\` | string | Organization name |
| \`{{organizationId}}\` | string | Organization ID |
| \`{{agentName}}\` | string | Agent display name |
| \`{{agent.name}}\` | string | Agent name |
| \`{{agent.slug}}\` | string | Agent slug |
| \`{{userId}}\` | string | Current user ID |
| \`{{threadId}}\` | string | Conversation thread ID |
| \`{{agentId}}\` | string | Agent ID |
| \`{{thread.metadata.X}}\` | any | Thread metadata field X |
| \`{{message}}\` | string | Current user message |
| \`{{entityTypes}}\` | array | JSON array of all entity types |
| \`{{roles}}\` | array | JSON array of all roles |

### Function Calls

Call any agent tool directly in the system prompt:

\`\`\`
{{entity.get({"id": "ent_123"})}}
{{entity.query({"type": "customer", "limit": 5})}}
{{event.query({"entityId": "ent_123", "limit": 10})}}
\`\`\`

### Nested Templates

Variables can be used inside function arguments:

\`\`\`
{{entity.get({"id": "{{thread.metadata.customerId}}"})}}
\`\`\`

### Error Handling

Failed templates are replaced with inline errors:
\`\`\`
[TEMPLATE_ERROR: variableName not found]
[TEMPLATE_ERROR: toolName - error message]
\`\`\`

## Custom Tools

Define tools in \`src/tools.ts\`:

\`\`\`typescript
import { defineTools } from 'struere'

export const tools = defineTools([
  {
    name: 'search_products',
    description: 'Search the product catalog',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results' },
      },
      required: ['query'],
    },
    handler: async (params) => {
      const results = await searchProducts(params.query, params.limit ?? 10)
      return { products: results }
    },
  },
])
\`\`\`

Custom tool handlers are executed in a sandboxed Cloudflare Worker environment. They can make HTTP requests to allowlisted domains:
- api.openai.com, api.anthropic.com, api.stripe.com
- api.sendgrid.com, api.twilio.com, hooks.slack.com
- discord.com, api.github.com

## Built-in Tools

Agents have access to these built-in tools for data management:

### Entity Tools

| Tool | Description |
|------|-------------|
| \`entity.create\` | Create a new entity |
| \`entity.get\` | Get entity by ID |
| \`entity.query\` | Query entities by type/filters |
| \`entity.update\` | Update entity data |
| \`entity.delete\` | Soft-delete entity |
| \`entity.link\` | Create entity relation |
| \`entity.unlink\` | Remove entity relation |

Example entity operations:
\`\`\`json
// entity.create
{ "type": "customer", "data": { "name": "John", "email": "john@example.com" } }

// entity.query
{ "type": "customer", "filters": { "status": "active" }, "limit": 10 }

// entity.update
{ "id": "ent_123", "data": { "status": "vip" } }
\`\`\`

### Event Tools

| Tool | Description |
|------|-------------|
| \`event.emit\` | Emit a custom event |
| \`event.query\` | Query event history |

Example event operations:
\`\`\`json
// event.emit
{ "entityId": "ent_123", "eventType": "order.placed", "payload": { "amount": 99.99 } }

// event.query
{ "entityId": "ent_123", "eventType": "order.*", "limit": 20 }
\`\`\`

### Job Tools

| Tool | Description |
|------|-------------|
| \`job.enqueue\` | Schedule a background job |
| \`job.status\` | Get job status |

Example job operations:
\`\`\`json
// job.enqueue
{ "jobType": "send_email", "payload": { "to": "user@example.com" }, "scheduledFor": 1706745600000 }

// job.status
{ "id": "job_abc123" }
\`\`\`

## Evaluations (Evals)

Evals test agent behavior with automated assertions and LLM-as-judge scoring.

### Eval File Format

Create YAML files in \`evals/\` (or \`tests/\` for legacy):

\`\`\`yaml
suite: "Order Flow Tests"
slug: "order-flow-tests"
agent: "my-agent-slug"
description: "Test the complete order flow"
judgeModel: "claude-haiku-4-5-20251001"
judgePrompt: "Focus on workflow correctness. Penalize wrong tool usage or missing steps."

cases:
  - name: "Order initiation"
    turns:
      - user: "I want to order a pizza"
        assertions:
          - type: llm_judge
            criteria: "Agent asks about pizza size or toppings"
            weight: 3
          - type: contains
            value: "size"
          - type: tool_called
            value: "entity.query"

  - name: "Order completion"
    turns:
      - user: "Large pepperoni please"
        assertions:
          - type: tool_called
            value: "entity.create"
          - type: tool_not_called
            value: "entity.delete"
          - type: llm_judge
            criteria: "Agent confirms the order details"
\`\`\`

### Assertion Types

| Type | Field | Description |
|------|-------|-------------|
| \`llm_judge\` | \`criteria\` | LLM evaluates response against criteria (1-5 score, pass >= 3) |
| \`contains\` | \`value\` | Response contains substring (case-insensitive) |
| \`matches\` | \`value\` | Response matches regex pattern |
| \`tool_called\` | \`value\` | Specific tool was called during this turn |
| \`tool_not_called\` | \`value\` | Specific tool was NOT called during this turn |

Each assertion supports optional \`weight\` (1-5, default 1) for score weighting.

### Running Evals

\`\`\`bash
struere eval                    # Run all suites
struere eval --suite order-flow # Run specific suite
struere eval --verbose          # Show judge reasoning
struere eval --dry-run          # Parse only
struere eval --json             # JSON output for CI/CD
\`\`\`

### Scaffold a new eval

\`\`\`bash
struere add eval my-suite
\`\`\`

## CLI Commands

| Command | Description |
|---------|-------------|
| \`struere dev\` | Start development mode (live sync to Convex) |
| \`struere build\` | Validate agent configuration |
| \`struere deploy\` | Deploy agent to production |
| \`struere eval\` | Run eval suites with LLM judge |
| \`struere add eval <name>\` | Scaffold a new eval YAML file |
| \`struere logs\` | View recent execution logs |
| \`struere state\` | Inspect conversation thread state |

## Thread Metadata

Set thread metadata when creating conversations to provide context:

\`\`\`typescript
// Via API
POST /v1/chat
{
  "agentId": "agent_123",
  "message": "Hello",
  "metadata": {
    "customerId": "ent_customer_456",
    "channel": "web",
    "language": "en"
  }
}
\`\`\`

Access in system prompt:
\`\`\`
Customer: {{entity.get({"id": "{{thread.metadata.customerId}}"})}}
Channel: {{thread.metadata.channel}}
\`\`\`

## Development Workflow

1. **Edit agent configuration** in \`src/agent.ts\`
2. **Run \`bun run dev\`** to sync changes to Convex
3. **Test via API** or dashboard chat interface
4. **Write tests** in \`tests/*.test.yaml\`
5. **Deploy** with \`bun run deploy\`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/v1/chat\` | POST | Chat by agent ID |
| \`/v1/agents/:slug/chat\` | POST | Chat by agent slug |

Authentication: Bearer token (API key from dashboard)

\`\`\`bash
curl -X POST https://your-deployment.convex.cloud/v1/chat \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"agentId": "...", "message": "Hello"}'
\`\`\`

## Best Practices

1. **System Prompts**: Use templates for dynamic data instead of hardcoding
2. **Tools**: Keep tool handlers focused and stateless
3. **Entities**: Model your domain data as entity types
4. **Events**: Emit events for audit trails and analytics
5. **Jobs**: Use jobs for async operations (emails, notifications)
6. **Testing**: Write tests for critical conversation flows
7. **Thread Metadata**: Use metadata for user-specific personalization
`
}
