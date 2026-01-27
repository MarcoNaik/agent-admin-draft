import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'

export const stateCommand = new Command('state')
  .description('Inspect conversation state')
  .argument('<id>', 'Conversation ID')
  .option('-e, --env <environment>', 'Environment', 'production')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    const spinner = ora()

    console.log()
    console.log(chalk.bold('Conversation State'))
    console.log()

    const apiKey = process.env.STRUERE_API_KEY

    if (!apiKey) {
      console.log(chalk.red('Error:'), 'Missing STRUERE_API_KEY environment variable')
      console.log()
      console.log('Set your API key:')
      console.log(chalk.gray('  $'), chalk.cyan('export STRUERE_API_KEY=your_api_key'))
      console.log()
      process.exit(1)
    }

    const apiUrl = process.env.STRUERE_API_URL || 'https://api.struere.dev'

    spinner.start('Fetching conversation state')

    try {
      const response = await fetch(`${apiUrl}/v1/conversations/${id}/state?env=${options.env}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Conversation not found')
        }
        throw new Error(`HTTP ${response.status}`)
      }

      const state = (await response.json()) as {
        conversationId: string
        createdAt: string
        updatedAt: string
        messageCount: number
        state: Record<string, unknown>
      }

      spinner.succeed('State retrieved')

      if (options.json) {
        console.log()
        console.log(JSON.stringify(state, null, 2))
        console.log()
        return
      }

      console.log()
      console.log(chalk.gray('Conversation:'), chalk.cyan(state.conversationId))
      console.log(chalk.gray('Created:'), new Date(state.createdAt).toLocaleString())
      console.log(chalk.gray('Updated:'), new Date(state.updatedAt).toLocaleString())
      console.log(chalk.gray('Messages:'), state.messageCount)
      console.log()
      console.log(chalk.bold('State:'))

      if (Object.keys(state.state).length === 0) {
        console.log(chalk.gray('  (empty)'))
      } else {
        for (const [key, value] of Object.entries(state.state)) {
          const displayValue =
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          console.log(chalk.gray('  •'), `${key}:`, chalk.cyan(displayValue))
        }
      }

      console.log()
    } catch (error) {
      spinner.fail('Failed to fetch state')
      console.log()
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      console.log()
      process.exit(1)
    }
  })
