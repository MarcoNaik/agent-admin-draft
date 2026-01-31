import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import chokidar from 'chokidar'
import { join, basename } from 'path'
import { existsSync, writeFileSync } from 'fs'
import { loadConfig } from '../utils/config'
import { loadAgent } from '../utils/agent'
import { loadCredentials, getApiKey, clearCredentials } from '../utils/credentials'
import { hasProject, loadProject, saveProject } from '../utils/project'
import { scaffoldAgentFiles, hasAgentFiles } from '../utils/scaffold'
import { performLogin } from './login'
import { syncToConvex, extractConfig, listAgents, createAgent } from '../utils/convex'
import { getClaudeMD } from '../templates'

export const devCommand = new Command('dev')
  .description('Sync agent to development environment')
  .action(async () => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Struere Dev'))
    console.log()

    let project = loadProject(cwd)

    if (!hasProject(cwd)) {
      console.log(chalk.yellow('No struere.json found'))
      console.log()

      const setupResult = await interactiveSetup(cwd)
      if (!setupResult) {
        process.exit(0)
      }
      project = setupResult
    }

    project = loadProject(cwd)
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

    const claudeMdPath = join(cwd, 'CLAUDE.md')
    if (!existsSync(claudeMdPath)) {
      writeFileSync(claudeMdPath, getClaudeMD(project.agent.slug))
      console.log(chalk.green('✓'), 'Created CLAUDE.md')
    }

    let credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      console.log(chalk.gray('Authentication required'))
      console.log()
      credentials = await performLogin()
      if (!credentials) {
        console.log(chalk.red('Authentication failed'))
        process.exit(1)
      }
    }

    spinner.start('Syncing to Convex')

    const performSync = async () => {
      try {
        const config = extractConfig(agent)
        const result = await syncToConvex(project.agentId, config)

        if (!result.success) {
          throw new Error(result.error || 'Sync failed')
        }

        return true
      } catch (error) {
        throw error
      }
    }

    const isAuthError = (error: unknown): boolean => {
      const message = error instanceof Error ? error.message : String(error)
      return message.includes('Unauthenticated') ||
             message.includes('OIDC') ||
             message.includes('token') ||
             message.includes('expired')
    }

    try {
      await performSync()
      spinner.succeed('Synced to development')
    } catch (error) {
      if (isAuthError(error)) {
        spinner.fail('Session expired')
        console.log()
        console.log(chalk.gray('Re-authenticating...'))
        clearCredentials()
        credentials = await performLogin()
        if (!credentials) {
          console.log(chalk.red('Authentication failed'))
          process.exit(1)
        }
        spinner.start('Syncing to Convex')
        try {
          await performSync()
          spinner.succeed('Synced to development')
        } catch (retryError) {
          spinner.fail('Sync failed')
          console.log(chalk.red('Error:'), retryError instanceof Error ? retryError.message : String(retryError))
          process.exit(1)
        }
      } else {
        spinner.fail('Sync failed')
        console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    }

    const devUrl = `https://${project.agent.slug}-dev.struere.dev`
    console.log()
    console.log(chalk.green('Development URL:'), chalk.cyan(devUrl))
    console.log()
    console.log(chalk.gray('Watching for changes... Press Ctrl+C to stop'))
    console.log()

    const watcher = chokidar.watch([join(cwd, 'src'), join(cwd, 'struere.config.ts')], {
      ignoreInitial: true,
      ignored: /node_modules/,
    })

    watcher.on('change', async (path) => {
      const relativePath = path.replace(cwd, '.')
      console.log(chalk.gray(`Changed: ${relativePath}`))

      const syncSpinner = ora('Syncing...').start()
      try {
        agent = await loadAgent(cwd)
        await performSync()
        syncSpinner.succeed('Synced')
      } catch (error) {
        if (isAuthError(error)) {
          syncSpinner.fail('Session expired')
          console.log()
          console.log(chalk.gray('Re-authenticating...'))
          clearCredentials()
          const newCredentials = await performLogin()
          if (!newCredentials) {
            console.log(chalk.red('Authentication failed'))
            return
          }
          const retrySyncSpinner = ora('Syncing...').start()
          try {
            await performSync()
            retrySyncSpinner.succeed('Synced')
          } catch (retryError) {
            retrySyncSpinner.fail('Sync failed')
            console.log(chalk.red('Error:'), retryError instanceof Error ? retryError.message : String(retryError))
          }
        } else {
          syncSpinner.fail('Sync failed')
          console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
        }
      }
    })

    process.on('SIGINT', () => {
      console.log()
      watcher.close()
      console.log(chalk.gray('Stopped'))
      process.exit(0)
    })
  })

