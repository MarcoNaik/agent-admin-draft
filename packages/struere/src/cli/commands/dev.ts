import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import chokidar from 'chokidar'
import { join } from 'path'
import { existsSync, writeFileSync } from 'fs'
import { loadCredentials, getApiKey, clearCredentials } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { performLogin } from './login'
import { syncOrganization } from '../utils/convex'
import { loadAllResources, getResourceDirectories } from '../utils/loader'
import { extractSyncPayload } from '../utils/extractor'
import { getClaudeMD } from '../templates'
import { runInit } from './init'
import { generateTypeDeclarations } from '../utils/plugin'

export const devCommand = new Command('dev')
  .description('Sync all resources to development environment')
  .action(async () => {
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
    console.log(chalk.gray('Environment:'), chalk.cyan('development'))
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
      writeFileSync(claudeMdPath, getClaudeMD(project.organization.name))
      console.log(chalk.green('✓'), 'Created CLAUDE.md')
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
      const result = await syncOrganization({
        ...payload,
        organizationId: project.organization.id,
        environment: 'development',
      })
      if (!result.success) {
        throw new Error(result.error || 'Sync failed')
      }
      return true
    }

    let initialSyncOk = false

    spinner.start('Loading resources')

    try {
      const resources = await loadAllResources(cwd)
      spinner.succeed(`Loaded ${resources.agents.length} agents, ${resources.entityTypes.length} entity types, ${resources.roles.length} roles, ${resources.customTools.length} custom tools, ${resources.evalSuites.length} eval suites, ${resources.triggers.length} triggers`)

      for (const err of resources.errors) {
        console.log(chalk.red('  ✖'), err)
      }

      if (resources.errors.length === 0) {
        initialSyncOk = true
      }
    } catch (error) {
      spinner.fail('Failed to load resources')
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
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
