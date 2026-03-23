import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { performLogin } from './login'
import { runInit } from './init'
import { isInteractive } from '../utils/runtime'
import {
  queryThreads,
  queryThreadDetail,
  queryThreadExecutions,
  resolveAgentSlug,
} from '../utils/logs'
import { renderTable } from '../utils/table'

function getOrgId(): string | undefined {
  const project = loadProject(process.cwd())
  return project?.organization.id
}

async function ensureAuth(): Promise<boolean> {
  const cwd = process.cwd()
  const nonInteractive = !isInteractive()

  if (!hasProject(cwd)) {
    if (nonInteractive) {
      console.error(chalk.red('No struere.json found. Run struere init first.'))
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

  let credentials = loadCredentials()
  const apiKey = getApiKey()

  if (!credentials && !apiKey) {
    if (nonInteractive) {
      console.error(chalk.red('Not authenticated. Set STRUERE_API_KEY or run struere login.'))
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

  return true
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toTimeString().slice(0, 8)
}

export const logsCommand = new Command('logs')
  .description('View and debug agent conversations')

logsCommand
  .command('list', { isDefault: true })
  .description('List recent conversations')
  .option('--env <environment>', 'Environment (development|production|eval)', 'development')
  .option('--agent <slug>', 'Filter by agent slug')
  .option('--channel <channel>', 'Filter by channel (api|whatsapp|widget|dashboard)')
  .option('--limit <n>', 'Maximum results', '20')
  .option('--json', 'Output raw JSON')
  .action(async (opts) => {
    await ensureAuth()
    const spinner = ora()
    const orgId = getOrgId()

    let agentId: string | undefined
    if (opts.agent) {
      spinner.start(`Resolving agent "${opts.agent}"`)
      const resolved = await resolveAgentSlug(opts.agent, orgId)
      if (resolved.error || !resolved.data) {
        spinner.fail('Agent not found')
        console.log(chalk.red('Error:'), resolved.error || `No agent matched "${opts.agent}"`)
        process.exit(1)
      }
      agentId = resolved.data
      spinner.succeed(`Agent resolved: ${opts.agent}`)
    }

    spinner.start('Fetching conversations')
    const { data, error } = await queryThreads({
      environment: opts.env,
      agentId,
      channel: opts.channel,
      limit: parseInt(opts.limit, 10),
    })

    if (error || !data) {
      spinner.fail('Failed to fetch conversations')
      console.log(chalk.red('Error:'), error)
      process.exit(1)
    }

    const threads = data as Array<Record<string, unknown>>
    spinner.succeed(`Found ${threads.length} conversations`)

    if (opts.json) {
      console.log(JSON.stringify(threads, null, 2))
      return
    }

    console.log()
    renderTable(
      [
        { key: 'id', label: 'ID', width: 14 },
        { key: 'agent', label: 'Agent', width: 18 },
        { key: 'channel', label: 'Channel', width: 10 },
        { key: 'participant', label: 'Participant', width: 18 },
        { key: 'lastMessage', label: 'Last Message', width: 40 },
        { key: 'time', label: 'Time', width: 10 },
      ],
      threads.map((t) => {
        const lastMsg = t.lastMessage as Record<string, unknown> | undefined
        return {
          id: (t._id as string)?.slice(-12) ?? '',
          agent: t.agentName ?? '',
          channel: t.channel ?? 'api',
          participant: t.participantName ?? '',
          lastMessage: lastMsg?.content ? String(lastMsg.content).slice(0, 60) : '',
          time: relativeTime((t.updatedAt ?? t.createdAt ?? Date.now()) as number),
        }
      })
    )
    console.log()
  })

logsCommand
  .command('view <thread-id>')
  .description('View conversation messages')
  .option('--exec', 'Include execution details')
  .option('--json', 'Output raw JSON')
  .option('--limit <n>', 'Message limit', '100')
  .action(async (threadId, opts) => {
    await ensureAuth()
    const spinner = ora()

    spinner.start('Fetching conversation')
    const { data, error } = await queryThreadDetail(threadId, parseInt(opts.limit, 10))

    if (error || !data) {
      spinner.fail('Failed to fetch conversation')
      console.log(chalk.red('Error:'), error || 'Thread not found')
      process.exit(1)
    }

    spinner.succeed('Conversation loaded')

    const result = data as Record<string, unknown>

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    console.log()
    console.log(chalk.bold(`Thread: ${result._id}`))
    console.log(chalk.gray(`  Environment: ${result.environment ?? 'unknown'}  Channel: ${result.channel ?? 'api'}`))
    console.log(chalk.gray('─'.repeat(60)))

    const messages = (result.messages ?? []) as Array<Record<string, unknown>>
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const ts = formatTimestamp((msg.createdAt ?? msg._creationTime ?? Date.now()) as number)
      const role = msg.role as string
      const content = (msg.content ?? '') as string
      const toolCalls = msg.toolCalls as Array<{ name: string; arguments: unknown }> | undefined

      if (role === 'user') {
        console.log()
        console.log(`  ${chalk.gray(`[${ts}]`)} ${chalk.cyan('User')}`)
        console.log(`  ${content}`)
      } else if (role === 'assistant' && toolCalls?.length) {
        console.log()
        console.log(`  ${chalk.gray(`[${ts}]`)} ${chalk.green('Agent')}`)
        if (content) console.log(`  ${content}`)
        for (const call of toolCalls) {
          console.log(`  ${chalk.yellow('Tool: ' + call.name)}`)
          console.log(`  ${chalk.dim('→ ' + JSON.stringify(call.arguments).slice(0, 200))}`)
        }
      } else if (role === 'assistant') {
        console.log()
        console.log(`  ${chalk.gray(`[${ts}]`)} ${chalk.green('Agent')}`)
        console.log(`  ${content}`)
      } else if (role === 'tool') {
        console.log(`  ${chalk.dim('← ' + content.slice(0, 200))}`)
      } else if (role === 'system') {
        console.log()
        console.log(`  ${chalk.dim('[System] ' + content.slice(0, 100))}`)
      }
    }

    console.log()

    if (opts.exec) {
      spinner.start('Fetching executions')
      const execResult = await queryThreadExecutions(threadId)

      if (execResult.error || !execResult.data) {
        spinner.fail('Failed to fetch executions')
        console.log(chalk.red('Error:'), execResult.error)
        return
      }

      spinner.succeed('Executions loaded')

      const executions = execResult.data as Array<Record<string, unknown>>

      console.log()
      console.log(chalk.bold('Executions'))
      console.log(chalk.gray('─'.repeat(60)))

      for (const exec of executions) {
        const status = exec.status as string
        const statusColor = status === 'success' ? chalk.green : status === 'error' ? chalk.red : chalk.yellow
        const toolCallDetails = exec.toolCallDetails as Array<{ name: string; durationMs: number; status: string }> | undefined

        console.log()
        console.log(`  ${chalk.gray('Status:')}   ${statusColor(status)}`)
        if (exec.model) console.log(`  ${chalk.gray('Model:')}    ${exec.model}`)
        if (exec.inputTokens || exec.outputTokens) console.log(`  ${chalk.gray('Tokens:')}   ${exec.inputTokens ?? 0} in / ${exec.outputTokens ?? 0} out`)
        if (exec.durationMs) console.log(`  ${chalk.gray('Duration:')} ${exec.durationMs}ms`)
        if (toolCallDetails?.length) {
          console.log(`  ${chalk.gray('Tools:')}    ${toolCallDetails.length} calls`)
          for (const tc of toolCallDetails) {
            console.log(`    ${tc.name} (${tc.durationMs}ms) -> ${tc.status}`)
          }
        }
        if (exec.errorMessage) {
          console.log(`  ${chalk.red('Error:')}    ${exec.errorMessage}`)
        }
      }

      console.log()
    }
  })
