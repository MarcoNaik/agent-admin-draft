#!/usr/bin/env bun
import { program } from 'commander'
import { initCommand } from './commands/init'
import { devCommand } from './commands/dev'
import { deployCommand } from './commands/deploy'
import { syncCommand } from './commands/sync'
import { loginCommand } from './commands/login'
import { logoutCommand } from './commands/logout'
import { whoamiCommand } from './commands/whoami'
import { addCommand } from './commands/add'
import { statusCommand } from './commands/status'
import { pullCommand } from './commands/pull'
import { entitiesCommand } from './commands/entities'
import { docsCommand } from './commands/docs'
import { evalCommand } from './commands/eval'
import { templatesCommand } from './commands/templates'
import { integrationCommand } from './commands/integration'
import { compilePromptCommand } from './commands/compile-prompt'
import pkg from '../../package.json'

const CURRENT_VERSION = pkg.version

async function checkForUpdates() {
  if (process.env.STRUERE_SKIP_UPDATE_CHECK) return
  if (process.env.STRUERE_API_KEY || !process.stdout.isTTY) return
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
          process.stderr.write(`\x1b[33m⚠ Update available: ${CURRENT_VERSION} → ${data.version}\x1b[0m\n`)
          process.stderr.write(`\x1b[90m  Run: npm install -g struere@${data.version}\x1b[0m\n`)
          process.stderr.write('\n')
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

program.addCommand(syncCommand)
program.addCommand(devCommand)
program.addCommand(deployCommand)

program.addCommand(addCommand)
program.addCommand(statusCommand)
program.addCommand(pullCommand)
program.addCommand(entitiesCommand)
program.addCommand(docsCommand)
program.addCommand(evalCommand)
program.addCommand(templatesCommand)
program.addCommand(integrationCommand)
program.addCommand(compilePromptCommand)

program.parse()
