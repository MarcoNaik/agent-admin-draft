import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import chokidar from 'chokidar'
import { join } from 'path'
import { loadConfig } from '../utils/config'
import { loadAgent } from '../utils/agent'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { getSyncUrl } from '../utils/api'
import { hasProject, loadProject } from '../utils/project'

export const devCommand = new Command('dev')
  .description('Sync agent to development environment')
  .action(async () => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Struere Dev'))
    console.log()

    if (!hasProject(cwd)) {
      console.log(chalk.yellow('No struere.json found'))
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('struere init'), chalk.gray('to initialize this project'))
      console.log()
      process.exit(1)
    }

    const project = loadProject(cwd)
    if (!project) {
      console.log(chalk.red('Failed to load struere.json'))
      process.exit(1)
    }

    console.log(chalk.gray('Agent:'), chalk.cyan(project.agent.name))
    console.log()

    spinner.start('Loading configuration')
    await loadConfig(cwd)
    spinner.succeed('Configuration loaded')

    spinner.start('Loading agent')
    let agent = await loadAgent(cwd)
    spinner.succeed(`Agent "${agent.name}" loaded`)

    const credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      spinner.fail('Not logged in')
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('struere login'), chalk.gray('to authenticate'))
      console.log()
      process.exit(1)
    }

    spinner.start('Connecting to Struere Cloud')

    const syncUrl = getSyncUrl()
    const ws = new WebSocket(`${syncUrl}/v1/dev/sync`)

    let cloudUrl: string | null = null
    let isConnected = false

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'auth',
        apiKey: apiKey || credentials?.token
      }))
    }

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data as string) as {
        type: string
        url?: string
        level?: string
        message?: string
        code?: string
      }

      switch (data.type) {
        case 'authenticated':
          spinner.text = 'Syncing agent'
          const bundle = await bundleAgent(cwd)
          const configHash = hashString(bundle)
          ws.send(JSON.stringify({
            type: 'sync',
            agentId: project.agentId,
            agentSlug: project.agent.slug,
            bundle,
            configHash
          }))
          break

        case 'synced':
          isConnected = true
          cloudUrl = data.url || null
          spinner.succeed('Synced to development')
          console.log()
          console.log(chalk.green('Development URL:'), chalk.cyan(cloudUrl))
          console.log()
          console.log(chalk.gray('Watching for changes... Press Ctrl+C to stop'))
          console.log()
          break

        case 'log':
          const logColor = data.level === 'error' ? chalk.red
            : data.level === 'warn' ? chalk.yellow
            : data.level === 'debug' ? chalk.gray
            : chalk.blue
          console.log(logColor(`[${data.level}]`), data.message)
          break

        case 'error':
          spinner.fail(`Error: ${data.message}`)
          if (data.code === 'INVALID_API_KEY' || data.code === 'NOT_AUTHENTICATED') {
            console.log()
            console.log(chalk.gray('Run'), chalk.cyan('struere login'), chalk.gray('to authenticate'))
          }
          break
      }
    }

    ws.onerror = () => {
      spinner.fail('Connection error')
    }

    ws.onclose = () => {
      if (isConnected) {
        console.log(chalk.yellow('Disconnected from cloud'))
      }
    }

    const watcher = chokidar.watch([join(cwd, 'src'), join(cwd, 'struere.config.ts')], {
      ignoreInitial: true,
      ignored: /node_modules/,
    })

    watcher.on('change', async (path) => {
      const relativePath = path.replace(cwd, '.')
      console.log(chalk.gray(`Changed: ${relativePath}`))
      try {
        agent = await loadAgent(cwd)
        const bundle = await bundleAgent(cwd)
        const configHash = hashString(bundle)

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'sync',
            agentId: project.agentId,
            agentSlug: project.agent.slug,
            bundle,
            configHash
          }))
        }
      } catch (error) {
        console.log(chalk.red('Sync failed:'), error)
      }
    })

    process.on('SIGINT', () => {
      console.log()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsync' }))
        ws.close()
      }
      watcher.close()
      console.log(chalk.gray('Stopped'))
      process.exit(0)
    })
  })

async function bundleAgent(cwd: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(cwd, 'src', 'agent.ts')],
    target: 'browser',
    minify: true
  })

  if (!result.success) {
    throw new Error('Bundle failed: ' + result.logs.join('\n'))
  }

  return await result.outputs[0].text()
}

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}
