import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { getThreadState } from '../utils/convex'

export const stateCommand = new Command('state')
  .description('Inspect conversation thread state')
  .argument('<id>', 'Thread ID')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    const spinner = ora()

    console.log()
    console.log(chalk.bold('Thread State'))
    console.log()

    spinner.start('Fetching thread state')

    const { state, error } = await getThreadState(id)

    if (error) {
      spinner.fail('Failed to fetch state')
      console.log()
      console.log(chalk.red('Error:'), error)
      console.log()
      process.exit(1)
    }

    if (!state) {
      spinner.fail('Thread not found')
      console.log()
      process.exit(1)
    }

    spinner.succeed('State retrieved')

    if (options.json) {
      console.log()
      console.log(JSON.stringify(state, null, 2))
      console.log()
      return
    }

    console.log()
    console.log(chalk.gray('Thread:'), chalk.cyan(state.thread._id))
    console.log(chalk.gray('Agent:'), state.thread.agentId)
    console.log(chalk.gray('Created:'), new Date(state.thread.createdAt).toLocaleString())
    console.log(chalk.gray('Updated:'), new Date(state.thread.updatedAt).toLocaleString())
    console.log(chalk.gray('Messages:'), state.messages.length)
    console.log()

    if (state.messages.length > 0) {
      console.log(chalk.bold('Messages:'))
      console.log()

      for (const msg of state.messages) {
        const roleColor = msg.role === 'user' ? chalk.blue : msg.role === 'assistant' ? chalk.green : chalk.gray
        console.log(roleColor(`[${msg.role}]`))
        console.log(msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : ''))
        console.log()
      }
    }
  })
