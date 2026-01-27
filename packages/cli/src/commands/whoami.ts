import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadCredentials } from '../utils/credentials'
import { ApiClient, ApiError } from '../utils/api'

export const whoamiCommand = new Command('whoami')
  .description('Show current logged in user')
  .option('--refresh', 'Refresh user info from server')
  .action(async (options) => {
    console.log()

    const credentials = loadCredentials()

    if (!credentials) {
      console.log(chalk.yellow('Not logged in'))
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('af login'), chalk.gray('to log in'))
      console.log()
      return
    }

    if (options.refresh) {
      const spinner = ora('Fetching user info').start()

      try {
        const api = new ApiClient()
        const { user, organization } = await api.getMe()

        spinner.stop()

        console.log(chalk.bold('Logged in as:'))
        console.log()
        console.log(chalk.gray('  User:        '), chalk.cyan(user.name), chalk.gray(`<${user.email}>`))
        console.log(chalk.gray('  User ID:     '), chalk.gray(user.id))
        console.log(chalk.gray('  Role:        '), chalk.cyan(user.role))
        console.log()
        console.log(chalk.gray('  Organization:'), chalk.cyan(organization.name))
        console.log(chalk.gray('  Org ID:      '), chalk.gray(organization.id))
        console.log(chalk.gray('  Slug:        '), chalk.cyan(organization.slug))
        console.log(chalk.gray('  Plan:        '), chalk.cyan(organization.plan))
        console.log()
      } catch (error) {
        spinner.fail('Failed to fetch user info')
        console.log()
        if (error instanceof ApiError) {
          if (error.status === 401) {
            console.log(chalk.red('Session expired. Please log in again.'))
          } else {
            console.log(chalk.red('Error:'), error.message)
          }
        } else {
          console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
        }
        console.log()
        process.exit(1)
      }
    } else {
      console.log(chalk.bold('Logged in as:'))
      console.log()
      console.log(chalk.gray('  User:        '), chalk.cyan(credentials.user.name), chalk.gray(`<${credentials.user.email}>`))
      console.log(chalk.gray('  User ID:     '), chalk.gray(credentials.user.id))
      console.log()
      console.log(chalk.gray('  Organization:'), chalk.cyan(credentials.organization.name))
      console.log(chalk.gray('  Org ID:      '), chalk.gray(credentials.organization.id))
      console.log(chalk.gray('  Slug:        '), chalk.cyan(credentials.organization.slug))
      console.log()
      console.log(chalk.gray('Use'), chalk.cyan('af whoami --refresh'), chalk.gray('to fetch latest info'))
      console.log()
    }
  })
