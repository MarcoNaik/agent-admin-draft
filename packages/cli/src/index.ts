#!/usr/bin/env bun
import { program } from 'commander'
import { initCommand } from './commands/init'
import { devCommand } from './commands/dev'
import { buildCommand } from './commands/build'
import { testCommand } from './commands/test'
import { deployCommand } from './commands/deploy'
import { validateCommand } from './commands/validate'
import { logsCommand } from './commands/logs'
import { stateCommand } from './commands/state'
import { loginCommand } from './commands/login'
import { logoutCommand } from './commands/logout'
import { whoamiCommand } from './commands/whoami'

program
  .name('struere')
  .description('Struere CLI - Build, test, and deploy AI agents')
  .version('0.2.2')

program.addCommand(initCommand)
program.addCommand(loginCommand)
program.addCommand(logoutCommand)
program.addCommand(whoamiCommand)

program.addCommand(devCommand)
program.addCommand(buildCommand)
program.addCommand(testCommand)
program.addCommand(deployCommand)
program.addCommand(validateCommand)
program.addCommand(logsCommand)
program.addCommand(stateCommand)

program.parse()
