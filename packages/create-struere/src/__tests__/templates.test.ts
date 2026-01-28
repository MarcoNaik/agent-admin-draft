import { describe, test, expect } from 'bun:test'
import { getTemplates } from '../templates/index'

describe('getTemplates', () => {
  const projectName = 'test-agent'
  const templates = getTemplates(projectName)

  test('returns all required template files', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'struere.config.ts',
      'src/agent.ts',
      'src/context.ts',
      'src/tools.ts',
      'src/workflows/.gitkeep',
      'api/chat.ts',
      'tests/basic.test.yaml',
      '.env.example',
      'README.md',
      '.gitignore',
    ]

    const templateKeys = Object.keys(templates)
    for (const file of requiredFiles) {
      expect(templateKeys).toContain(file)
    }
  })

  test('package.json contains correct project name', () => {
    const packageJson = JSON.parse(templates['package.json'])
    expect(packageJson.name).toBe(projectName)
  })

  test('package.json has required dependencies', () => {
    const packageJson = JSON.parse(templates['package.json'])
    expect(packageJson.dependencies).toHaveProperty('@struere/core')
    expect(packageJson.dependencies).toHaveProperty('@struere/runtime')
    expect(packageJson.devDependencies).toHaveProperty('@struere/cli')
  })

  test('agent.ts uses correct project name', () => {
    const agentTs = templates['src/agent.ts']
    expect(agentTs).toContain(`name: '${projectName}'`)
  })

  test('agent.ts contains valid defineAgent import', () => {
    const agentTs = templates['src/agent.ts']
    expect(agentTs).toContain("import { defineAgent } from '@struere/core'")
    expect(agentTs).toContain('export default defineAgent(')
  })

  test('tools.ts exports valid tools definition', () => {
    const toolsTs = templates['src/tools.ts']
    expect(toolsTs).toContain("import { defineTools } from '@struere/core'")
    expect(toolsTs).toContain('export const tools = defineTools(')
  })

  test('api/chat.ts uses correct runtime import', () => {
    const apiHandler = templates['api/chat.ts']
    expect(apiHandler).toContain("import { createVercelHandler } from '@struere/runtime/serverless/vercel'")
    expect(apiHandler).toContain("import agent from '../src/agent'")
  })

  test('.env.example contains required environment variables', () => {
    const envExample = templates['.env.example']
    expect(envExample).toContain('ANTHROPIC_API_KEY')
  })

  test('handles project names with hyphens correctly', () => {
    const templates = getTemplates('my-awesome-agent')
    const readme = templates['README.md']
    expect(readme).toContain('# My Awesome Agent')
  })
})

describe('template file structure', () => {
  test('api/chat.ts is included for Vercel deployment', () => {
    const templates = getTemplates('test')
    expect(templates['api/chat.ts']).toBeDefined()
    expect(templates['api/chat.ts'].length).toBeGreaterThan(0)
  })

  test('all template paths are valid (no leading slashes)', () => {
    const templates = getTemplates('test')
    for (const path of Object.keys(templates)) {
      expect(path.startsWith('/')).toBe(false)
    }
  })
})
