import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  writeProjectConfig,
  scaffoldProject,
  scaffoldAgentFiles,
  hasAgentFiles,
  type ScaffoldOptions,
} from '../utils/scaffold'

describe('scaffold utilities', () => {
  const testDir = join(import.meta.dir, '.test-scaffold-temp')

  const defaultOptions: ScaffoldOptions = {
    projectName: 'test-project',
    agentId: 'agt_test123',
    team: 'test-team',
    agentSlug: 'test-project',
    agentName: 'Test Project',
    deploymentUrl: 'https://test-project-dev.struere.dev',
  }

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  describe('hasAgentFiles', () => {
    test('returns false when src/agent.ts does not exist', () => {
      expect(hasAgentFiles(testDir)).toBe(false)
    })

    test('returns false when src exists but agent.ts does not', () => {
      mkdirSync(join(testDir, 'src'), { recursive: true })
      expect(hasAgentFiles(testDir)).toBe(false)
    })

    test('returns true when src/agent.ts exists', () => {
      mkdirSync(join(testDir, 'src'), { recursive: true })
      writeFileSync(join(testDir, 'src', 'agent.ts'), 'export default {}')
      expect(hasAgentFiles(testDir)).toBe(true)
    })

    test('returns true even for empty agent.ts', () => {
      mkdirSync(join(testDir, 'src'), { recursive: true })
      writeFileSync(join(testDir, 'src', 'agent.ts'), '')
      expect(hasAgentFiles(testDir)).toBe(true)
    })
  })

  describe('writeProjectConfig', () => {
    test('creates struere.json', () => {
      writeProjectConfig(testDir, defaultOptions)
      expect(existsSync(join(testDir, 'struere.json'))).toBe(true)
    })

    test('creates .env.local', () => {
      writeProjectConfig(testDir, defaultOptions)
      expect(existsSync(join(testDir, '.env.local'))).toBe(true)
    })

    test('struere.json contains correct agentId', () => {
      writeProjectConfig(testDir, defaultOptions)
      const content = JSON.parse(readFileSync(join(testDir, 'struere.json'), 'utf-8'))
      expect(content.agentId).toBe('agt_test123')
    })

    test('struere.json contains correct team', () => {
      writeProjectConfig(testDir, defaultOptions)
      const content = JSON.parse(readFileSync(join(testDir, 'struere.json'), 'utf-8'))
      expect(content.team).toBe('test-team')
    })

    test('struere.json contains correct agent info', () => {
      writeProjectConfig(testDir, defaultOptions)
      const content = JSON.parse(readFileSync(join(testDir, 'struere.json'), 'utf-8'))
      expect(content.agent.slug).toBe('test-project')
      expect(content.agent.name).toBe('Test Project')
    })

    test('.env.local contains deployment URL', () => {
      writeProjectConfig(testDir, defaultOptions)
      const content = readFileSync(join(testDir, '.env.local'), 'utf-8')
      expect(content).toContain('STRUERE_DEPLOYMENT_URL=https://test-project-dev.struere.dev')
    })

    test('creates or updates .gitignore', () => {
      writeProjectConfig(testDir, defaultOptions)
      expect(existsSync(join(testDir, '.gitignore'))).toBe(true)
    })

    test('returns created files list', () => {
      const result = writeProjectConfig(testDir, defaultOptions)
      expect(result.createdFiles).toContain('struere.json')
      expect(result.createdFiles).toContain('.env.local')
    })

    test('updates existing .gitignore with .env.local', () => {
      writeFileSync(join(testDir, '.gitignore'), 'node_modules/\n')
      const result = writeProjectConfig(testDir, defaultOptions)
      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8')
      expect(content).toContain('.env.local')
      expect(result.updatedFiles).toContain('.gitignore')
    })

    test('does not duplicate .env.local in .gitignore', () => {
      writeFileSync(join(testDir, '.gitignore'), 'node_modules/\n.env.local\n')
      const result = writeProjectConfig(testDir, defaultOptions)
      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8')
      const matches = content.match(/\.env\.local/g)
      expect(matches?.length).toBe(1)
      expect(result.updatedFiles).not.toContain('.gitignore')
    })
  })

  describe('scaffoldAgentFiles', () => {
    test('creates src/agent.ts', () => {
      scaffoldAgentFiles(testDir, 'my-agent')
      expect(existsSync(join(testDir, 'src', 'agent.ts'))).toBe(true)
    })

    test('creates src/context.ts', () => {
      scaffoldAgentFiles(testDir, 'my-agent')
      expect(existsSync(join(testDir, 'src', 'context.ts'))).toBe(true)
    })

    test('creates src/tools.ts', () => {
      scaffoldAgentFiles(testDir, 'my-agent')
      expect(existsSync(join(testDir, 'src', 'tools.ts'))).toBe(true)
    })

    test('creates struere.config.ts', () => {
      scaffoldAgentFiles(testDir, 'my-agent')
      expect(existsSync(join(testDir, 'struere.config.ts'))).toBe(true)
    })

    test('creates package.json', () => {
      scaffoldAgentFiles(testDir, 'my-agent')
      expect(existsSync(join(testDir, 'package.json'))).toBe(true)
    })

    test('creates tsconfig.json', () => {
      scaffoldAgentFiles(testDir, 'my-agent')
      expect(existsSync(join(testDir, 'tsconfig.json'))).toBe(true)
    })

    test('creates api/chat.ts', () => {
      scaffoldAgentFiles(testDir, 'my-agent')
      expect(existsSync(join(testDir, 'api', 'chat.ts'))).toBe(true)
    })

    test('creates tests/basic.test.yaml', () => {
      scaffoldAgentFiles(testDir, 'my-agent')
      expect(existsSync(join(testDir, 'tests', 'basic.test.yaml'))).toBe(true)
    })

    test('creates .env.example', () => {
      scaffoldAgentFiles(testDir, 'my-agent')
      expect(existsSync(join(testDir, '.env.example'))).toBe(true)
    })

    test('does not overwrite existing files', () => {
      writeFileSync(join(testDir, 'package.json'), '{"name": "existing"}')
      scaffoldAgentFiles(testDir, 'my-agent')
      const content = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'))
      expect(content.name).toBe('existing')
    })

    test('creates missing files alongside existing', () => {
      writeFileSync(join(testDir, 'package.json'), '{}')
      scaffoldAgentFiles(testDir, 'my-agent')
      expect(existsSync(join(testDir, 'tsconfig.json'))).toBe(true)
    })

    test('returns list of created files', () => {
      const result = scaffoldAgentFiles(testDir, 'my-agent')
      expect(result.createdFiles.length).toBeGreaterThan(0)
      expect(result.createdFiles).toContain('src/agent.ts')
    })

    test('agent.ts contains correct project name', () => {
      scaffoldAgentFiles(testDir, 'cool-agent')
      const content = readFileSync(join(testDir, 'src', 'agent.ts'), 'utf-8')
      expect(content).toContain("name: 'cool-agent'")
    })

    test('package.json contains correct project name', () => {
      scaffoldAgentFiles(testDir, 'cool-agent')
      const content = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'))
      expect(content.name).toBe('cool-agent')
    })
  })

  describe('scaffoldProject', () => {
    test('creates all necessary files', () => {
      scaffoldProject(testDir, defaultOptions)

      expect(existsSync(join(testDir, 'struere.json'))).toBe(true)
      expect(existsSync(join(testDir, '.env.local'))).toBe(true)
      expect(existsSync(join(testDir, 'src', 'agent.ts'))).toBe(true)
      expect(existsSync(join(testDir, 'package.json'))).toBe(true)
      expect(existsSync(join(testDir, 'struere.config.ts'))).toBe(true)
    })

    test('struere.json has correct structure', () => {
      scaffoldProject(testDir, defaultOptions)
      const content = JSON.parse(readFileSync(join(testDir, 'struere.json'), 'utf-8'))
      expect(content.agentId).toBe(defaultOptions.agentId)
      expect(content.team).toBe(defaultOptions.team)
      expect(content.agent.slug).toBe(defaultOptions.agentSlug)
      expect(content.agent.name).toBe(defaultOptions.agentName)
    })

    test('does not overwrite existing files', () => {
      mkdirSync(join(testDir, 'src'), { recursive: true })
      writeFileSync(join(testDir, 'src', 'agent.ts'), 'existing content')

      scaffoldProject(testDir, defaultOptions)

      const content = readFileSync(join(testDir, 'src', 'agent.ts'), 'utf-8')
      expect(content).toBe('existing content')
    })

    test('returns created files list', () => {
      const result = scaffoldProject(testDir, defaultOptions)
      expect(result.createdFiles).toContain('struere.json')
      expect(result.createdFiles).toContain('.env.local')
      expect(result.createdFiles).toContain('src/agent.ts')
    })

    test('excludes existing files from created list', () => {
      mkdirSync(join(testDir, 'src'), { recursive: true })
      writeFileSync(join(testDir, 'src', 'agent.ts'), 'existing')

      const result = scaffoldProject(testDir, defaultOptions)
      expect(result.createdFiles).not.toContain('src/agent.ts')
    })
  })

  describe('directory creation', () => {
    test('creates nested directories as needed', () => {
      scaffoldAgentFiles(testDir, 'test')

      expect(existsSync(join(testDir, 'src'))).toBe(true)
      expect(existsSync(join(testDir, 'api'))).toBe(true)
      expect(existsSync(join(testDir, 'tests'))).toBe(true)
      expect(existsSync(join(testDir, 'src', 'workflows'))).toBe(true)
    })

    test('handles already existing directories', () => {
      mkdirSync(join(testDir, 'src'), { recursive: true })

      expect(() => scaffoldAgentFiles(testDir, 'test')).not.toThrow()
      expect(existsSync(join(testDir, 'src', 'agent.ts'))).toBe(true)
    })
  })

  describe('file content validation', () => {
    test('struere.config.ts has valid TypeScript syntax', () => {
      scaffoldAgentFiles(testDir, 'test')
      const content = readFileSync(join(testDir, 'struere.config.ts'), 'utf-8')
      expect(content).toContain('import')
      expect(content).toContain('export default')
    })

    test('agent.ts has valid TypeScript syntax', () => {
      scaffoldAgentFiles(testDir, 'test')
      const content = readFileSync(join(testDir, 'src', 'agent.ts'), 'utf-8')
      expect(content).toContain('import')
      expect(content).toContain('export default')
    })

    test('.gitignore includes all necessary entries', () => {
      scaffoldProject(testDir, defaultOptions)
      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8')
      expect(content).toContain('node_modules/')
      expect(content).toContain('.env.local')
      expect(content).toContain('dist/')
    })
  })
})
