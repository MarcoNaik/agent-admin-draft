export function getTemplates(projectName: string): Record<string, string> {
  return {
    'package.json': getPackageJson(projectName),
    'tsconfig.json': getTsConfig(),
    'struere.config.ts': getStruereConfig(),
    'src/agent.ts': getAgentTs(projectName),
    'src/context.ts': getContextTs(),
    'src/tools.ts': getToolsTs(),
    'src/workflows/.gitkeep': '',
    'api/chat.ts': getVercelApiHandler(),
    'tests/basic.test.yaml': getBasicTestYaml(),
    '.env.example': getEnvExample(),
    'README.md': getReadme(projectName),
    '.gitignore': getGitignore(),
  }
}

function getPackageJson(name: string): string {
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
        '@struere/core': '^0.1.0',
        '@struere/runtime': '^0.1.0',
      },
      devDependencies: {
        '@struere/cli': '^0.1.0',
        'bun-types': '^1.0.0',
        typescript: '^5.3.0',
      },
    },
    null,
    2
  )
}

function getTsConfig(): string {
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

function getStruereConfig(): string {
  return `import { defineConfig } from '@struere/core'

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

function getAgentTs(name: string): string {
  const displayName = name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return `import { defineAgent } from '@struere/core'
import { context } from './context'
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

Your capabilities:
- Answer questions accurately and helpfully
- Use available tools when appropriate
- Maintain conversation context

Always be concise, accurate, and helpful.\`,
  tools,
  context,
  state: {
    storage: 'memory',
    ttl: 3600,
  },
})
`
}

function getContextTs(): string {
  return `import { defineContext } from '@struere/core'

export const context = defineContext(async (request) => {
  const { conversationId, userId, channel, state } = request

  return {
    additionalContext: \`
Current conversation: \${conversationId}
Channel: \${channel}
\`,
    variables: {
      userId,
      timestamp: new Date().toISOString(),
    },
  }
})
`
}

function getToolsTs(): string {
  return `import { defineTools } from '@struere/core'

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

function getBasicTestYaml(): string {
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

function getEnvExample(): string {
  return `# Anthropic API Key (default provider)
ANTHROPIC_API_KEY=your_api_key_here

# Optional: OpenAI API Key (if using OpenAI models)
# OPENAI_API_KEY=your_openai_api_key

# Optional: Google AI API Key (if using Gemini models)
# GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key

# Optional: Custom API endpoint
# STRUERE_API_URL=https://api.struere.dev
`
}

function getReadme(name: string): string {
  const displayName = name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return `# ${displayName}

An AI agent built with Struere.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   bun install
   \`\`\`

2. Set up your environment:
   \`\`\`bash
   cp .env.example .env
   # Edit .env and add your API keys
   \`\`\`

3. Start the development server:
   \`\`\`bash
   bun run dev
   \`\`\`

4. Open http://localhost:3000 to chat with your agent.

## Project Structure

- \`src/agent.ts\` - Main agent definition (system prompt, model config)
- \`src/context.ts\` - Dynamic context injection
- \`src/tools.ts\` - Custom tools for the agent
- \`src/workflows/\` - Multi-step workflows (coming soon)
- \`api/chat.ts\` - Vercel Edge API handler for production
- \`tests/\` - Test conversations
- \`struere.config.ts\` - Framework configuration

## Commands

- \`bun run dev\` - Start development server with hot reload
- \`bun run build\` - Build and validate the agent
- \`bun run test\` - Run test conversations
- \`bun run deploy\` - Deploy to Struere cloud

## Deploy to Vercel

This project is ready for Vercel deployment:

1. Push to GitHub
2. Import in Vercel
3. Add your \`ANTHROPIC_API_KEY\` to environment variables
4. Deploy!

The \`api/chat.ts\` file provides a streaming chat endpoint at \`/api/chat\`.

## API Usage

Send a POST request to \`/api/chat\`:

\`\`\`bash
curl -X POST https://your-app.vercel.app/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!", "stream": true}'
\`\`\`

## Documentation

Visit [struere.dev/docs](https://struere.dev/docs) for full documentation.
`
}

function getGitignore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Vercel
.vercel/
`
}

function getVercelApiHandler(): string {
  return `import agent from '../src/agent'
import { createVercelHandler } from '@struere/runtime/serverless/vercel'

export default createVercelHandler(agent, {
  streaming: true,
  corsOrigins: ['*'],
})

export const config = {
  runtime: 'edge',
}
`
}
