import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { getUserInfo } from '../utils/convex'

export const whoamiCommand = new Command('whoami')
  .description('Show current logged in user')
  .option('--refresh', 'Refresh user info from server')
  .option('--json', 'Output raw JSON')
  .action(async (options: { refresh?: boolean; json?: boolean }) => {
    const jsonMode = !!options.json
    const credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      if (jsonMode) {
        console.log(JSON.stringify({ authenticated: false }))
      } else {
        console.log()
        console.log(chalk.yellow('Not logged in'))
        console.log()
        console.log(chalk.gray('Run'), chalk.cyan('struere login'), chalk.gray('to log in'))
        console.log()
      }
      return
    }

    if (options.refresh && credentials) {
      const spinner = jsonMode ? null : ora('Fetching user info').start()

      const { userInfo, error } = await getUserInfo(credentials.token)

      if (error || !userInfo) {
        if (jsonMode) {
          console.log(JSON.stringify({ authenticated: false, error: error || 'Unknown error' }))
        } else {
          spinner?.fail('Failed to fetch user info')
          console.log()
          if (error?.includes('401') || error?.includes('unauthorized')) {
            console.log(chalk.red('Session expired. Please log in again.'))
          } else {
            console.log(chalk.red('Error:'), error || 'Unknown error')
          }
          console.log()
        }
        process.exit(1)
      }

      spinner?.stop()

      const { user, organizations } = userInfo

      if (jsonMode) {
        console.log(JSON.stringify({ user, organizations }))
        return
      }

      console.log()
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
      if (credentials) {
        if (jsonMode) {
          console.log(JSON.stringify({
            user: {
              id: credentials.user.id,
              name: credentials.user.name,
              email: credentials.user.email,
            },
          }))
          return
        }

        console.log()
        console.log(chalk.bold('Logged in as:'))
        console.log()
        console.log(chalk.gray('  User:        '), chalk.cyan(credentials.user.name), chalk.gray(`<${credentials.user.email}>`))
        console.log(chalk.gray('  User ID:     '), chalk.gray(credentials.user.id))
        console.log()
        console.log(chalk.gray('Use'), chalk.cyan('struere whoami --refresh'), chalk.gray('to fetch organizations'))
        console.log()
      } else {
        if (jsonMode) {
          console.log(JSON.stringify({ authenticated: true, authMethod: 'api-key' }))
        } else {
          console.log()
          console.log(chalk.bold('Authenticated via API key'))
          console.log()
          console.log(chalk.gray('Use'), chalk.cyan('struere whoami --refresh'), chalk.gray('with browser login for full details'))
          console.log()
        }
      }
    }
  })
