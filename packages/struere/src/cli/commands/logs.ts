import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { getRecentExecutions } from '../utils/convex'

export const logsCommand = new Command('logs')
  .description('View recent execution logs')
  .option('-n, --lines <number>', 'Number of executions to show', '50')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora()

    console.log()
    console.log(chalk.bold('Execution Logs'))
    console.log()

    spinner.start('Fetching recent executions')

    const { executions, error } = await getRecentExecutions(parseInt(options.lines, 10))

    if (error) {
      spinner.fail('Failed to fetch executions')
      console.log()
      console.log(chalk.red('Error:'), error)
      console.log()
      process.exit(1)
    }

    spinner.succeed(`Fetched ${executions.length} executions`)
    console.log()

    if (options.json) {
      console.log(JSON.stringify(executions, null, 2))
      console.log()
      return
    }

    if (executions.length === 0) {
      console.log(chalk.gray('No executions found'))
      console.log()
      return
    }

    for (const exec of executions) {
      const statusColor = exec.status === 'success' ? chalk.green : chalk.red
      const timestamp = new Date(exec.createdAt).toISOString()

      console.log(
        chalk.gray(timestamp),
        statusColor(`[${exec.status}]`),
        chalk.cyan(`${exec.inputTokens}/${exec.outputTokens} tokens`),
        chalk.gray(`${exec.durationMs}ms`)
      )

      if (exec.errorMessage) {
        console.log(chalk.red(`  Error: ${exec.errorMessage}`))
      }
    }

    console.log()
  })
