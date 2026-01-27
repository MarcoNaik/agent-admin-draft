import { describe, test, expect } from 'bun:test'
import {
  getPackageJson,
  getTsConfig,
  getStruereConfig,
  getAgentTs,
  getContextTs,
  getToolsTs,
  getBasicTestYaml,
  getEnvExample,
  getGitignore,
  getVercelApiHandler,
  getStruereJson,
  getEnvLocal,
} from '../templates'

describe('templates', () => {
  describe('getPackageJson', () => {
    test('returns valid JSON', () => {
      const result = getPackageJson('test-project')
      expect(() => JSON.parse(result)).not.toThrow()
    })

    test('includes project name', () => {
      const result = getPackageJson('my-agent')
      const parsed = JSON.parse(result)
      expect(parsed.name).toBe('my-agent')
    })

    test('includes correct scripts', () => {
      const result = getPackageJson('test')
      const parsed = JSON.parse(result)
      expect(parsed.scripts.dev).toBe('struere dev')
      expect(parsed.scripts.build).toBe('struere build')
      expect(parsed.scripts.test).toBe('struere test')
      expect(parsed.scripts.deploy).toBe('struere deploy')
    })

    test('includes required dependencies', () => {
      const result = getPackageJson('test')
      const parsed = JSON.parse(result)
      expect(parsed.dependencies['@struere/core']).toBeDefined()
      expect(parsed.dependencies['@struere/runtime']).toBeDefined()
    })

    test('includes required devDependencies', () => {
      const result = getPackageJson('test')
      const parsed = JSON.parse(result)
      expect(parsed.devDependencies['@struere/cli']).toBeDefined()
      expect(parsed.devDependencies['typescript']).toBeDefined()
    })

    test('sets type to module', () => {
      const result = getPackageJson('test')
      const parsed = JSON.parse(result)
      expect(parsed.type).toBe('module')
    })

    test('sets initial version to 0.1.0', () => {
      const result = getPackageJson('test')
      const parsed = JSON.parse(result)
      expect(parsed.version).toBe('0.1.0')
    })
  })

  describe('getTsConfig', () => {
    test('returns valid JSON', () => {
      const result = getTsConfig()
      expect(() => JSON.parse(result)).not.toThrow()
    })

    test('targets ES2022', () => {
      const result = getTsConfig()
      const parsed = JSON.parse(result)
      expect(parsed.compilerOptions.target).toBe('ES2022')
    })

    test('uses ESNext module', () => {
      const result = getTsConfig()
      const parsed = JSON.parse(result)
      expect(parsed.compilerOptions.module).toBe('ESNext')
    })

    test('enables strict mode', () => {
      const result = getTsConfig()
      const parsed = JSON.parse(result)
      expect(parsed.compilerOptions.strict).toBe(true)
    })

    test('includes bun-types', () => {
      const result = getTsConfig()
      const parsed = JSON.parse(result)
      expect(parsed.compilerOptions.types).toContain('bun-types')
    })

    test('excludes node_modules and dist', () => {
      const result = getTsConfig()
      const parsed = JSON.parse(result)
      expect(parsed.exclude).toContain('node_modules')
      expect(parsed.exclude).toContain('dist')
    })
  })

  describe('getStruereConfig', () => {
    test('contains defineConfig import', () => {
      const result = getStruereConfig()
      expect(result).toContain("import { defineConfig } from '@struere/core'")
    })

    test('exports default config', () => {
      const result = getStruereConfig()
      expect(result).toContain('export default defineConfig')
    })

    test('sets default port to 3000', () => {
      const result = getStruereConfig()
      expect(result).toContain('port: 3000')
    })

    test('sets default host to localhost', () => {
      const result = getStruereConfig()
      expect(result).toContain("host: 'localhost'")
    })

    test('includes cors configuration', () => {
      const result = getStruereConfig()
      expect(result).toContain('cors:')
      expect(result).toContain('origins:')
      expect(result).toContain('credentials: true')
    })

    test('includes logging configuration', () => {
      const result = getStruereConfig()
      expect(result).toContain('logging:')
      expect(result).toContain("level: 'info'")
      expect(result).toContain("format: 'pretty'")
    })
  })

  describe('getAgentTs', () => {
    test('contains defineAgent import', () => {
      const result = getAgentTs('test-agent')
      expect(result).toContain("import { defineAgent } from '@struere/core'")
    })

    test('includes project name in agent config', () => {
      const result = getAgentTs('my-awesome-agent')
      expect(result).toContain("name: 'my-awesome-agent'")
    })

    test('capitalizes display name correctly', () => {
      const result = getAgentTs('my-test-agent')
      expect(result).toContain('My Test Agent')
    })

    test('includes default model configuration', () => {
      const result = getAgentTs('test')
      expect(result).toContain("provider: 'anthropic'")
      expect(result).toContain('claude-sonnet-4-20250514')
    })

    test('includes system prompt', () => {
      const result = getAgentTs('test')
      expect(result).toContain('systemPrompt:')
    })

    test('imports context and tools', () => {
      const result = getAgentTs('test')
      expect(result).toContain("import { context } from './context'")
      expect(result).toContain("import { tools } from './tools'")
    })

    test('includes state configuration', () => {
      const result = getAgentTs('test')
      expect(result).toContain('state:')
      expect(result).toContain("storage: 'memory'")
      expect(result).toContain('ttl: 3600')
    })
  })

  describe('getContextTs', () => {
    test('contains defineContext import', () => {
      const result = getContextTs()
      expect(result).toContain("import { defineContext } from '@struere/core'")
    })

    test('exports context', () => {
      const result = getContextTs()
      expect(result).toContain('export const context')
    })

    test('uses async function', () => {
      const result = getContextTs()
      expect(result).toContain('async (request)')
    })

    test('destructures request parameters', () => {
      const result = getContextTs()
      expect(result).toContain('conversationId')
      expect(result).toContain('userId')
      expect(result).toContain('channel')
      expect(result).toContain('state')
    })

    test('returns additionalContext and variables', () => {
      const result = getContextTs()
      expect(result).toContain('additionalContext:')
      expect(result).toContain('variables:')
    })
  })

  describe('getToolsTs', () => {
    test('contains defineTools import', () => {
      const result = getToolsTs()
      expect(result).toContain("import { defineTools } from '@struere/core'")
    })

    test('exports tools array', () => {
      const result = getToolsTs()
      expect(result).toContain('export const tools')
    })

    test('includes get_current_time tool', () => {
      const result = getToolsTs()
      expect(result).toContain("name: 'get_current_time'")
      expect(result).toContain('Get the current date and time')
    })

    test('includes calculate tool', () => {
      const result = getToolsTs()
      expect(result).toContain("name: 'calculate'")
      expect(result).toContain('Perform a mathematical calculation')
    })

    test('tools have handlers', () => {
      const result = getToolsTs()
      expect(result).toContain('handler: async')
    })

    test('tools have parameters', () => {
      const result = getToolsTs()
      expect(result).toContain("type: 'object'")
      expect(result).toContain('properties:')
    })
  })

  describe('getBasicTestYaml', () => {
    test('includes test name', () => {
      const result = getBasicTestYaml()
      expect(result).toContain('name:')
    })

    test('includes test description', () => {
      const result = getBasicTestYaml()
      expect(result).toContain('description:')
    })

    test('includes conversation array', () => {
      const result = getBasicTestYaml()
      expect(result).toContain('conversation:')
    })

    test('includes user and assistant roles', () => {
      const result = getBasicTestYaml()
      expect(result).toContain('role: user')
      expect(result).toContain('role: assistant')
    })

    test('includes assertions', () => {
      const result = getBasicTestYaml()
      expect(result).toContain('assertions:')
      expect(result).toContain('type: contains')
      expect(result).toContain('type: toolCalled')
    })
  })

  describe('getEnvExample', () => {
    test('includes ANTHROPIC_API_KEY', () => {
      const result = getEnvExample()
      expect(result).toContain('ANTHROPIC_API_KEY')
    })

    test('includes commented OpenAI key', () => {
      const result = getEnvExample()
      expect(result).toContain('# OPENAI_API_KEY')
    })

    test('includes commented Google key', () => {
      const result = getEnvExample()
      expect(result).toContain('# GOOGLE_GENERATIVE_AI_API_KEY')
    })

    test('includes commented STRUERE_API_URL', () => {
      const result = getEnvExample()
      expect(result).toContain('# STRUERE_API_URL')
    })
  })

  describe('getGitignore', () => {
    test('includes node_modules', () => {
      const result = getGitignore()
      expect(result).toContain('node_modules/')
    })

    test('includes dist', () => {
      const result = getGitignore()
      expect(result).toContain('dist/')
    })

    test('includes .env files', () => {
      const result = getGitignore()
      expect(result).toContain('.env')
      expect(result).toContain('.env.local')
    })

    test('includes IDE directories', () => {
      const result = getGitignore()
      expect(result).toContain('.idea/')
      expect(result).toContain('.vscode/')
    })

    test('includes OS files', () => {
      const result = getGitignore()
      expect(result).toContain('.DS_Store')
    })

    test('includes .vercel', () => {
      const result = getGitignore()
      expect(result).toContain('.vercel/')
    })
  })

  describe('getVercelApiHandler', () => {
    test('imports agent', () => {
      const result = getVercelApiHandler()
      expect(result).toContain("import agent from '../src/agent'")
    })

    test('imports createVercelHandler', () => {
      const result = getVercelApiHandler()
      expect(result).toContain("import { createVercelHandler } from '@struere/runtime/serverless/vercel'")
    })

    test('exports default handler', () => {
      const result = getVercelApiHandler()
      expect(result).toContain('export default createVercelHandler')
    })

    test('enables streaming', () => {
      const result = getVercelApiHandler()
      expect(result).toContain('streaming: true')
    })

    test('sets edge runtime', () => {
      const result = getVercelApiHandler()
      expect(result).toContain("runtime: 'edge'")
    })
  })

  describe('getStruereJson', () => {
    test('returns valid JSON', () => {
      const result = getStruereJson('agt_123', 'my-team', 'my-agent', 'My Agent')
      expect(() => JSON.parse(result)).not.toThrow()
    })

    test('includes agentId', () => {
      const result = getStruereJson('agt_xyz', 'team', 'slug', 'name')
      const parsed = JSON.parse(result)
      expect(parsed.agentId).toBe('agt_xyz')
    })

    test('includes team', () => {
      const result = getStruereJson('id', 'awesome-team', 'slug', 'name')
      const parsed = JSON.parse(result)
      expect(parsed.team).toBe('awesome-team')
    })

    test('includes agent.slug', () => {
      const result = getStruereJson('id', 'team', 'my-slug', 'name')
      const parsed = JSON.parse(result)
      expect(parsed.agent.slug).toBe('my-slug')
    })

    test('includes agent.name', () => {
      const result = getStruereJson('id', 'team', 'slug', 'My Cool Agent')
      const parsed = JSON.parse(result)
      expect(parsed.agent.name).toBe('My Cool Agent')
    })
  })

  describe('getEnvLocal', () => {
    test('includes STRUERE_DEPLOYMENT_URL', () => {
      const result = getEnvLocal('https://example.struere.dev')
      expect(result).toContain('STRUERE_DEPLOYMENT_URL')
    })

    test('sets correct URL value', () => {
      const result = getEnvLocal('https://my-agent-dev.struere.dev')
      expect(result).toContain('STRUERE_DEPLOYMENT_URL=https://my-agent-dev.struere.dev')
    })

    test('ends with newline', () => {
      const result = getEnvLocal('https://test.dev')
      expect(result.endsWith('\n')).toBe(true)
    })
  })
})
