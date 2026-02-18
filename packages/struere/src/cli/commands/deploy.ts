import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadCredentials, getApiKey, clearCredentials } from '../utils/credentials'
import { hasProject, loadProjectV2, getProjectVersion } from '../utils/project'
import { syncOrganization } from '../utils/convex'
import { loadAllResources } from '../utils/loader'
import { extractSyncPayload } from '../utils/extractor'
import { performLogin } from './login'
import { runInit } from './init'

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

export const deployCommand = new Command('deploy')
  .description('Deploy all resources to production')
  .option('--dry-run', 'Show what would be deployed without deploying')
  .action(async (options) => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Deploying to Production'))
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
    console.log(chalk.gray('Environment:'), chalk.cyan('production'))
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
      spinner.succeed(`Loaded ${resources.agents.length} agents, ${resources.entityTypes.length} entity types, ${resources.roles.length} roles, ${resources.customTools.length} custom tools, ${resources.evalSuites.length} eval suites`)

      for (const err of resources.errors) {
        console.log(chalk.red('  ✖'), err)
      }

      if (resources.errors.length > 0) {
        process.exit(1)
      }
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
      if (resources.evalSuites.length > 0) {
        console.log()
        console.log('Eval suites:')
        for (const suite of resources.evalSuites) {
          console.log(chalk.gray('  -'), chalk.cyan(suite.suite), chalk.gray(`(${suite.cases.length} cases)`))
        }
      }
      console.log()
      return
    }

    spinner.start('Deploying to production')

    try {
      const payload = extractSyncPayload(resources)
      const syncResult = await syncOrganization({
        ...payload,
        organizationId: project.organization.id,
        environment: 'production',
      })
      if (!syncResult.success) {
        throw new Error(syncResult.error || 'Deploy failed')
      }
      spinner.succeed('Deployed to production')

      console.log()
      console.log(chalk.green('Success!'), 'All resources deployed to production')
      console.log()

      if (syncResult.agents?.created && syncResult.agents.created.length > 0) {
        console.log('New agents:')
        for (const slug of syncResult.agents.created) {
          const agent = resources.agents.find((a) => a.slug === slug)
          console.log(chalk.gray('  -'), chalk.cyan(agent?.name || slug))
        }
      }

      if (syncResult.agents?.updated && syncResult.agents.updated.length > 0) {
        console.log('Updated agents:')
        for (const slug of syncResult.agents.updated) {
          const agent = resources.agents.find((a) => a.slug === slug)
          console.log(chalk.gray('  -'), chalk.cyan(agent?.name || slug))
        }
      }

      console.log()
      console.log(chalk.gray('Test your agents:'))
      console.log(chalk.gray('  $'), chalk.cyan(`curl -X POST https://<agent-slug>.struere.dev/chat -H "Authorization: Bearer YOUR_API_KEY" -d '{"message": "Hello"}'`))
      console.log()
    } catch (error) {
      if (isAuthError(error)) {
        spinner.fail('Session expired - re-authenticating...')
        clearCredentials()
        credentials = await performLogin()
        if (!credentials) {
          console.log(chalk.red('Authentication failed'))
          process.exit(1)
        }
        spinner.start('Deploying to production')
        try {
          const payload = extractSyncPayload(resources)
          const syncResult = await syncOrganization({
            ...payload,
            organizationId: project.organization.id,
            environment: 'production',
              })
          if (!syncResult.success) {
            throw new Error(syncResult.error || 'Deploy failed')
          }
          spinner.succeed('Deployed to production')
          console.log()
          console.log(chalk.green('Success!'), 'All resources deployed to production')
          console.log()
        } catch (retryError) {
          spinner.fail('Deployment failed')
          console.log(chalk.red('Error:'), retryError instanceof Error ? retryError.message : String(retryError))
          process.exit(1)
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
        spinner.fail('Deployment failed')
        console.log()
        console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
        console.log()
        process.exit(1)
      }
    }
  })
