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


export function getFixtureYamlTemplate(name: string, slug: string): string {
  return `name: "${name}"
slug: "${slug}"

entities:
  - ref: "example-1"
    type: "ENTITY_TYPE_HERE"
    data:
      name: "Example Entity"
    status: "active"

  - ref: "example-2"
    type: "ENTITY_TYPE_HERE"
    data:
      name: "Another Entity"

relations:
  - from: "example-1"
    to: "example-2"
    type: "related_to"
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
