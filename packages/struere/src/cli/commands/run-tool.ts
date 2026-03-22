import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadCredentials, getApiKey, clearCredentials } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { runTool } from '../utils/convex'
import { performLogin } from './login'
import { runInit } from './init'
import { isInteractive, isAuthError } from '../utils/runtime'

export const runToolCommand = new Command('run-tool')
  .description('Run a tool as it would execute during a real agent conversation')
  .argument('<agent-slug>', 'Agent slug')
  .argument('<tool-name>', 'Tool name (e.g., entity.query)')
  .option('--env <environment>', 'Environment: development | production | eval', 'development')
  .option('--args <json>', 'Tool arguments as JSON string', '{}')
  .option('--args-file <path>', 'Read tool arguments from a JSON file')
  .option('--json', 'Output full JSON result')
  .option('--confirm', 'Skip production confirmation prompt')
  .action(async (agentSlug: string, toolName: string, options: { env: string; args: string; argsFile?: string; json?: boolean; confirm?: boolean }) => {
    const spinner = ora()
    const cwd = process.cwd()
    const nonInteractive = !isInteractive()
    const jsonMode = !!options.json

    if (!hasProject(cwd)) {
      if (nonInteractive) {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error: 'No struere.json found' }))
        } else {
          console.log(chalk.red('No struere.json found. Run struere init first.'))
        }
        process.exit(1)
      }
      console.log(chalk.yellow('No struere.json found - initializing project...'))
      console.log()
      const success = await runInit(cwd)
      if (!success) {
        process.exit(1)
      }
      console.log()
    }

    const project = loadProject(cwd)
    if (!project) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error: 'Failed to load struere.json' }))
      } else {
        console.log(chalk.red('Failed to load struere.json'))
      }
      process.exit(1)
    }

    let credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      if (nonInteractive) {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error: 'Not authenticated. Set STRUERE_API_KEY or run struere login.' }))
        } else {
          console.log(chalk.red('Not authenticated. Set STRUERE_API_KEY or run struere login.'))
        }
        process.exit(1)
      }
      console.log(chalk.yellow('Not logged in - authenticating...'))
      console.log()
      credentials = await performLogin()
      if (!credentials) {
        console.log(chalk.red('Authentication failed'))
        process.exit(1)
      }
      console.log()
    }

    let toolArgs: Record<string, unknown>
    try {
      if (options.argsFile) {
        const fs = await import('fs')
        const content = fs.readFileSync(options.argsFile, 'utf-8')
        toolArgs = JSON.parse(content)
      } else {
        toolArgs = JSON.parse(options.args)
      }
    } catch (err) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` }))
      } else {
        console.log(chalk.red(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`))
      }
      process.exit(1)
    }

    const environment = options.env as 'development' | 'production' | 'eval'

    if (environment === 'production' && !options.confirm && !nonInteractive) {
      const readline = await import('readline')
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      await new Promise<string>((resolve) => {
        rl.question(chalk.yellow('WARNING: Running tool against PRODUCTION environment.\n  This will execute real operations with real data.\n  Press Enter to continue or Ctrl+C to cancel: '), resolve)
      })
      rl.close()
    }

    if (!jsonMode) {
      spinner.start(`Running ${chalk.cyan(toolName)} on ${chalk.cyan(agentSlug)} (${environment})`)
    }

    const doRunTool = async () => {
      return runTool({
        agentSlug,
        toolName,
        toolArgs,
        environment,
        organizationId: project?.organization.id,
      })
    }

    let { result, error } = await doRunTool()

    if (error && isAuthError(error) && !nonInteractive) {
      if (!jsonMode) spinner.fail('Session expired - re-authenticating...')
      clearCredentials()
      credentials = await performLogin()
      if (!credentials) {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error: 'Authentication failed' }))
        } else {
          console.log(chalk.red('Authentication failed'))
        }
        process.exit(1)
      }
      const retry = await doRunTool()
      result = retry.result
      error = retry.error
      if (!jsonMode && !error) spinner.succeed(`Ran ${chalk.cyan(toolName)}`)
    }

    if (error) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error }))
      } else {
        spinner.fail('Failed to run tool')
        console.log(chalk.red('Error:'), error)
      }
      process.exit(1)
    }

    if (!result) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error: 'No result returned' }))
      } else {
        spinner.fail('No result returned')
      }
      process.exit(1)
    }

    if (result.error) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error: `${result.errorType}: ${result.message}`, result }))
      } else {
        spinner.fail(chalk.red(`${result.errorType}: ${result.message}`))
      }
      process.exit(1)
    }

    if (!jsonMode) {
      spinner.succeed(`Ran ${chalk.cyan(toolName)} on ${chalk.cyan(result.agent.slug)} (${result.environment}) in ${result.durationMs}ms`)
    }

    if (jsonMode) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log()
      console.log(chalk.dim('\u2500'.repeat(50)))
      console.log(JSON.stringify(result.result, null, 2))
      console.log(chalk.dim('\u2500'.repeat(50)))
      console.log()
      console.log(chalk.dim(`Identity: ${result.identity.actorType} (${result.identity.identityMode} mode)`))
    }
  })
