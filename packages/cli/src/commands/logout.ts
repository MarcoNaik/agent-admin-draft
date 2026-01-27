import { Command } from 'commander'
import chalk from 'chalk'
import { clearCredentials, loadCredentials } from '../utils/credentials'

export const logoutCommand = new Command('logout')
  .description('Log out of Agent Factory')
  .action(async () => {
    console.log()

    const credentials = loadCredentials()

    if (!credentials) {
      console.log(chalk.yellow('Not currently logged in'))
      console.log()
      return
    }

    clearCredentials()

    console.log(chalk.green('Logged out successfully'))
    console.log(chalk.gray('Goodbye,'), chalk.cyan(credentials.user.name))
    console.log()
  })
