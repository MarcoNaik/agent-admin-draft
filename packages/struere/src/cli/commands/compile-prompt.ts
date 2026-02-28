import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadCredentials, getApiKey, clearCredentials } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { compilePrompt } from '../utils/convex'
import { performLogin } from './login'
import { runInit } from './init'
import { isInteractive, isAuthError } from '../utils/runtime'

export const compilePromptCommand = new Command('compile-prompt')
  .description('Compile and preview an agent\'s system prompt after template processing')
  .argument('<agent-slug>', 'Agent slug to compile prompt for')
  .option('--env <env>', 'Environment: development | production', 'development')
  .option('--message <msg>', 'Sample message for template context')
  .option('--channel <channel>', 'Sample channel (whatsapp, widget, api, dashboard)')
  .option('--param <key=value...>', 'Custom thread param (repeatable)', (val: string, acc: string[]) => {
    acc.push(val)
    return acc
  }, [] as string[])
  .option('--json', 'Output full JSON (raw + compiled + context)')
  .option('--raw', 'Show raw uncompiled template instead of compiled')
  .action(async (agentSlug: string, options: { env: string; message?: string; channel?: string; param: string[]; json?: boolean; raw?: boolean }) => {
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

    const threadMetadata: Record<string, unknown> = {}
    for (const param of options.param) {
      const eqIndex = param.indexOf('=')
      if (eqIndex === -1) {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error: `Invalid param format: ${param}. Use key=value.` }))
        } else {
          console.log(chalk.red(`Invalid param format: ${param}. Use key=value.`))
        }
        process.exit(1)
      }
      const key = param.slice(0, eqIndex)
      const value = param.slice(eqIndex + 1)
      threadMetadata[key] = value
    }

    const environment = options.env as 'development' | 'production' | 'eval'

    if (!jsonMode) {
      spinner.start(`Compiling prompt for ${chalk.cyan(agentSlug)} (${environment})`)
    }

    const doCompile = async () => {
      return compilePrompt({
        slug: agentSlug,
        environment,
        message: options.message,
        channel: options.channel,
        threadMetadata: Object.keys(threadMetadata).length > 0 ? threadMetadata : undefined,
      })
    }

    let { result, error } = await doCompile()

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
      const retry = await doCompile()
      result = retry.result
      error = retry.error
      if (!jsonMode && !error) spinner.succeed('Compiled prompt')
    }

    if (error) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error }))
      } else {
        spinner.fail('Failed to compile prompt')
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

    if (!jsonMode) spinner.succeed('Compiled prompt')

    if (jsonMode) {
      console.log(JSON.stringify({
        success: true,
        raw: result.raw,
        compiled: result.compiled,
        context: result.context,
      }, null, 2))
    } else if (options.raw) {
      console.log()
      console.log(chalk.bold('Raw System Prompt'))
      console.log(chalk.gray('─'.repeat(60)))
      console.log(result.raw)
      console.log(chalk.gray('─'.repeat(60)))
    } else {
      console.log()
      console.log(chalk.bold('Compiled System Prompt'))
      console.log(chalk.gray('─'.repeat(60)))
      console.log(result.compiled)
      console.log(chalk.gray('─'.repeat(60)))
    }
  })