async function interactiveSetup(cwd: string): Promise<{
  agentId: string
  team: string
  agent: { slug: string; name: string }
} | null> {
  const spinner = ora()

  let credentials = loadCredentials()
  if (!credentials) {
    console.log(chalk.gray('Authentication required'))
    console.log()
    credentials = await performLogin()
    if (!credentials) {
      console.log(chalk.red('Authentication failed'))
      return null
    }
  } else {
    console.log(chalk.green('✓'), 'Logged in as', chalk.cyan(credentials.user.name))
    console.log()
  }

  spinner.start('Fetching agents')

  let { agents: existingAgents, error: listError } = await listAgents()

  if (listError) {
    const isAuthError = listError.includes('Unauthenticated') ||
                        listError.includes('OIDC') ||
                        listError.includes('token') ||
                        listError.includes('expired')

    if (isAuthError) {
      spinner.fail('Session expired')
      console.log()
      console.log(chalk.gray('Re-authenticating...'))
      clearCredentials()
      credentials = await performLogin()
      if (!credentials) {
        console.log(chalk.red('Authentication failed'))
        return null
      }
      spinner.start('Fetching agents')
      const retryResult = await listAgents()
      existingAgents = retryResult.agents
      listError = retryResult.error
    }

    if (listError) {
      spinner.fail('Failed to fetch agents')
      console.log()
      console.log(chalk.red('Error:'), listError)
      return null
    }
  }

  const agents = existingAgents.map(a => ({ id: a._id, name: a.name, slug: a.slug }))
  spinner.succeed(`Found ${agents.length} existing agent(s)`)

  let selectedAgent: { id: string; name: string; slug: string } | null = null

  if (agents.length === 0) {
    console.log(chalk.gray('No existing agents found. Creating a new one...'))
  } else {
    console.log()
    const choices = [
      { value: 'link', label: 'Link to an existing agent' },
      { value: 'create', label: 'Create a new agent' },
      { value: 'cancel', label: 'Cancel' },
    ]

    const action = await promptChoiceArrows('No agent configured. Would you like to:', choices)

    if (action === 'cancel') {
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('struere init'), chalk.gray('when ready to set up'))
      return null
    }

    if (action === 'link') {
      console.log()
      const agentChoices = agents.map((a) => ({ value: a.id, label: `${a.name} (${a.slug})` }))
      const agentId = await promptChoiceArrows('Select an agent:', agentChoices)
      selectedAgent = agents.find((a) => a.id === agentId) || null
    }
  }

  if (!selectedAgent) {
    console.log()
    const projectName = slugify(basename(cwd))
    const name = await promptText('Agent name:', projectName)

    const displayName = name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    spinner.start('Creating agent')

    let { agentId, error: createError } = await createAgent({
      name: displayName,
      slug: name,
      description: `${displayName} Agent`,
    })

    if (createError) {
      const isAuthError = createError.includes('Unauthenticated') ||
                          createError.includes('OIDC') ||
                          createError.includes('token') ||
                          createError.includes('expired')

      if (isAuthError) {
        spinner.fail('Session expired')
        console.log()
        console.log(chalk.gray('Re-authenticating...'))
        clearCredentials()
        credentials = await performLogin()
        if (!credentials) {
          console.log(chalk.red('Authentication failed'))
          return null
        }
        spinner.start('Creating agent')
        const retryResult = await createAgent({
          name: displayName,
          slug: name,
          description: `${displayName} Agent`,
        })
        agentId = retryResult.agentId
        createError = retryResult.error
      }
    }

    if (createError || !agentId) {
      spinner.fail('Failed to create agent')
      console.log()
      console.log(chalk.red('Error:'), createError || 'Unknown error')
      return null
    }

    selectedAgent = { id: agentId, name: displayName, slug: name }
    spinner.succeed(`Created agent "${name}"`)
  }

  if (!selectedAgent) {
    return null
  }

  const projectData = {
    agentId: selectedAgent.id,
    team: credentials.organization.slug,
    agent: {
      slug: selectedAgent.slug,
      name: selectedAgent.name,
    },
  }

  saveProject(cwd, projectData)
  console.log(chalk.green('✓'), 'Created struere.json')

  if (!hasAgentFiles(cwd)) {
    const scaffoldResult = scaffoldAgentFiles(cwd, selectedAgent.slug)
    for (const file of scaffoldResult.createdFiles) {
      console.log(chalk.green('✓'), `Created ${file}`)
    }
    console.log()

    spinner.start('Installing dependencies')
    try {
      const proc = Bun.spawn(['bun', 'install'], {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      await proc.exited
      if (proc.exitCode === 0) {
        spinner.succeed('Dependencies installed')
      } else {
        spinner.fail('Failed to install dependencies')
        console.log(chalk.yellow('Run'), chalk.cyan('bun install'), chalk.yellow('manually'))
      }
    } catch {
      spinner.fail('Failed to install dependencies')
      console.log(chalk.yellow('Run'), chalk.cyan('bun install'), chalk.yellow('manually'))
    }
  }

  console.log()

  return projectData
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function promptChoiceArrows(
  message: string,
  choices: Array<{ value: string; label: string }>
): Promise<string> {
  return new Promise((resolve) => {
    let selectedIndex = 0

    const render = () => {
      process.stdout.write('\x1B[?25l')
      process.stdout.write(`\x1B[${choices.length + 2}A`)
      console.log(chalk.gray(message))
      console.log()
      for (let i = 0; i < choices.length; i++) {
        const prefix = i === selectedIndex ? chalk.cyan('❯') : ' '
        const label = i === selectedIndex ? chalk.cyan(choices[i].label) : choices[i].label
        console.log(`${prefix} ${label}`)
      }
    }

    console.log(chalk.gray(message))
    console.log()
    for (let i = 0; i < choices.length; i++) {
      const prefix = i === selectedIndex ? chalk.cyan('❯') : ' '
      const label = i === selectedIndex ? chalk.cyan(choices[i].label) : choices[i].label
      console.log(`${prefix} ${label}`)
    }

    if (!process.stdin.isTTY) {
      resolve(choices[0].value)
      return
    }

    process.stdin.setRawMode?.(true)
    process.stdin.resume()

    const onKeypress = (key: Buffer) => {
      const char = key.toString()

      if (char === '\x1B[A' || char === 'k') {
        selectedIndex = (selectedIndex - 1 + choices.length) % choices.length
        render()
      } else if (char === '\x1B[B' || char === 'j') {
        selectedIndex = (selectedIndex + 1) % choices.length
        render()
      } else if (char === '\r' || char === '\n') {
        process.stdin.removeListener('data', onKeypress)
        process.stdin.setRawMode?.(false)
        process.stdin.pause()
        process.stdout.write('\x1B[?25h')
        resolve(choices[selectedIndex].value)
      } else if (char === '\x03') {
        process.stdin.removeListener('data', onKeypress)
        process.stdin.setRawMode?.(false)
        process.stdout.write('\x1B[?25h')
        process.exit(0)
      }
    }

    process.stdin.on('data', onKeypress)
  })
}

async function promptText(message: string, defaultValue: string): Promise<string> {
  process.stdout.write(chalk.gray(`${message} `))
  process.stdout.write(chalk.cyan(`(${defaultValue}) `))

  const answer = await readLine()
  return answer || defaultValue
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    let buffer = ''

    const onData = (chunk: Buffer) => {
      const str = chunk.toString()
      buffer += str

      if (str.includes('\n') || str.includes('\r')) {
        process.stdin.removeListener('data', onData)
        process.stdin.pause()
        process.stdin.setRawMode?.(false)
        resolve(buffer.replace(/[\r\n]/g, '').trim())
      }
    }

    if (process.stdin.isTTY) {
      process.stdin.setRawMode?.(false)
    }
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}
