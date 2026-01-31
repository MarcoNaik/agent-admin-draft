import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadCredentials } from '../utils/credentials'
import { getUserInfo } from '../utils/convex'

export const whoamiCommand = new Command('whoami')
  .description('Show current logged in user')
  .option('--refresh', 'Refresh user info from server')
  .action(async (options) => {
    console.log()

    const credentials = loadCredentials()

    if (!credentials) {
      console.log(chalk.yellow('Not logged in'))
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('struere login'), chalk.gray('to log in'))
      console.log()
      return
    }

    if (options.refresh) {
      const spinner = ora('Fetching user info').start()

      const { userInfo, error } = await getUserInfo(credentials.token)

      if (error || !userInfo) {
        spinner.fail('Failed to fetch user info')
        console.log()
        if (error?.includes('401') || error?.includes('unauthorized')) {
          console.log(chalk.red('Session expired. Please log in again.'))
        } else {
          console.log(chalk.red('Error:'), error || 'Unknown error')
        }
        console.log()
        process.exit(1)
      }

      spinner.stop()

      const { user, organizations } = userInfo

      console.log(chalk.bold('Logged in as:'))
      console.log()
      console.log(chalk.gray('  User:        '), chalk.cyan(user.name || user.email), chalk.gray(`<${user.email}>`))
      console.log(chalk.gray('  User ID:     '), chalk.gray(user.id))
      console.log()
      if (organizations.length > 0) {
        console.log(chalk.gray('  Organizations:'))
        for (const org of organizations) {
          console.log(chalk.gray('    •'), chalk.cyan(org.name), chalk.gray(`(${org.slug})`), chalk.gray(`- ${org.role}`))
        }
      } else {
        console.log(chalk.yellow('  No organizations found'))
      }
      console.log()
    } else {
      console.log(chalk.bold('Logged in as:'))
      console.log()
      console.log(chalk.gray('  User:        '), chalk.cyan(credentials.user.name), chalk.gray(`<${credentials.user.email}>`))
      console.log(chalk.gray('  User ID:     '), chalk.gray(credentials.user.id))
      console.log()
      console.log(chalk.gray('Use'), chalk.cyan('struere whoami --refresh'), chalk.gray('to fetch organizations'))
      console.log()
    }
  })
