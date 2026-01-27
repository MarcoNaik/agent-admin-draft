import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { hasProject, loadProject, saveProject, type StruereProject } from '../utils/project'
import { isLoggedIn, loadCredentials } from '../utils/credentials'
import { loadConfig } from '../utils/config'

describe('command requirements', () => {
  const testDir = join(import.meta.dir, '.test-commands-temp')

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

  describe('dev command requirements', () => {
    test('dev requires struere.json to exist', () => {
      const canRunDev = hasProject(testDir)
      expect(canRunDev).toBe(false)
    })

    test('dev can proceed when struere.json exists', () => {
      const project: StruereProject = {
        agentId: 'agt_dev_test',
        team: 'dev-team',
        agent: { slug: 'dev-agent', name: 'Dev Agent' },
      }
      saveProject(testDir, project)

      expect(hasProject(testDir)).toBe(true)
      const loaded = loadProject(testDir)
      expect(loaded?.agentId).toBe('agt_dev_test')
    })

    test('dev needs agentId for cloud sync', () => {
      const project: StruereProject = {
        agentId: 'agt_cloud_sync',
        team: 'sync-team',
        agent: { slug: 'sync-agent', name: 'Sync Agent' },
      }
      saveProject(testDir, project)

      const loaded = loadProject(testDir)
      expect(loaded?.agentId).toBeDefined()
      expect(loaded?.agentId.startsWith('agt_')).toBe(true)
    })

    test('dev needs agent slug for sync message', () => {
      const project: StruereProject = {
        agentId: 'agt_slug_test',
        team: 'slug-team',
        agent: { slug: 'my-specific-slug', name: 'Slug Test' },
      }
      saveProject(testDir, project)

      const loaded = loadProject(testDir)
      expect(loaded?.agent.slug).toBe('my-specific-slug')
    })
  })

  describe('deploy command requirements', () => {
    test('deploy requires struere.json to exist', () => {
      const canRunDeploy = hasProject(testDir)
      expect(canRunDeploy).toBe(false)
    })

    test('deploy can proceed when struere.json exists', () => {
      const project: StruereProject = {
        agentId: 'agt_deploy_test',
        team: 'deploy-team',
        agent: { slug: 'deploy-agent', name: 'Deploy Agent' },
      }
      saveProject(testDir, project)

      expect(hasProject(testDir)).toBe(true)
    })

    test('deploy uses agentId from struere.json', () => {
      const project: StruereProject = {
        agentId: 'agt_specific_id_12345',
        team: 'team',
        agent: { slug: 'agent', name: 'Agent' },
      }
      saveProject(testDir, project)

      const loaded = loadProject(testDir)
      expect(loaded?.agentId).toBe('agt_specific_id_12345')
    })
  })

  describe('init command scenarios', () => {
    test('init creates struere.json when not present', () => {
      expect(hasProject(testDir)).toBe(false)

      const project: StruereProject = {
        agentId: 'agt_new',
        team: 'new-team',
        agent: { slug: 'new-agent', name: 'New Agent' },
      }
      saveProject(testDir, project)

      expect(hasProject(testDir)).toBe(true)
      expect(existsSync(join(testDir, 'struere.json'))).toBe(true)
    })

    test('init can relink existing project', () => {
      const original: StruereProject = {
        agentId: 'agt_original',
        team: 'original-team',
        agent: { slug: 'original', name: 'Original' },
      }
      saveProject(testDir, original)

      const newProject: StruereProject = {
        agentId: 'agt_relinked',
        team: 'relinked-team',
        agent: { slug: 'relinked', name: 'Relinked' },
      }
      saveProject(testDir, newProject)

      const loaded = loadProject(testDir)
      expect(loaded?.agentId).toBe('agt_relinked')
      expect(loaded?.agentId).not.toBe('agt_original')
    })
  })

  describe('config file loading', () => {
    test('loadConfig returns defaults when no config file exists', async () => {
      const config = await loadConfig(testDir)
      expect(config.port).toBe(3000)
      expect(config.host).toBe('localhost')
    })

    test('config defaults include cors settings', async () => {
      const config = await loadConfig(testDir)
      expect(config.cors).toBeDefined()
      expect(config.cors.credentials).toBe(true)
    })

    test('config defaults include logging settings', async () => {
      const config = await loadConfig(testDir)
      expect(config.logging).toBeDefined()
      expect(config.logging.level).toBe('info')
      expect(config.logging.format).toBe('pretty')
    })

    test('config defaults include auth settings', async () => {
      const config = await loadConfig(testDir)
      expect(config.auth).toBeDefined()
      expect(config.auth.type).toBe('none')
    })
  })

  describe('authentication state', () => {
    test('isLoggedIn returns false when no credentials file exists', () => {
      const loggedIn = isLoggedIn()
      expect(typeof loggedIn).toBe('boolean')
    })

    test('loadCredentials returns null when not logged in', () => {
      const credentials = loadCredentials()
      expect(credentials === null || typeof credentials === 'object').toBe(true)
    })
  })

  describe('project state transitions', () => {
    test('state transition: no-project -> after save -> has-project', () => {
      expect(hasProject(testDir)).toBe(false)

      saveProject(testDir, {
        agentId: 'agt_state',
        team: 'state-team',
        agent: { slug: 'state', name: 'State' },
      })

      expect(hasProject(testDir)).toBe(true)
    })

    test('project file contains all required fields after save', () => {
      saveProject(testDir, {
        agentId: 'agt_full',
        team: 'full-team',
        agent: { slug: 'full-agent', name: 'Full Agent' },
      })

      const content = JSON.parse(readFileSync(join(testDir, 'struere.json'), 'utf-8'))
      expect(content.agentId).toBeDefined()
      expect(content.team).toBeDefined()
      expect(content.agent).toBeDefined()
      expect(content.agent.slug).toBeDefined()
      expect(content.agent.name).toBeDefined()
    })
  })

  describe('workflow preconditions', () => {
    test('workflow: project must exist before dev', () => {
      const preconditionMet = hasProject(testDir)
      expect(preconditionMet).toBe(false)

      saveProject(testDir, {
        agentId: 'agt_workflow',
        team: 'workflow-team',
        agent: { slug: 'workflow-agent', name: 'Workflow Agent' },
      })

      const afterInit = hasProject(testDir)
      expect(afterInit).toBe(true)
    })

    test('workflow: project must exist before deploy', () => {
      expect(hasProject(testDir)).toBe(false)

      saveProject(testDir, {
        agentId: 'agt_deploy_flow',
        team: 'deploy-team',
        agent: { slug: 'deploy', name: 'Deploy' },
      })

      expect(hasProject(testDir)).toBe(true)
      const project = loadProject(testDir)
      expect(project?.agentId).toBe('agt_deploy_flow')
    })

    test('workflow: agentId persists across sessions', () => {
      const originalAgentId = 'agt_persistent_123'

      saveProject(testDir, {
        agentId: originalAgentId,
        team: 'persistent-team',
        agent: { slug: 'persistent', name: 'Persistent' },
      })

      const firstLoad = loadProject(testDir)
      expect(firstLoad?.agentId).toBe(originalAgentId)

      const secondLoad = loadProject(testDir)
      expect(secondLoad?.agentId).toBe(originalAgentId)
    })
  })

  describe('error scenarios', () => {
    test('dev gracefully fails without struere.json', () => {
      const canRunDev = hasProject(testDir)
      expect(canRunDev).toBe(false)
    })

    test('deploy gracefully fails without struere.json', () => {
      const canRunDeploy = hasProject(testDir)
      expect(canRunDeploy).toBe(false)
    })

    test('loadProject handles corrupted file', () => {
      writeFileSync(join(testDir, 'struere.json'), '{ invalid json }}}')
      const project = loadProject(testDir)
      expect(project).toBeNull()
    })
  })
})
