import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadConfig } from '../utils/config'
import { loadAgent } from '../utils/agent'
import { validateAgent } from '../utils/validate'

export const deployCommand = new Command('deploy')
  .description('Deploy agent to Agent Factory cloud')
  .option('-e, --env <environment>', 'Target environment', 'staging')
  .option('--dry-run', 'Show what would be deployed without deploying')
  .action(async (options) => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Deploying Agent'))
    console.log()

    spinner.start('Loading configuration')
    const config = await loadConfig(cwd)
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
        console.log(chalk.red('  ✗'), error)
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
      console.log(chalk.gray('  •'), `Agent: ${chalk.cyan(agent.name)}`)
      console.log(chalk.gray('  •'), `Version: ${chalk.cyan(agent.version)}`)
      console.log(chalk.gray('  •'), `Environment: ${chalk.cyan(options.env)}`)
      console.log()
      return
    }

    spinner.start(`Deploying to ${options.env}`)

    const apiKey = process.env.AGENT_FACTORY_API_KEY

    if (!apiKey) {
      spinner.fail('Missing AGENT_FACTORY_API_KEY environment variable')
      console.log()
      console.log('Set your API key:')
      console.log(chalk.gray('  $'), chalk.cyan('export AGENT_FACTORY_API_KEY=your_api_key'))
      console.log()
      process.exit(1)
    }

    const apiUrl = process.env.AGENT_FACTORY_API_URL || 'https://api.agent-factory.dev'

    try {
      const response = await fetch(`${apiUrl}/v1/agents/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          name: agent.name,
          version: agent.version,
          environment: options.env,
          config: agent,
        }),
      })

      if (!response.ok) {
        const error = await response.json() as { message?: string }
        throw new Error(error.message || `HTTP ${response.status}`)
      }

      const result = await response.json() as { deploymentId: string; url: string }

      spinner.succeed(`Deployed to ${options.env}`)

      console.log()
      console.log(chalk.green('Success!'), 'Agent deployed')
      console.log()
      console.log('Deployment details:')
      console.log(chalk.gray('  •'), `ID: ${chalk.cyan(result.deploymentId)}`)
      console.log(chalk.gray('  •'), `URL: ${chalk.cyan(result.url)}`)
      console.log()
    } catch (error) {
      spinner.fail('Deployment failed')
      console.log()
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      console.log()
      process.exit(1)
    }
  })
