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
    name: 'claude-sonnet-4-20250514',
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
    name: "claude-sonnet-4-20250514",
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
])

export default tools
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
  return `# ${orgName} - Struere Project

This is a Struere organization project. Struere is a framework for building production AI agents with built-in data management, RBAC permissions, and job scheduling.

## Project Structure

\`\`\`
agents/              # Agent definitions
├── scheduler.ts     # Example agent
└── index.ts         # Re-exports all agents

entity-types/        # Entity type schemas
├── teacher.ts       # Example entity type
└── index.ts         # Re-exports all entity types

roles/               # Role + permission definitions
├── admin.ts         # Example role with policies
└── index.ts         # Re-exports all roles

tools/               # Shared custom tools
└── index.ts         # Custom tool definitions

struere.json         # Organization configuration
struere.config.ts    # Framework settings
\`\`\`

## CLI Commands

| Command | Description |
|---------|-------------|
| \`struere dev\` | Watch and sync all resources to Convex |
| \`struere deploy\` | Deploy all agents to production |
| \`struere add <type> <name>\` | Scaffold new agent/entity-type/role |
| \`struere status\` | Compare local vs remote state |

## Defining Resources

### Agents (\`agents/*.ts\`)

\`\`\`typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Scheduler",
  slug: "scheduler",
  version: "0.1.0",
  systemPrompt: "You are a scheduling assistant...",
  model: { provider: "anthropic", name: "claude-sonnet-4-20250514" },
  tools: ["entity.create", "entity.query", "event.emit"],
})
\`\`\`

### Entity Types (\`entity-types/*.ts\`)

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
      hourlyRate: { type: "number" },
    },
    required: ["name", "email"],
  },
  searchFields: ["name", "email"],
})
\`\`\`

### Roles (\`roles/*.ts\`)

\`\`\`typescript
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
\`\`\`

## Built-in Tools

| Tool | Description |
|------|-------------|
| \`entity.create\` | Create a new entity |
| \`entity.get\` | Get entity by ID |
| \`entity.query\` | Query entities by type/filters |
| \`entity.update\` | Update entity data |
| \`entity.delete\` | Soft-delete entity |
| \`entity.link\` | Create entity relation |
| \`entity.unlink\` | Remove entity relation |
| \`event.emit\` | Emit custom event |
| \`event.query\` | Query events |
| \`job.enqueue\` | Schedule background job |
| \`job.status\` | Get job status |

## Development Workflow

1. Run \`struere dev\` to start watching for changes
2. Edit agents, entity types, or roles
3. Changes are automatically synced to Convex
4. Test via API or dashboard
5. Run \`struere deploy\` when ready for production
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
    name: 'claude-sonnet-4-20250514',
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

| Variable | Description |
|----------|-------------|
| \`{{organizationId}}\` | Current organization ID |
| \`{{userId}}\` | Current user ID |
| \`{{threadId}}\` | Conversation thread ID |
| \`{{agentId}}\` | Agent ID |
| \`{{agent.name}}\` | Agent name |
| \`{{agent.slug}}\` | Agent slug |
| \`{{thread.metadata.X}}\` | Thread metadata field X |
| \`{{message}}\` | Current user message |
| \`{{timestamp}}\` | Unix timestamp (ms) |
| \`{{datetime}}\` | ISO 8601 datetime |

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

## Testing

Write YAML-based conversation tests in \`tests/\`:

\`\`\`yaml
name: Order flow test
description: Test the complete order flow

conversation:
  - role: user
    content: I want to order a pizza
  - role: assistant
    assertions:
      - type: contains
        value: size
      - type: toolCalled
        value: get_menu

  - role: user
    content: Large pepperoni please
  - role: assistant
    assertions:
      - type: toolCalled
        value: entity.create
\`\`\`

### Assertion Types

| Type | Description |
|------|-------------|
| \`contains\` | Response contains substring |
| \`matches\` | Response matches regex |
| \`toolCalled\` | Specific tool was called |
| \`noToolCalled\` | No tools were called |

Run tests with:
\`\`\`bash
bun run test
\`\`\`

## CLI Commands

| Command | Description |
|---------|-------------|
| \`struere dev\` | Start development mode (live sync to Convex) |
| \`struere build\` | Validate agent configuration |
| \`struere deploy\` | Deploy agent to production |
| \`struere test\` | Run YAML conversation tests |
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
