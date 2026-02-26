import { Command } from 'commander'
import chalk from 'chalk'
import { confirm } from '@inquirer/prompts'
import { loadCredentials, getApiKey, clearCredentials } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { syncOrganization, getSyncState, type SyncResult, type SyncOptions } from '../utils/convex'
import { loadAllResources, type LoadedResources } from '../utils/loader'
import { extractSyncPayload } from '../utils/extractor'
import { isInteractive, createOutput, isAuthError } from '../utils/runtime'
import { performLogin } from './login'

type Environment = SyncOptions['environment']

export interface DeletionWarning {
  type: string
  remote: number
  local: number
  deleted: string[]
}

export async function performDevSync(cwd: string, organizationId: string): Promise<SyncResult> {
  const resources = await loadAllResources(cwd)
  if (resources.errors.length > 0) {
    throw new Error(`${resources.errors.length} resource loading error(s):\n${resources.errors.join('\n')}`)
  }
  const payload = extractSyncPayload(resources)

  const devResult = await syncOrganization({
    agents: payload.agents,
    entityTypes: payload.entityTypes,
    roles: payload.roles,
    triggers: payload.triggers,
    organizationId,
    environment: 'development',
  })
  if (!devResult.success) {
    throw new Error(devResult.error || 'Dev sync failed')
  }

  const hasEvalContent = (payload.evalSuites && payload.evalSuites.length > 0) ||
    (payload.fixtures && payload.fixtures.length > 0)

  if (hasEvalContent) {
    const evalResult = await syncOrganization({
      agents: payload.agents,
      entityTypes: payload.entityTypes,
      roles: payload.roles,
      evalSuites: payload.evalSuites,
      fixtures: payload.fixtures,
      organizationId,
      environment: 'eval',
    })
    if (!evalResult.success) {
      throw new Error(evalResult.error || 'Eval sync failed')
    }
  }

  return devResult
}

export async function checkForDeletions(
  resources: LoadedResources,
  organizationId: string | undefined,
  environment: Environment,
): Promise<DeletionWarning[]> {
  const { state: remoteState } = await getSyncState(organizationId, environment)
  if (!remoteState) return []

  const payload = extractSyncPayload(resources)
  const localSlugs = {
    agents: new Set(payload.agents.map((a) => a.slug)),
    entityTypes: new Set(payload.entityTypes.map((et) => et.slug)),
    roles: new Set(payload.roles.map((r) => r.name)),
    evalSuites: new Set((payload.evalSuites || []).map((es) => es.slug)),
    triggers: new Set((payload.triggers || []).map((t) => t.slug)),
  }

  const deletions: DeletionWarning[] = []

  const deletedAgents = remoteState.agents.filter((a) => !localSlugs.agents.has(a.slug)).map((a) => a.name)
  if (deletedAgents.length > 0) deletions.push({ type: 'Agents', remote: remoteState.agents.length, local: payload.agents.length, deleted: deletedAgents })

  const deletedEntityTypes = remoteState.entityTypes.filter((et) => !localSlugs.entityTypes.has(et.slug)).map((et) => et.name)
  if (deletedEntityTypes.length > 0) deletions.push({ type: 'Entity types', remote: remoteState.entityTypes.length, local: payload.entityTypes.length, deleted: deletedEntityTypes })

  const deletedRoles = remoteState.roles.filter((r) => !localSlugs.roles.has(r.name)).map((r) => r.name)
  if (deletedRoles.length > 0) deletions.push({ type: 'Roles', remote: remoteState.roles.length, local: payload.roles.length, deleted: deletedRoles })

  const remoteEvalSuites = remoteState.evalSuites || []
  const deletedEvalSuites = remoteEvalSuites.filter((es) => !localSlugs.evalSuites.has(es.slug)).map((es) => es.name)
  if (deletedEvalSuites.length > 0) deletions.push({ type: 'Eval suites', remote: remoteEvalSuites.length, local: (payload.evalSuites || []).length, deleted: deletedEvalSuites })

  const remoteTriggers = remoteState.triggers || []
  const deletedTriggers = remoteTriggers.filter((t) => !localSlugs.triggers.has(t.slug)).map((t) => t.name)
  if (deletedTriggers.length > 0) deletions.push({ type: 'Triggers', remote: remoteTriggers.length, local: (payload.triggers || []).length, deleted: deletedTriggers })

  return deletions
}

