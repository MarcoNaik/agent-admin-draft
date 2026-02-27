import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { getSyncState } from '../utils/convex'
import { loadAllResources } from '../utils/loader'
import { performLogin } from './login'
import { runInit } from './init'
import { isInteractive } from '../utils/runtime'

export const statusCommand = new Command('status')
  .description('Compare local vs remote state')
  .option('--json', 'Output raw JSON')
  .action(async (opts: { json?: boolean }) => {
    const spinner = ora()
    const cwd = process.cwd()
    const jsonMode = !!opts.json
    const nonInteractive = !isInteractive()

    if (!jsonMode) {
      console.log()
      console.log(chalk.bold('Struere Status'))
      console.log()
    }

    if (!hasProject(cwd)) {
      if (nonInteractive) {
        if (jsonMode) {
          console.log(JSON.stringify({ error: 'No struere.json found. Run struere init first.' }))
        } else {
          console.log(chalk.red('No struere.json found. Run struere init first.'))
        }
        process.exit(1)
      }
      console.log(chalk.yellow('No struere.json found - initializing project...'))
      console.log()
      const success = await runInit(cwd)
      if (!success) {
        process.exit(1)
      }
      console.log()
    }

    const project = loadProject(cwd)
    if (!project) {
      if (jsonMode) {
        console.log(JSON.stringify({ error: 'Failed to load struere.json' }))
      } else {
        console.log(chalk.red('Failed to load struere.json'))
      }
      process.exit(1)
    }

    if (!jsonMode) {
      console.log(chalk.gray('Organization:'), chalk.cyan(project.organization.name))
      console.log()
    }

    let credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      if (nonInteractive) {
        if (jsonMode) {
          console.log(JSON.stringify({ error: 'Not authenticated. Set STRUERE_API_KEY or run struere login.' }))
        } else {
          console.log(chalk.red('Not authenticated. Set STRUERE_API_KEY or run struere login.'))
        }
        process.exit(1)
      }
      console.log(chalk.yellow('Not logged in - authenticating...'))
      console.log()
      credentials = await performLogin()
      if (!credentials) {
        console.log(chalk.red('Authentication failed'))
        process.exit(1)
      }
      console.log()
    }

    if (!jsonMode) spinner.start('Loading local resources')

    let localResources
    try {
      localResources = await loadAllResources(cwd)
      if (!jsonMode) {
        spinner.succeed(`Loaded ${localResources.agents.length} agents, ${localResources.entityTypes.length} entity types, ${localResources.roles.length} roles, ${localResources.customTools.length} custom tools, ${localResources.evalSuites.length} eval suites`)

        for (const err of localResources.errors) {
          console.log(chalk.red('  ✖'), err)
        }
      }

      if (localResources.errors.length > 0) {
        if (jsonMode) {
          console.log(JSON.stringify({ error: `${localResources.errors.length} resource loading error(s)`, errors: localResources.errors }))
        }
        process.exit(1)
      }
    } catch (error) {
      if (jsonMode) {
        console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      } else {
        spinner.fail('Failed to load local resources')
        console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      }
      process.exit(1)
    }

    if (!jsonMode) spinner.start('Fetching remote state')

    const [devResult, prodResult] = await Promise.all([
      getSyncState(project.organization.id, 'development'),
      getSyncState(project.organization.id, 'production'),
    ])

    if (devResult.error || !devResult.state) {
      if (jsonMode) {
        console.log(JSON.stringify({ error: devResult.error || 'Failed to fetch remote state' }))
      } else {
        spinner.fail('Failed to fetch remote state')
        console.log(chalk.red('Error:'), devResult.error || 'Unknown error')
      }
      process.exit(1)
    }

    if (!jsonMode) spinner.succeed('Remote state fetched')

    const devState = devResult.state
    const prodState = prodResult.state

    const localAgentSlugs = new Set(localResources.agents.map((a) => a.slug))
    const devAgentSlugs = new Set(devState.agents.map((a) => a.slug))

    const localEntityTypeSlugs = new Set(localResources.entityTypes.map((et) => et.slug))
    const devEntityTypeSlugs = new Set(devState.entityTypes.map((et) => et.slug))

    const localRoleNames = new Set(localResources.roles.map((r) => r.name))
    const devRoleNames = new Set(devState.roles.map((r) => r.name))

    if (opts.json) {
      const classify = (localItems: Array<{ slug?: string; name?: string }>, remoteItems: Array<{ slug?: string; name?: string }>, useSlug: boolean) => {
        const localKeys = new Set(localItems.map((i) => useSlug ? i.slug : i.name))
        const remoteKeys = new Set(remoteItems.map((i) => useSlug ? i.slug : i.name))
        return {
          synced: localItems.filter((i) => remoteKeys.has(useSlug ? i.slug : i.name)).map((i) => useSlug ? i.slug : i.name),
          new: localItems.filter((i) => !remoteKeys.has(useSlug ? i.slug : i.name)).map((i) => useSlug ? i.slug : i.name),
          deleted: remoteItems.filter((i) => !localKeys.has(useSlug ? i.slug : i.name)).map((i) => useSlug ? i.slug : i.name),
        }
      }
      console.log(JSON.stringify({
        agents: classify(localResources.agents, devState.agents, true),
        entityTypes: classify(localResources.entityTypes, devState.entityTypes, true),
        roles: classify(localResources.roles, devState.roles, false),
      }))
      return
    }

    console.log()
    console.log(chalk.bold('Agents'))
    console.log(chalk.gray('─'.repeat(60)))

    if (localResources.agents.length === 0 && devState.agents.length === 0) {
      console.log(chalk.gray('  No agents'))
    } else {
      for (const agent of localResources.agents) {
        const devRemote = devState.agents.find((a) => a.slug === agent.slug)
        const prodRemote = prodState?.agents.find((a) => a.slug === agent.slug)
        if (devRemote) {
          const statusIcon = prodRemote?.hasConfig ? chalk.green('●') : chalk.yellow('○')
          console.log(`  ${statusIcon} ${chalk.cyan(agent.name)} (${agent.slug}) - v${agent.version}`)
          if (!prodRemote?.hasConfig) {
            console.log(chalk.gray('      Not deployed to production'))
          }
        } else {
          console.log(`  ${chalk.blue('+')} ${chalk.cyan(agent.name)} (${agent.slug}) - ${chalk.blue('new')}`)
        }
      }

      for (const remote of devState.agents) {
        if (!localAgentSlugs.has(remote.slug)) {
          console.log(`  ${chalk.red('-')} ${remote.name} (${remote.slug}) - ${chalk.red('will be deleted')}`)
        }
      }
    }

    console.log()
    console.log(chalk.bold('Entity Types'))
    console.log(chalk.gray('─'.repeat(60)))

    if (localResources.entityTypes.length === 0 && devState.entityTypes.length === 0) {
      console.log(chalk.gray('  No entity types'))
    } else {
      for (const et of localResources.entityTypes) {
        const remote = devState.entityTypes.find((r) => r.slug === et.slug)
        if (remote) {
          console.log(`  ${chalk.green('●')} ${chalk.cyan(et.name)} (${et.slug})`)
        } else {
          console.log(`  ${chalk.blue('+')} ${chalk.cyan(et.name)} (${et.slug}) - ${chalk.blue('new')}`)
        }
      }

      for (const remote of devState.entityTypes) {
        if (!localEntityTypeSlugs.has(remote.slug)) {
          console.log(`  ${chalk.red('-')} ${remote.name} (${remote.slug}) - ${chalk.red('will be deleted')}`)
        }
      }
    }

    console.log()
    console.log(chalk.bold('Roles'))
    console.log(chalk.gray('─'.repeat(60)))

    if (localResources.roles.length === 0 && devState.roles.length === 0) {
      console.log(chalk.gray('  No roles'))
    } else {
      for (const role of localResources.roles) {
        const remote = devState.roles.find((r) => r.name === role.name)
        if (remote) {
          console.log(`  ${chalk.green('●')} ${chalk.cyan(role.name)} (${role.policies.length} policies)`)
        } else {
          console.log(`  ${chalk.blue('+')} ${chalk.cyan(role.name)} - ${chalk.blue('new')}`)
        }
      }

      for (const remote of devState.roles) {
        if (!localRoleNames.has(remote.name)) {
          console.log(`  ${chalk.red('-')} ${remote.name} - ${chalk.red('will be deleted')}`)
        }
      }
    }

    console.log()
    console.log(chalk.gray('Legend:'))
    console.log(chalk.gray('  '), chalk.green('●'), 'Synced', chalk.yellow('○'), 'Not in production', chalk.blue('+'), 'New', chalk.red('-'), 'Will be deleted')
    console.log()
    console.log(chalk.gray('Run'), chalk.cyan('struere sync'), chalk.gray('to sync to development'))
    console.log(chalk.gray('Run'), chalk.cyan('struere deploy'), chalk.gray('to deploy to production'))
    console.log()
  })
