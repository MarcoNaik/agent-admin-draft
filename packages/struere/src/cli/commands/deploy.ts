import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { hasProject, loadProjectV2, getProjectVersion } from '../utils/project'
import { syncOrganization, deployAllAgents } from '../utils/convex'
import { loadAllResources } from '../utils/loader'
import { extractSyncPayload } from '../utils/extractor'
import { performLogin } from './login'
import { runInit } from './init'

export const deployCommand = new Command('deploy')
  .description('Deploy all agents to production')
  .option('--dry-run', 'Show what would be deployed without deploying')
  .action(async (options) => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Deploying Agents'))
    console.log()

    if (!hasProject(cwd)) {
      console.log(chalk.yellow('No struere.json found - initializing project...'))
      console.log()
      const success = await runInit(cwd)
      if (!success) {
        process.exit(1)
      }
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

    spinner.start('Loading resources')

    let resources
    try {
      resources = await loadAllResources(cwd)
      spinner.succeed(`Loaded ${resources.agents.length} agents, ${resources.entityTypes.length} entity types, ${resources.roles.length} roles`)
    } catch (error) {
      spinner.fail('Failed to load resources')
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    if (resources.agents.length === 0) {
      console.log()
      console.log(chalk.yellow('No agents found to deploy'))
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('struere add agent my-agent'), chalk.gray('to create an agent'))
      console.log()
      return
    }

    if (options.dryRun) {
      console.log()
      console.log(chalk.yellow('Dry run mode - no changes will be made'))
      console.log()
      console.log('Would deploy:')
      for (const agent of resources.agents) {
        console.log(chalk.gray('  -'), `${chalk.cyan(agent.name)} (${agent.slug}) v${agent.version}`)
      }
      console.log()
      console.log('Entity types:')
      for (const et of resources.entityTypes) {
        console.log(chalk.gray('  -'), chalk.cyan(et.name), `(${et.slug})`)
      }
      console.log()
      console.log('Roles:')
      for (const role of resources.roles) {
        console.log(chalk.gray('  -'), chalk.cyan(role.name))
      }
      console.log()
      return
    }

    spinner.start('Syncing to development')

    try {
      const payload = extractSyncPayload(resources)
      const syncResult = await syncOrganization(payload)
      if (!syncResult.success) {
        throw new Error(syncResult.error || 'Sync failed')
      }
      spinner.succeed('Synced to development')
    } catch (error) {
      spinner.fail('Sync failed')
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    spinner.start('Deploying to production')

    try {
      const deployResult = await deployAllAgents()

      if (!deployResult.success) {
        throw new Error(deployResult.error || 'Deployment failed')
      }

      spinner.succeed('Deployed to production')

      console.log()
      console.log(chalk.green('Success!'), 'All agents deployed')
      console.log()

      if (deployResult.deployed && deployResult.deployed.length > 0) {
        console.log('Deployed agents:')
        for (const slug of deployResult.deployed) {
          const agent = resources.agents.find((a) => a.slug === slug)
          const prodUrl = `https://${slug}.struere.dev`
          console.log(chalk.gray('  -'), chalk.cyan(agent?.name || slug), chalk.gray(`→ ${prodUrl}`))
        }
      }

      if (deployResult.skipped && deployResult.skipped.length > 0) {
        console.log()
        console.log(chalk.yellow('Skipped (no development config):'))
        for (const slug of deployResult.skipped) {
          console.log(chalk.gray('  -'), slug)
        }
      }

      console.log()
      console.log(chalk.gray('Test your agents:'))
      console.log(chalk.gray('  $'), chalk.cyan(`curl -X POST https://<agent-slug>.struere.dev/chat -H "Authorization: Bearer YOUR_API_KEY" -d '{"message": "Hello"}'`))
      console.log()
    } catch (error) {
      spinner.fail('Deployment failed')
      console.log()
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      console.log()
      process.exit(1)
    }
  })
