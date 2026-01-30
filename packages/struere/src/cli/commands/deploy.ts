import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadConfig } from '../utils/config'
import { loadAgent } from '../utils/agent'
import { validateAgent } from '../utils/validate'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { syncToConvex, deployToProduction, extractConfig } from '../utils/convex'

export const deployCommand = new Command('deploy')
  .description('Deploy agent to production')
  .option('--dry-run', 'Show what would be deployed without deploying')
  .action(async (options) => {
    const environment = 'production'
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Deploying Agent'))
    console.log()

    if (!hasProject(cwd)) {
      console.log(chalk.yellow('No struere.json found'))
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('struere init'), chalk.gray('to initialize this project'))
      console.log()
      process.exit(1)
    }

    const project = loadProject(cwd)
    if (!project) {
      console.log(chalk.red('Failed to load struere.json'))
      process.exit(1)
    }

    console.log(chalk.gray('Agent:'), chalk.cyan(project.agent.name))
    console.log()

    spinner.start('Loading configuration')
    await loadConfig(cwd)
    spinner.succeed('Configuration loaded')

    spinner.start('Loading agent')
    const agent = await loadAgent(cwd)
    spinner.succeed(`Agent "${agent.name}" loaded`)

    spinner.start('Validating agent')
    const errors = validateAgent(agent)

    if (errors.length > 0) {
      spinner.fail('Validation failed')
      console.log()
      for (const error of errors) {
        console.log(chalk.red('  x'), error)
      }
      console.log()
      process.exit(1)
    }
    spinner.succeed('Agent validated')

    if (options.dryRun) {
      console.log()
      console.log(chalk.yellow('Dry run mode - no changes will be made'))
      console.log()
      console.log('Would deploy:')
      console.log(chalk.gray('  -'), `Agent: ${chalk.cyan(agent.name)}`)
      console.log(chalk.gray('  -'), `Version: ${chalk.cyan(agent.version)}`)
      console.log(chalk.gray('  -'), `Environment: ${chalk.cyan(environment)}`)
      console.log(chalk.gray('  -'), `Agent ID: ${chalk.cyan(project.agentId)}`)
      console.log()
      return
    }

    const credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      spinner.fail('Not authenticated')
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('struere login'), chalk.gray('to authenticate'))
      console.log(chalk.gray('Or set'), chalk.cyan('STRUERE_API_KEY'), chalk.gray('environment variable'))
      console.log()
      process.exit(1)
    }

    spinner.start('Extracting agent configuration')

    const config = extractConfig(agent)
    spinner.succeed('Configuration extracted')

    spinner.start('Syncing to development')

    try {
      const syncResult = await syncToConvex(project.agentId, config)
      if (!syncResult.success) {
        throw new Error(syncResult.error || 'Sync failed')
      }
      spinner.succeed('Synced to development')
    } catch (error) {
      spinner.fail('Sync failed')
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    spinner.start(`Deploying to ${environment}`)

    try {
      const deployResult = await deployToProduction(project.agentId)

      if (!deployResult.success) {
        throw new Error(deployResult.error || 'Deployment failed')
      }

      spinner.succeed(`Deployed to ${environment}`)

      const prodUrl = `https://${project.agent.slug}.struere.dev`

      console.log()
      console.log(chalk.green('Success!'), 'Agent deployed')
      console.log()
      console.log('Deployment details:')
      console.log(chalk.gray('  -'), `Version: ${chalk.cyan(agent.version)}`)
      console.log(chalk.gray('  -'), `Environment: ${chalk.cyan(environment)}`)
      console.log(chalk.gray('  -'), `URL: ${chalk.cyan(prodUrl)}`)
      console.log()
      console.log(chalk.gray('Test your agent:'))
      console.log(chalk.gray('  $'), chalk.cyan(`curl -X POST ${prodUrl}/chat -H "Authorization: Bearer YOUR_API_KEY" -d '{"message": "Hello"}'`))
      console.log()
    } catch (error) {
      spinner.fail('Deployment failed')
      console.log()
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      console.log()
      console.log(chalk.gray('Try running'), chalk.cyan('struere login'), chalk.gray('to re-authenticate'))
      console.log()
      process.exit(1)
    }
  })
