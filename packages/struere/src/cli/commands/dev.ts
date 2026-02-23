import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import chokidar from 'chokidar'
import { join } from 'path'
import { existsSync } from 'fs'
import { loadCredentials, getApiKey, clearCredentials } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { performLogin } from './login'
import { loadAllResources, getResourceDirectories } from '../utils/loader'
import { generateDocs } from './docs'
import { runInit } from './init'
import { generateTypeDeclarations } from '../utils/plugin'
import { performDevSync, checkForDeletions } from './sync'
import { isInteractive, isAuthError, isOrgAccessError } from '../utils/runtime'
import { confirm } from '@inquirer/prompts'

export const devCommand = new Command('dev')
  .description('Watch files and sync to development on change (long-running)')
  .option('--force', 'Skip destructive sync confirmation')
  .action(async (options) => {
    const spinner = ora()
    const cwd = process.cwd()
    const apiKey = getApiKey()
    const nonInteractive = !isInteractive()

    if (nonInteractive) {
      console.error('Error: struere dev is a long-running watch process. Use struere sync instead.')
      process.exit(1)
    }

    console.log()
    console.log(chalk.bold('Struere Dev'))
    console.log()

    if (!hasProject(cwd)) {
      if (nonInteractive) {
        console.log(chalk.red('No struere.json found. Cannot run init in headless mode.'))
        process.exit(1)
      }
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
    if (nonInteractive) {
      console.log(chalk.gray('Auth:'), chalk.cyan('non-interactive'))
    }
    console.log()

    let credentials = loadCredentials()

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

    const shouldSkipConfirmation = options.force || nonInteractive

    if (initialSyncOk && !shouldSkipConfirmation && loadedResources) {
      spinner.start('Checking remote state')
      try {
        const deletions = await checkForDeletions(loadedResources, project.organization.id, 'development')
        spinner.stop()

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
      } catch {
        spinner.stop()
      }
    }

    if (initialSyncOk) {
      spinner.start('Syncing to Convex')

      try {
        await performDevSync(cwd, project.organization.id)
        spinner.succeed('Synced to development')
      } catch (error) {
        if (isAuthError(error) && !nonInteractive) {
          spinner.fail('Session expired - re-authenticating...')
          clearCredentials()
          credentials = await performLogin()
          if (!credentials) {
            console.log(chalk.red('Authentication failed'))
            process.exit(1)
          }
          spinner.start('Syncing to Convex')
          try {
            await performDevSync(cwd, project.organization.id)
            spinner.succeed('Synced to development')
          } catch (retryError) {
            spinner.fail('Sync failed')
            console.log(chalk.red('Error:'), retryError instanceof Error ? retryError.message : String(retryError))
          }
        } else if (isAuthError(error) && nonInteractive) {
          spinner.fail('API key authentication failed')
          console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
          console.log(chalk.gray('Check that STRUERE_API_KEY is valid and not expired.'))
          process.exit(1)
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
      ignored: [/node_modules/, /\.struere-tmp-/, /evals\/runs\//],
      persistent: true,
      usePolling: false,
    })

    const handleFileChange = async (path: string, action: string) => {
      const relativePath = path.replace(cwd, '.')
      console.log(chalk.gray(`${action}: ${relativePath}`))

      const syncSpinner = ora('Syncing...').start()
      try {
        await performDevSync(cwd, project.organization.id)
        syncSpinner.succeed('Synced')
      } catch (error) {
        if (isAuthError(error) && !nonInteractive) {
          syncSpinner.fail('Session expired - re-authenticating...')
          clearCredentials()
          const newCredentials = await performLogin()
          if (!newCredentials) {
            console.log(chalk.red('Authentication failed'))
            return
          }
          const retrySyncSpinner = ora('Syncing...').start()
          try {
            await performDevSync(cwd, project.organization.id)
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
    }

    watcher.on('change', (path) => handleFileChange(path, 'Changed'))
    watcher.on('add', (path) => handleFileChange(path, 'Added'))
    watcher.on('unlink', (path) => handleFileChange(path, 'Removed'))

    process.on('SIGINT', () => {
      console.log()
      console.log(chalk.gray('Stopping...'))
      watcher.close().finally(() => process.exit(0))
      setTimeout(() => process.exit(0), 1000)
    })
  })