async function syncToEnvironment(
  cwd: string,
  organizationId: string,
  environment: Environment,
): Promise<SyncResult> {
  const resources = await loadAllResources(cwd)
  if (resources.errors.length > 0) {
    throw new Error(`${resources.errors.length} resource loading error(s):\n${resources.errors.join('\n')}`)
  }
  const payload = extractSyncPayload(resources)

  if (environment === 'eval') {
    const result = await syncOrganization({
      agents: payload.agents,
      entityTypes: payload.entityTypes,
      roles: payload.roles,
      evalSuites: payload.evalSuites,
      fixtures: payload.fixtures,
      organizationId,
      environment: 'eval',
    })
    if (!result.success) throw new Error(result.error || 'Eval sync failed')
    return result
  }

  if (environment === 'production') {
    const result = await syncOrganization({
      ...payload,
      organizationId,
      environment: 'production',
    })
    if (!result.success) throw new Error(result.error || 'Production sync failed')
    return result
  }

  return performDevSync(cwd, organizationId)
}

export const syncCommand = new Command('sync')
  .description('Sync resources to Convex and exit')
  .option('--force', 'Skip destructive sync confirmation')
  .option('--json', 'Output results as JSON')
  .option('--dry-run', 'Show what would be synced without syncing')
  .option('--env <environment>', 'Target environment (development|production|eval)')
  .action(async (options: { force?: boolean; json?: boolean; dryRun?: boolean; env?: string }) => {
    const cwd = process.cwd()
    const jsonMode = !!options.json
    const output = createOutput()
    const interactive = isInteractive()
    const shouldForce = options.force || !interactive
    const environment = (options.env || 'development') as Environment
    const syncEval = !options.env || options.env === 'development'

    if (!hasProject(cwd)) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error: 'No struere.json found' }))
      } else {
        output.fail('No struere.json found. Run struere init first.')
      }
      process.exit(1)
    }

    const project = loadProject(cwd)
    if (!project) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error: 'Failed to load struere.json' }))
      } else {
        output.fail('Failed to load struere.json')
      }
      process.exit(1)
    }

    const credentials = loadCredentials()
    const apiKey = getApiKey()
    if (!credentials && !apiKey) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error: 'Not authenticated. Set STRUERE_API_KEY or run struere login.' }))
      } else {
        output.fail('Not authenticated. Set STRUERE_API_KEY or run struere login.')
      }
      process.exit(1)
    }

    if (!jsonMode) {
      output.info(`Organization: ${project.organization.name}`)
      output.info(`Environment: ${environment}${syncEval && environment === 'development' ? ' + eval' : ''}`)
      console.log()
    }

    if (!jsonMode) output.start('Loading resources')
    let resources: LoadedResources
    try {
      resources = await loadAllResources(cwd)
      if (resources.errors.length > 0) {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error: `${resources.errors.length} resource loading error(s)`, errors: resources.errors }))
        } else {
          output.fail('Failed to load resources')
          for (const err of resources.errors) {
            output.error(`  ${err}`)
          }
        }
        process.exit(1)
      }
      if (!jsonMode && !options.dryRun) output.succeed(`Loaded ${resources.agents.length} agents, ${resources.entityTypes.length} entity types, ${resources.roles.length} roles`)
    } catch (error) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }))
      } else {
        output.fail('Failed to load resources')
        output.error(error instanceof Error ? error.message : String(error))
      }
      process.exit(1)
    }

    if (options.dryRun) {
      const payload = extractSyncPayload(resources)
      if (!jsonMode) output.stop()
      let deletions: DeletionWarning[] = []
      try {
        deletions = await checkForDeletions(resources, project.organization.id, environment)
      } catch {}

      if (jsonMode) {
        console.log(JSON.stringify({
          dryRun: true,
          environment,
          agents: payload.agents.map((a) => a.slug),
          entityTypes: payload.entityTypes.map((et) => et.slug),
          roles: payload.roles.map((r) => r.name),
          triggers: (payload.triggers || []).map((t) => t.slug),
          deletions: deletions.map((d) => ({ type: d.type, names: d.deleted })),
        }))
      } else {
        console.log(chalk.bold('Dry run — nothing will be synced'))
        console.log()
        console.log(chalk.gray('  Agents:'), payload.agents.map((a) => a.slug).join(', ') || 'none')
        console.log(chalk.gray('  Entity types:'), payload.entityTypes.map((et) => et.slug).join(', ') || 'none')
        console.log(chalk.gray('  Roles:'), payload.roles.map((r) => r.name).join(', ') || 'none')
        console.log(chalk.gray('  Triggers:'), (payload.triggers || []).map((t) => t.slug).join(', ') || 'none')
        if (deletions.length > 0) {
          console.log()
          console.log(chalk.yellow.bold('  Would delete:'))
          for (const d of deletions) {
            for (const name of d.deleted) {
              console.log(chalk.red(`    - ${d.type}: ${name}`))
            }
          }
        }
        console.log()
      }
      return
    }

    if (!shouldForce) {
      if (!jsonMode) output.start('Checking remote state')
      try {
        const deletions = await checkForDeletions(resources, project.organization.id, environment)
        if (!jsonMode) output.stop()

        if (deletions.length > 0) {
          console.log(chalk.yellow.bold('  Warning: this sync will DELETE remote resources:'))
          console.log()
          for (const d of deletions) {
            console.log(chalk.yellow(`    ${d.type}:`.padEnd(20)), `${d.remote} remote → ${d.local} local`, chalk.red(`(${d.deleted.length} will be deleted)`))
            for (const name of d.deleted) {
              console.log(chalk.red(`      - ${name}`))
            }
          }
          console.log()
          console.log(chalk.gray('  Run'), chalk.cyan('struere pull'), chalk.gray('first to download remote resources.'))
          console.log()

          const shouldContinue = await confirm({ message: 'Continue anyway?', default: false })
          if (!shouldContinue) {
            console.log(chalk.gray('Aborted.'))
            process.exit(0)
          }
          console.log()
        }
      } catch {
        if (!jsonMode) output.stop()
      }
    }

    if (!jsonMode) output.start('Syncing to Convex')
    try {
      const result = await syncToEnvironment(cwd, project.organization.id, environment)
      if (!jsonMode) output.succeed(`Synced to ${environment}`)

      if (jsonMode) {
        console.log(JSON.stringify({
          success: true,
          environment,
          agents: {
            created: result.agents?.created || [],
            updated: result.agents?.updated || [],
            deleted: result.agents?.deleted || [],
          },
          entityTypes: {
            created: result.entityTypes?.created || [],
            updated: result.entityTypes?.updated || [],
            deleted: result.entityTypes?.deleted || [],
          },
          roles: {
            created: result.roles?.created || [],
            updated: result.roles?.updated || [],
            deleted: result.roles?.deleted || [],
          },
        }))
      }
    } catch (error) {
      if (isAuthError(error) && interactive && !jsonMode) {
        output.fail('Session expired - re-authenticating...')
        clearCredentials()
        const newCredentials = await performLogin()
        if (!newCredentials) {
          output.error('Authentication failed')
          process.exit(1)
        }
        output.start('Syncing to Convex')
        try {
          const result = await syncToEnvironment(cwd, project.organization.id, environment)
          output.succeed(`Synced to ${environment}`)
        } catch (retryError) {
          output.fail('Sync failed')
          output.error(retryError instanceof Error ? retryError.message : String(retryError))
          process.exit(1)
        }
      } else {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }))
        } else {
          output.fail('Sync failed')
          output.error(error instanceof Error ? error.message : String(error))
        }
        process.exit(1)
      }
    }
  })
