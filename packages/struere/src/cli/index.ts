#!/usr/bin/env bun
import { program } from 'commander'
import { initCommand } from './commands/init'
import { devCommand } from './commands/dev'
import { buildCommand } from './commands/build'
import { testCommand } from './commands/test'
import { evalCommand } from './commands/eval'
import { deployCommand } from './commands/deploy'
import { validateCommand } from './commands/validate'
import { logsCommand } from './commands/logs'
import { stateCommand } from './commands/state'
import { loginCommand } from './commands/login'
import { logoutCommand } from './commands/logout'
import { whoamiCommand } from './commands/whoami'
import { addCommand } from './commands/add'
import { statusCommand } from './commands/status'
import pkg from '../../package.json'

const CURRENT_VERSION = pkg.version

async function checkForUpdates() {
  if (process.env.STRUERE_SKIP_UPDATE_CHECK) return
  try {
    const response = await fetch('https://registry.npmjs.org/struere/latest', {
      signal: AbortSignal.timeout(2000)
    })
    if (response.ok) {
      const data = await response.json() as { version: string }
      if (data.version !== CURRENT_VERSION) {
        const semverCompare = (a: string, b: string) => {
          const pa = a.split('.').map(Number)
          const pb = b.split('.').map(Number)
          for (let i = 0; i < 3; i++) {
            if (pa[i] > pb[i]) return 1
            if (pa[i] < pb[i]) return -1
          }
          return 0
        }
        if (semverCompare(data.version, CURRENT_VERSION) > 0) {
          console.log(`\x1b[33m⚠ Update available: ${CURRENT_VERSION} → ${data.version}\x1b[0m`)
          console.log(`\x1b[90m  Run: npm install -g struere@${data.version}\x1b[0m`)
          console.log()
        }
      }
    }
  } catch {
  }
}

checkForUpdates()

program
  .name('struere')
  .description('Struere CLI - Build, test, and deploy AI agents')
  .version(CURRENT_VERSION)

program.addCommand(initCommand)
program.addCommand(loginCommand)
program.addCommand(logoutCommand)
program.addCommand(whoamiCommand)

program.addCommand(devCommand)
program.addCommand(buildCommand)
program.addCommand(testCommand)
program.addCommand(evalCommand)
program.addCommand(deployCommand)
program.addCommand(validateCommand)
program.addCommand(logsCommand)
program.addCommand(stateCommand)

program.addCommand(addCommand)
program.addCommand(statusCommand)

program.parse()
