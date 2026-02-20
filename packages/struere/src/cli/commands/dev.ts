import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import chokidar from 'chokidar'
import { join } from 'path'
import { existsSync } from 'fs'
import { confirm } from '@inquirer/prompts'
import { loadCredentials, getApiKey, clearCredentials } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { performLogin } from './login'
import { syncOrganization, getSyncState } from '../utils/convex'
import { loadAllResources, getResourceDirectories } from '../utils/loader'
import { extractSyncPayload } from '../utils/extractor'
import { generateDocs } from './docs'
import { runInit } from './init'
import { generateTypeDeclarations } from '../utils/plugin'

export const devCommand = new Command('dev')
  .description('Sync all resources to development environment')
  .option('--force', 'Skip destructive sync confirmation')
  .action(async (options) => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Struere Dev'))
    console.log()

    if (!hasProject(cwd)) {
      console.log(chalk.yellow('No struere.json found - initializing project...'))
      console.log()
      await runInit(cwd)
      console.log()
    }

    const project = loadProject(cwd)
    if (!project) {
      console.log(chalk.red('Failed to load struere.json'))
      process.exit(1)
    }

    generateTypeDeclarations(cwd)

    console.log(chalk.gray('Organization:'), chalk.cyan(project.organization.name))
    console.log(chalk.gray('Environment:'), chalk.cyan('development'), '+', chalk.cyan('eval'))
    console.log()

    let credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      console.log(chalk.yellow('Not logged in - authenticating...'))
      console.log()
      credentials = await performLogin()
      if (!credentials) {
        console.log(chalk.red('Authentication failed'))
        process.exit(1)
      }
      console.log()
    }

    const claudeMdPath = join(cwd, 'CLAUDE.md')
    if (!existsSync(claudeMdPath)) {
      try {
        const { generated } = await generateDocs(cwd, ['claude'])
        if (generated.length > 0) {
          console.log(chalk.green('✓'), 'Created CLAUDE.md')
        }
      } catch {
        console.log(chalk.yellow('⚠'), 'Could not fetch docs for CLAUDE.md')
      }
    }

    const isAuthError = (error: unknown): boolean => {
      const message = error instanceof Error ? error.message : String(error)
      return message.includes('Unauthenticated') ||
             message.includes('OIDC') ||
             message.includes('token') ||
             message.includes('expired')
    }

    const isOrgAccessError = (error: unknown): boolean => {
      const message = error instanceof Error ? error.message : String(error)
      return message.includes('Access denied') ||
             message.includes('not a member') ||
             message.includes('Organization not found')
    }

    const performSync = async (): Promise<boolean> => {
      const resources = await loadAllResources(cwd)
      if (resources.errors.length > 0) {
        throw new Error(resources.errors.join('\n'))
      }
      const payload = extractSyncPayload(resources)

      const devResult = await syncOrganization({
        agents: payload.agents,
        entityTypes: payload.entityTypes,
        roles: payload.roles,
        triggers: payload.triggers,
        organizationId: project.organization.id,
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
          organizationId: project.organization.id,
          environment: 'eval',
        })
        if (!evalResult.success) {
          throw new Error(evalResult.error || 'Eval sync failed')
        }
      }

      return true
    }

    let initialSyncOk = false
    let loadedResources: Awaited<ReturnType<typeof loadAllResources>> | null = null

    spinner.start('Loading resources')

    try {
      loadedResources = await loadAllResources(cwd)
      spinner.succeed(`Loaded ${loadedResources.agents.length} agents, ${loadedResources.entityTypes.length} entity types, ${loadedResources.roles.length} roles, ${loadedResources.customTools.length} custom tools, ${loadedResources.evalSuites.length} eval suites, ${loadedResources.triggers.length} triggers, ${loadedResources.fixtures.length} fixtures`)

      for (const err of loadedResources.errors) {
        console.log(chalk.red('  ✖'), err)
      }

      if (loadedResources.errors.length === 0) {
        initialSyncOk = true
      }
    } catch (error) {
      spinner.fail('Failed to load resources')
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
    }

    if (initialSyncOk && !options.force && loadedResources) {
      spinner.start('Checking remote state')
      try {
        const { state: remoteState } = await getSyncState(project.organization.id, 'development')
        spinner.stop()

        if (remoteState) {
          const payload = extractSyncPayload(loadedResources)
          const localSlugs = {
            agents: new Set(payload.agents.map((a) => a.slug)),
            entityTypes: new Set(payload.entityTypes.map((et) => et.slug)),
            roles: new Set(payload.roles.map((r) => r.name)),
            evalSuites: new Set((payload.evalSuites || []).map((es) => es.slug)),
            triggers: new Set((payload.triggers || []).map((t) => t.slug)),
          }

          const deletions: Array<{ type: string; remote: number; local: number; deleted: string[] }> = []

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
              console.log()
              console.log(chalk.gray('Aborted.'))
              process.exit(0)
            }
            console.log()
          }
        }
      } catch {
        spinner.stop()
      }
    }

    if (initialSyncOk) {
      spinner.start('Syncing to Convex')

      try {
        await performSync()
        spinner.succeed('Synced to development')
      } catch (error) {
        if (isAuthError(error)) {
          spinner.fail('Session expired - re-authenticating...')
          clearCredentials()
          credentials = await performLogin()
          if (!credentials) {
            console.log(chalk.red('Authentication failed'))
            process.exit(1)
          }
          spinner.start('Syncing to Convex')
          try {
            await performSync()
            spinner.succeed('Synced to development')
          } catch (retryError) {
            spinner.fail('Sync failed')
            console.log(chalk.red('Error:'), retryError instanceof Error ? retryError.message : String(retryError))
          }
        } else if (isOrgAccessError(error)) {
          spinner.fail('Organization access denied')
          console.log()
          console.log(chalk.red('You do not have access to organization:'), chalk.cyan(project.organization.name))
          console.log()
          console.log(chalk.gray('To fix this:'))
          console.log(chalk.gray('  1.'), 'Check that you have access to this organization')
          console.log(chalk.gray('  2.'), 'Or run', chalk.cyan('struere init'), 'to select a different organization')
          console.log()
          process.exit(1)
        } else {
          spinner.fail('Sync failed')
          console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
        }
      }
    }

    console.log()
    console.log(chalk.gray('Watching for changes... Press Ctrl+C to stop'))
    console.log()

    const dirs = getResourceDirectories(cwd)
    const watchPaths = [
      dirs.agents,
      dirs.entityTypes,
      dirs.roles,
      dirs.tools,
      dirs.evals,
      dirs.triggers,
      dirs.fixtures,
    ].filter((p) => existsSync(p))

    const watcher = chokidar.watch(watchPaths, {
      ignoreInitial: true,
      ignored: [/node_modules/, /\.struere-tmp-/],
      persistent: true,
      usePolling: false,
    })

    watcher.on('change', async (path) => {
      const relativePath = path.replace(cwd, '.')
      console.log(chalk.gray(`Changed: ${relativePath}`))

      const syncSpinner = ora('Syncing...').start()
      try {
        await performSync()
        syncSpinner.succeed('Synced')
      } catch (error) {
        if (isAuthError(error)) {
          syncSpinner.fail('Session expired - re-authenticating...')
          clearCredentials()
          const newCredentials = await performLogin()
          if (!newCredentials) {
            console.log(chalk.red('Authentication failed'))
            return
          }
          const retrySyncSpinner = ora('Syncing...').start()
          try {
            await performSync()
            retrySyncSpinner.succeed('Synced')
          } catch (retryError) {
            retrySyncSpinner.fail('Sync failed')
            console.log(chalk.red('Error:'), retryError instanceof Error ? retryError.message : String(retryError))
          }
        } else {
          syncSpinner.fail('Sync failed')
          console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
        }
      }
    })

    watcher.on('add', async (path) => {
      const relativePath = path.replace(cwd, '.')
      console.log(chalk.gray(`Added: ${relativePath}`))

      const syncSpinner = ora('Syncing...').start()
      try {
        await performSync()
        syncSpinner.succeed('Synced')
      } catch (error) {
        syncSpinner.fail('Sync failed')
        console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      }
    })

    watcher.on('unlink', async (path) => {
      const relativePath = path.replace(cwd, '.')
      console.log(chalk.gray(`Removed: ${relativePath}`))

      const syncSpinner = ora('Syncing...').start()
      try {
        await performSync()
        syncSpinner.succeed('Synced')
      } catch (error) {
        syncSpinner.fail('Sync failed')
        console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      }
    })

    process.on('SIGINT', () => {
      console.log()
      console.log(chalk.gray('Stopping...'))
      watcher.close().finally(() => process.exit(0))
      setTimeout(() => process.exit(0), 1000)
    })
  })
