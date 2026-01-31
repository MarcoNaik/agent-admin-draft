import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import chokidar from 'chokidar'
import { join } from 'path'
import { existsSync, writeFileSync } from 'fs'
import { loadCredentials, getApiKey, clearCredentials } from '../utils/credentials'
import { hasProject, loadProjectV2, getProjectVersion } from '../utils/project'
import { performLogin } from './login'
import { syncOrganization } from '../utils/convex'
import { loadAllResources, getResourceDirectories } from '../utils/loader'
import { extractSyncPayload } from '../utils/extractor'
import { getClaudeMDV2 } from '../templates'
import { runInit } from './init'

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

    const version = getProjectVersion(cwd)
    if (version === '1.0') {
      console.log(chalk.yellow('This is a v1 agent-centric project.'))
      console.log(chalk.yellow('Please migrate to v2 structure or use an older CLI version.'))
      console.log()
      process.exit(1)
    }

    const project = loadProjectV2(cwd)
    if (!project) {
      console.log(chalk.red('Failed to load struere.json'))
      process.exit(1)
    }

    console.log(chalk.gray('Organization:'), chalk.cyan(project.organization.name))
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
      writeFileSync(claudeMdPath, getClaudeMDV2(project.organization.name))
      console.log(chalk.green('✓'), 'Created CLAUDE.md')
    }

    const isAuthError = (error: unknown): boolean => {
      const message = error instanceof Error ? error.message : String(error)
      return message.includes('Unauthenticated') ||
             message.includes('OIDC') ||
             message.includes('token') ||
             message.includes('expired')
    }

    const performSync = async (): Promise<boolean> => {
      const resources = await loadAllResources(cwd)
      const payload = extractSyncPayload(resources)
      const result = await syncOrganization(payload)
      if (!result.success) {
        throw new Error(result.error || 'Sync failed')
      }
      return true
    }

    spinner.start('Loading resources')

    try {
      const resources = await loadAllResources(cwd)
      spinner.succeed(`Loaded ${resources.agents.length} agents, ${resources.entityTypes.length} entity types, ${resources.roles.length} roles`)
    } catch (error) {
      spinner.fail('Failed to load resources')
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

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
          process.exit(1)
        }
      } else {
        spinner.fail('Sync failed')
        console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
        process.exit(1)
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
      join(cwd, 'struere.config.ts'),
    ].filter((p) => existsSync(p))

    const watcher = chokidar.watch(watchPaths, {
      ignoreInitial: true,
      ignored: /node_modules/,
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
      watcher.close()
      console.log(chalk.gray('Stopped'))
      process.exit(0)
    })
  })
