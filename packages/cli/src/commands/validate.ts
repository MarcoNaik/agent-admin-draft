import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadAgent } from '../utils/agent'
import { validateAgent } from '../utils/validate'

export const validateCommand = new Command('validate')
  .description('Validate agent configuration')
  .option('--strict', 'Enable strict validation')
  .action(async (options) => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Validating Agent'))
    console.log()

    spinner.start('Loading agent')

    let agent
    try {
      agent = await loadAgent(cwd)
      spinner.succeed(`Agent "${agent.name}" loaded`)
    } catch (error) {
      spinner.fail('Failed to load agent')
      console.log()
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      console.log()
      process.exit(1)
    }

    spinner.start('Validating configuration')

    const errors = validateAgent(agent)
    const warnings = options.strict ? getStrictWarnings(agent) : []

    if (errors.length === 0 && warnings.length === 0) {
      spinner.succeed('Agent is valid')
      console.log()
      console.log(chalk.green('✓'), 'No issues found')
      console.log()
      return
    }

    if (errors.length > 0) {
      spinner.fail('Validation failed')
      console.log()
      console.log(chalk.red('Errors:'))
      for (const error of errors) {
        console.log(chalk.red('  ✗'), error)
      }
    } else {
      spinner.succeed('Validation passed with warnings')
    }

    if (warnings.length > 0) {
      console.log()
      console.log(chalk.yellow('Warnings:'))
      for (const warning of warnings) {
        console.log(chalk.yellow('  ⚠'), warning)
      }
    }

    console.log()

    if (errors.length > 0) {
      process.exit(1)
    }
  })

function getStrictWarnings(agent: { description?: string; tools?: unknown[] }): string[] {
  const warnings: string[] = []

  if (!agent.description) {
    warnings.push('Agent is missing a description')
  }

  if (!agent.tools || agent.tools.length === 0) {
    warnings.push('Agent has no tools defined')
  }

  return warnings
}
