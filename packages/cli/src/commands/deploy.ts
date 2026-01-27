import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { join } from 'path'
import { loadConfig } from '../utils/config'
import { loadAgent } from '../utils/agent'
import { validateAgent } from '../utils/validate'
import { isLoggedIn, loadCredentials, getApiKey } from '../utils/credentials'
import { ApiClient, ApiError } from '../utils/api'

export const deployCommand = new Command('deploy')
  .description('Deploy agent to Agent Factory cloud')
  .option('-e, --env <environment>', 'Target environment (preview, staging, production)', 'preview')
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

    const credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      spinner.fail('Not authenticated')
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('af login'), chalk.gray('to authenticate'))
      console.log(chalk.gray('Or set'), chalk.cyan('AGENT_FACTORY_API_KEY'), chalk.gray('environment variable'))
      console.log()
      process.exit(1)
    }

    spinner.start('Building agent bundle')

    const result = await Bun.build({
      entrypoints: [join(cwd, 'src', 'agent.ts')],
      target: 'browser',
      minify: true
    })

    if (!result.success) {
      spinner.fail('Build failed')
      console.log()
      for (const log of result.logs) {
        console.log(chalk.red('  •'), log)
      }
      console.log()
      process.exit(1)
    }

    const bundle = await result.outputs[0].text()
    spinner.succeed(`Bundle created (${formatBytes(bundle.length)})`)

    spinner.start(`Deploying to ${options.env}`)

    try {
      const api = new ApiClient()

      const agentSlug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      let agentRecord: { id: string } | null = null
      try {
        const { agents } = await api.listAgents()
        agentRecord = agents.find(a => a.slug === agentSlug) || null
      } catch {
      }

      if (!agentRecord) {
        spinner.text = 'Creating agent'
        const { agent: newAgent } = await api.createAgent({
          name: agent.name,
          slug: agentSlug,
          description: agent.description
        })
        agentRecord = newAgent
      }

      spinner.text = `Deploying to ${options.env}`

      const { deployment } = await api.deployAgent(agentRecord.id, {
        bundle,
        version: agent.version,
        environment: options.env as 'preview' | 'staging' | 'production',
        metadata: {
          modelProvider: agent.model?.provider || 'anthropic',
          modelName: agent.model?.name || 'claude-sonnet-4-20250514',
          toolCount: agent.tools?.length || 0,
          bundleSize: bundle.length
        }
      })

      spinner.succeed(`Deployed to ${options.env}`)

      console.log()
      console.log(chalk.green('Success!'), 'Agent deployed')
      console.log()
      console.log('Deployment details:')
      console.log(chalk.gray('  •'), `ID: ${chalk.cyan(deployment.id)}`)
      console.log(chalk.gray('  •'), `Version: ${chalk.cyan(deployment.version)}`)
      console.log(chalk.gray('  •'), `Environment: ${chalk.cyan(deployment.environment)}`)
      console.log(chalk.gray('  •'), `URL: ${chalk.cyan(deployment.url)}`)
      console.log()
      console.log(chalk.gray('Test your agent:'))
      console.log(chalk.gray('  $'), chalk.cyan(`curl -X POST ${deployment.url}/chat -H "Authorization: Bearer YOUR_API_KEY" -d '{"message": "Hello"}'`))
      console.log()
    } catch (error) {
      spinner.fail('Deployment failed')
      console.log()
      if (error instanceof ApiError) {
        console.log(chalk.red('Error:'), error.message)
        if (error.status === 401) {
          console.log()
          console.log(chalk.gray('Try running'), chalk.cyan('af login'), chalk.gray('to re-authenticate'))
        }
      } else {
        console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      }
      console.log()
      process.exit(1)
    }
  })

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
