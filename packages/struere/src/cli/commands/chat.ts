import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import readline from 'readline'
import { loadCredentials, getApiKey, clearCredentials } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { chatWithAgent } from '../utils/convex'
import { performLogin } from './login'
import { runInit } from './init'
import { isInteractive, isAuthError } from '../utils/runtime'

export const chatCommand = new Command('chat')
  .description('Chat with an agent')
  .argument('<agent-slug>', 'Agent slug')
  .option('--env <environment>', 'Environment: development | production | eval', 'development')
  .option('--thread <id>', 'Continue an existing thread')
  .option('--message <msg>', 'Single message mode (send and exit)')
  .option('--json', 'Output JSON')
  .option('--channel <channel>', 'Channel identifier', 'api')
  .option('-v, --verbose', 'Show detailed response info')
  .option('--confirm', 'Skip production warning prompt')
  .action(async (agentSlug: string, options: { env: string; thread?: string; message?: string; json?: boolean; channel?: string; verbose?: boolean; confirm?: boolean }) => {
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

    const environment = options.env as 'development' | 'production' | 'eval'

    if (environment === 'production' && !nonInteractive && !options.confirm) {
      const confirmRl = readline.createInterface({ input: process.stdin, output: process.stdout })
      await new Promise<string>((resolve) => {
        confirmRl.question(chalk.yellow('WARNING: Chatting with agent in PRODUCTION environment.\n  Press Enter to continue or Ctrl+C to cancel: '), resolve)
      })
      confirmRl.close()
    }

    const doChat = async (message: string, threadId?: string, signal?: AbortSignal) => {
      return chatWithAgent({
        slug: agentSlug,
        message,
        threadId,
        environment,
        organizationId: project?.organization.id,
        channel: options.channel,
        signal,
      })
    }

    if (options.message) {
      if (!jsonMode) {
        spinner.start('Sending message...')
      }

      let { result, error } = await doChat(options.message, options.thread)

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
        const retry = await doChat(options.message, options.thread)
        result = retry.result
        error = retry.error
        if (!jsonMode && !error) spinner.succeed('Message sent')
      }

      if (error) {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error }))
        } else {
          spinner.fail('Failed to send message')
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

      if (!jsonMode) spinner.succeed('Message sent')

      if (jsonMode) {
        console.log(JSON.stringify({ message: result.message, threadId: result.threadId, usage: result.usage }, null, 2))
      } else {
        console.log()
        console.log('─'.repeat(60))
        console.log()
        console.log(chalk.green('Agent:'))
        console.log(result.message)
        console.log()
        if (options.verbose) {
          console.log(chalk.dim(`Thread: ${result.threadId}`))
          console.log(chalk.dim(`Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out (${result.usage.totalTokens} total)`))
          console.log(chalk.dim('Tool call details available in dashboard'))
        } else {
          console.log(chalk.dim(`Thread: ${result.threadId} | Tokens: ${result.usage.totalTokens}`))
        }
        console.log()
        console.log('─'.repeat(60))
      }
      return
    }

    console.log(chalk.bold(`Chat with ${chalk.cyan(agentSlug)} (${environment})`))
    console.log(chalk.dim("Type 'exit' to quit"))
    console.log()

    let threadId = options.thread
    let processing = false
    let generation = 0
    let currentAbort: AbortController | null = null

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.setPrompt(chalk.cyan('You: '))
    rl.prompt()

    rl.on('SIGINT', () => {
      if (processing) {
        generation++
        if (currentAbort) {
          currentAbort.abort()
          currentAbort = null
        }
        spinner.stop()
        processing = false
        console.log()
        console.log(chalk.yellow('Cancelled'))
        console.log()
        rl.resume()
        rl.prompt()
      } else {
        rl.close()
      }
    })

    rl.on('line', async (input: string) => {
      const trimmed = input.trim()
      if (!trimmed) {
        rl.prompt()
        return
      }

      if (trimmed === 'exit' || trimmed === 'quit') {
        rl.close()
        return
      }

      if (processing) {
        return
      }

      generation++
      const thisGeneration = generation
      processing = true
      currentAbort = new AbortController()
      const signal = AbortSignal.any([currentAbort.signal, AbortSignal.timeout(120000)])
      rl.pause()
      spinner.start('Thinking...')

      let { result, error } = await doChat(trimmed, threadId, signal)

      if (thisGeneration !== generation) return

      if (error && isAuthError(error) && !nonInteractive) {
        spinner.fail('Session expired - re-authenticating...')
        clearCredentials()
        credentials = await performLogin()
        if (thisGeneration !== generation) return
        if (!credentials) {
          console.log(chalk.red('Authentication failed'))
          rl.close()
          return
        }
        currentAbort = new AbortController()
        const retrySignal = AbortSignal.any([currentAbort.signal, AbortSignal.timeout(120000)])
        const retry = await doChat(trimmed, threadId, retrySignal)
        if (thisGeneration !== generation) return
        result = retry.result
        error = retry.error
      }

      if (error) {
        spinner.fail('')
        console.log(chalk.red('Error:'), error)
        processing = false
        currentAbort = null
        rl.resume()
        rl.prompt()
        return
      }

      if (!result) {
        spinner.fail('No result returned')
        processing = false
        currentAbort = null
        rl.resume()
        rl.prompt()
        return
      }

      spinner.stop()
      threadId = result.threadId

      console.log()
      console.log(chalk.green('Agent:'))
      console.log(result.message)
      console.log()

      if (options.verbose) {
        console.log(chalk.dim(`Thread: ${result.threadId}`))
        console.log(chalk.dim(`Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out (${result.usage.totalTokens} total)`))
        console.log(chalk.dim('Tool call details available in dashboard'))
      } else {
        console.log(chalk.dim(`Tokens: ${result.usage.totalTokens}`))
      }

      console.log()
      processing = false
      currentAbort = null
      rl.resume()
      rl.prompt()
    })

    rl.on('close', () => {
      console.log()
      console.log(chalk.dim('Goodbye!'))
      process.exit(0)
    })
  })
