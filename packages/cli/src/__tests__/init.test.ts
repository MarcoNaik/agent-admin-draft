import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import { hasProject, loadProject } from '../utils/project'
import { hasAgentFiles } from '../utils/scaffold'
import { slugify, deriveProjectName } from '../commands/init'

describe('init command', () => {
  const testDir = join(import.meta.dir, '.test-init-temp')

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

  describe('slugify', () => {
    test('converts uppercase to lowercase', () => {
      expect(slugify('MyAgent')).toBe('myagent')
    })

    test('replaces spaces with hyphens', () => {
      expect(slugify('my agent')).toBe('my-agent')
    })

    test('replaces underscores with hyphens', () => {
      expect(slugify('my_agent')).toBe('my-agent')
    })

    test('removes special characters', () => {
      expect(slugify('my@agent!')).toBe('my-agent')
    })

    test('removes leading and trailing hyphens', () => {
      expect(slugify('-my-agent-')).toBe('my-agent')
    })

    test('collapses multiple hyphens', () => {
      expect(slugify('my---agent')).toBe('my-agent')
    })

    test('handles empty string', () => {
      expect(slugify('')).toBe('')
    })

    test('handles numbers', () => {
      expect(slugify('agent123')).toBe('agent123')
    })

    test('handles mixed content', () => {
      expect(slugify('My COOL Agent v2!')).toBe('my-cool-agent-v2')
    })

    test('handles scoped npm package names', () => {
      expect(slugify('@company/my-agent')).toBe('company-my-agent')
    })

    test('handles single character', () => {
      expect(slugify('a')).toBe('a')
    })

    test('handles only special characters', () => {
      expect(slugify('!@#$%')).toBe('')
    })

    test('handles unicode characters', () => {
      expect(slugify('café-app')).toBe('caf-app')
    })

    test('handles multiple spaces', () => {
      expect(slugify('my    agent')).toBe('my-agent')
    })

    test('handles tabs and newlines', () => {
      expect(slugify('my\tagent\nhere')).toBe('my-agent-here')
    })
  })

  describe('deriveProjectName', () => {
    test('derives name from package.json if exists', async () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'my-cool-project' })
      )
      const name = await deriveProjectName(testDir)
      expect(name).toBe('my-cool-project')
    })

    test('slugifies package.json name', async () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'My Cool Project' })
      )
      const name = await deriveProjectName(testDir)
      expect(name).toBe('my-cool-project')
    })

    test('handles scoped package names', async () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ name: '@company/my-agent' })
      )
      const name = await deriveProjectName(testDir)
      expect(name).toBe('company-my-agent')
    })

    test('falls back to directory name if no package.json', async () => {
      const name = await deriveProjectName(testDir)
      expect(name).toBe(slugify(basename(testDir)))
    })

    test('falls back to directory name if package.json has no name', async () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ version: '1.0.0' })
      )
      const name = await deriveProjectName(testDir)
      expect(name).toBe(slugify(basename(testDir)))
    })

    test('falls back to directory name if package.json name is empty', async () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ name: '' })
      )
      const name = await deriveProjectName(testDir)
      expect(name).toBe(slugify(basename(testDir)))
    })

    test('falls back to directory name if package.json name is not a string', async () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 123 })
      )
      const name = await deriveProjectName(testDir)
      expect(name).toBe(slugify(basename(testDir)))
    })

    test('handles invalid JSON in package.json', async () => {
      writeFileSync(join(testDir, 'package.json'), 'not valid json {{{')
      const name = await deriveProjectName(testDir)
      expect(name).toBe(slugify(basename(testDir)))
    })

    test('handles empty package.json', async () => {
      writeFileSync(join(testDir, 'package.json'), '')
      const name = await deriveProjectName(testDir)
      expect(name).toBe(slugify(basename(testDir)))
    })
  })

  describe('project detection', () => {
    test('detects when project is not initialized', () => {
      expect(hasProject(testDir)).toBe(false)
    })

    test('detects when project is already initialized', () => {
      writeFileSync(
        join(testDir, 'struere.json'),
        JSON.stringify({
          agentId: 'agt_existing',
          team: 'existing-team',
          agent: { slug: 'existing', name: 'Existing' },
        })
      )
      expect(hasProject(testDir)).toBe(true)
    })

    test('loads existing project configuration with all fields', () => {
      const existingProject = {
        agentId: 'agt_loaded',
        team: 'loaded-team',
        agent: { slug: 'loaded-agent', name: 'Loaded Agent' },
      }
      writeFileSync(join(testDir, 'struere.json'), JSON.stringify(existingProject))

      const project = loadProject(testDir)
      expect(project?.agentId).toBe('agt_loaded')
      expect(project?.team).toBe('loaded-team')
      expect(project?.agent.slug).toBe('loaded-agent')
      expect(project?.agent.name).toBe('Loaded Agent')
    })
  })

  describe('agent files detection', () => {
    test('detects when agent files do not exist', () => {
      expect(hasAgentFiles(testDir)).toBe(false)
    })

    test('detects when src directory exists but agent.ts does not', () => {
      mkdirSync(join(testDir, 'src'), { recursive: true })
      expect(hasAgentFiles(testDir)).toBe(false)
    })

    test('detects when agent files exist', () => {
      mkdirSync(join(testDir, 'src'), { recursive: true })
      writeFileSync(join(testDir, 'src', 'agent.ts'), 'export default {}')
      expect(hasAgentFiles(testDir)).toBe(true)
    })
  })

  describe('initialization scenarios', () => {
    test('fresh directory has no struere.json', () => {
      expect(existsSync(join(testDir, 'struere.json'))).toBe(false)
      expect(hasProject(testDir)).toBe(false)
    })

    test('fresh directory has no src/agent.ts', () => {
      expect(existsSync(join(testDir, 'src', 'agent.ts'))).toBe(false)
      expect(hasAgentFiles(testDir)).toBe(false)
    })

    test('existing codebase has src/agent.ts but no struere.json', () => {
      mkdirSync(join(testDir, 'src'), { recursive: true })
      writeFileSync(join(testDir, 'src', 'agent.ts'), 'export default {}')

      expect(hasProject(testDir)).toBe(false)
      expect(hasAgentFiles(testDir)).toBe(true)
    })
  })

  describe('error handling', () => {
    test('loadProject returns null for corrupted JSON', () => {
      writeFileSync(join(testDir, 'struere.json'), 'not valid json {{{')
      expect(loadProject(testDir)).toBeNull()
    })

    test('loadProject returns null for empty file', () => {
      writeFileSync(join(testDir, 'struere.json'), '')
      expect(loadProject(testDir)).toBeNull()
    })

    test('hasProject returns true even for invalid struere.json content', () => {
      writeFileSync(join(testDir, 'struere.json'), 'invalid')
      expect(hasProject(testDir)).toBe(true)
    })
  })

  describe('struere.json structure validation', () => {
    test('requires agentId field', () => {
      const validProject = {
        agentId: 'agt_valid',
        team: 'valid-team',
        agent: { slug: 'valid-slug', name: 'Valid Name' },
      }
      writeFileSync(join(testDir, 'struere.json'), JSON.stringify(validProject))

      const loaded = loadProject(testDir)
      expect(loaded).not.toBeNull()
      expect(typeof loaded?.agentId).toBe('string')
      expect(loaded?.agentId.length).toBeGreaterThan(0)
    })

    test('requires team field', () => {
      const validProject = {
        agentId: 'agt_test',
        team: 'test-team',
        agent: { slug: 'test', name: 'Test' },
      }
      writeFileSync(join(testDir, 'struere.json'), JSON.stringify(validProject))

      const loaded = loadProject(testDir)
      expect(typeof loaded?.team).toBe('string')
      expect(loaded?.team.length).toBeGreaterThan(0)
    })

    test('requires agent object with slug and name', () => {
      const validProject = {
        agentId: 'agt_complete',
        team: 'complete-team',
        agent: { slug: 'complete-slug', name: 'Complete Name' },
      }
      writeFileSync(join(testDir, 'struere.json'), JSON.stringify(validProject))

      const loaded = loadProject(testDir)
      expect(typeof loaded?.agent).toBe('object')
      expect(typeof loaded?.agent.slug).toBe('string')
      expect(typeof loaded?.agent.name).toBe('string')
    })
  })
})
