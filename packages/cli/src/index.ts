#!/usr/bin/env node
import { program } from 'commander'
import { devCommand } from './commands/dev'
import { buildCommand } from './commands/build'
import { testCommand } from './commands/test'
import { deployCommand } from './commands/deploy'
import { validateCommand } from './commands/validate'
import { logsCommand } from './commands/logs'
import { stateCommand } from './commands/state'

program
  .name('af')
  .description('Agent Factory CLI')
  .version('0.1.0')

program.addCommand(devCommand)
program.addCommand(buildCommand)
program.addCommand(testCommand)
program.addCommand(deployCommand)
program.addCommand(validateCommand)
program.addCommand(logsCommand)
program.addCommand(stateCommand)

program.parse()
