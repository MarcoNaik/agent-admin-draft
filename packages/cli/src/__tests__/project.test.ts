import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadProject, saveProject, hasProject, type StruereProject } from '../utils/project'

describe('project utilities', () => {
  const testDir = join(import.meta.dir, '.test-project-temp')

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

  describe('hasProject', () => {
    test('returns false when struere.json does not exist', () => {
      expect(hasProject(testDir)).toBe(false)
    })

    test('returns true when struere.json exists', () => {
      writeFileSync(join(testDir, 'struere.json'), '{}')
      expect(hasProject(testDir)).toBe(true)
    })

    test('returns true even for empty struere.json', () => {
      writeFileSync(join(testDir, 'struere.json'), '')
      expect(hasProject(testDir)).toBe(true)
    })
  })

  describe('loadProject', () => {
    test('returns null when struere.json does not exist', () => {
      expect(loadProject(testDir)).toBeNull()
    })

    test('returns null for invalid JSON', () => {
      writeFileSync(join(testDir, 'struere.json'), 'not valid json')
      expect(loadProject(testDir)).toBeNull()
    })

    test('returns null for empty file', () => {
      writeFileSync(join(testDir, 'struere.json'), '')
      expect(loadProject(testDir)).toBeNull()
    })

    test('loads valid project config', () => {
      const project: StruereProject = {
        agentId: 'agt_123',
        team: 'my-team',
        agent: {
          slug: 'my-agent',
          name: 'My Agent'
        }
      }
      writeFileSync(join(testDir, 'struere.json'), JSON.stringify(project))

      const loaded = loadProject(testDir)
      expect(loaded).not.toBeNull()
      expect(loaded?.agentId).toBe('agt_123')
      expect(loaded?.team).toBe('my-team')
      expect(loaded?.agent.slug).toBe('my-agent')
      expect(loaded?.agent.name).toBe('My Agent')
    })

    test('loads project with extra fields preserved', () => {
      const project = {
        agentId: 'agt_456',
        team: 'other-team',
        agent: { slug: 'other', name: 'Other' },
        extraField: 'should be preserved'
      }
      writeFileSync(join(testDir, 'struere.json'), JSON.stringify(project))

      const loaded = loadProject(testDir)
      expect(loaded).not.toBeNull()
      expect(loaded?.agentId).toBe('agt_456')
      expect((loaded as any).extraField).toBe('should be preserved')
    })
  })

  describe('saveProject', () => {
    test('creates struere.json file', () => {
      const project: StruereProject = {
        agentId: 'agt_789',
        team: 'test-team',
        agent: { slug: 'test-agent', name: 'Test Agent' }
      }

      saveProject(testDir, project)

      expect(existsSync(join(testDir, 'struere.json'))).toBe(true)
    })

    test('writes valid JSON', () => {
      const project: StruereProject = {
        agentId: 'agt_abc',
        team: 'abc-team',
        agent: { slug: 'abc-agent', name: 'ABC Agent' }
      }

      saveProject(testDir, project)

      const content = readFileSync(join(testDir, 'struere.json'), 'utf-8')
      const parsed = JSON.parse(content)
      expect(parsed.agentId).toBe('agt_abc')
      expect(parsed.team).toBe('abc-team')
      expect(parsed.agent.slug).toBe('abc-agent')
    })

    test('overwrites existing file', () => {
      const project1: StruereProject = {
        agentId: 'agt_first',
        team: 'first-team',
        agent: { slug: 'first', name: 'First' }
      }
      const project2: StruereProject = {
        agentId: 'agt_second',
        team: 'second-team',
        agent: { slug: 'second', name: 'Second' }
      }

      saveProject(testDir, project1)
      saveProject(testDir, project2)

      const loaded = loadProject(testDir)
      expect(loaded?.agentId).toBe('agt_second')
    })

    test('formats JSON with indentation', () => {
      const project: StruereProject = {
        agentId: 'agt_formatted',
        team: 'formatted-team',
        agent: { slug: 'formatted', name: 'Formatted' }
      }

      saveProject(testDir, project)

      const content = readFileSync(join(testDir, 'struere.json'), 'utf-8')
      expect(content).toContain('\n')
      expect(content).toContain('  ')
    })

    test('ends file with newline', () => {
      const project: StruereProject = {
        agentId: 'agt_newline',
        team: 'newline-team',
        agent: { slug: 'newline', name: 'Newline' }
      }

      saveProject(testDir, project)

      const content = readFileSync(join(testDir, 'struere.json'), 'utf-8')
      expect(content.endsWith('\n')).toBe(true)
    })
  })

  describe('round-trip', () => {
    test('save then load returns same data', () => {
      const project: StruereProject = {
        agentId: 'agt_roundtrip',
        team: 'roundtrip-team',
        agent: { slug: 'roundtrip-agent', name: 'Roundtrip Agent' }
      }

      saveProject(testDir, project)
      const loaded = loadProject(testDir)

      expect(loaded).toEqual(project)
    })

    test('hasProject returns true after save', () => {
      expect(hasProject(testDir)).toBe(false)

      const project: StruereProject = {
        agentId: 'agt_check',
        team: 'check-team',
        agent: { slug: 'check', name: 'Check' }
      }
      saveProject(testDir, project)

      expect(hasProject(testDir)).toBe(true)
    })
  })
})
