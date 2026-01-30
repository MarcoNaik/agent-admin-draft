import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { existsSync, readFileSync } from 'fs'
import { join, basename } from 'path'
import { loadCredentials, isLoggedIn } from '../utils/credentials'
import { performLogin } from './login'
import { listAgents, createAgent, syncToConvex } from '../utils/convex'
import { hasProject, saveProject, loadProject } from '../utils/project'
import { writeProjectConfig, scaffoldAgentFiles, hasAgentFiles } from '../utils/scaffold'

export const initCommand = new Command('init')
  .description('Initialize a new Struere project')
  .argument('[project-name]', 'Project name')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (projectNameArg: string | undefined, options: { yes?: boolean }) => {
    const cwd = process.cwd()
    const spinner = ora()

    console.log()
    console.log(chalk.bold('Struere CLI'))
    console.log()

    if (hasProject(cwd)) {
      const existingProject = loadProject(cwd)
      if (existingProject) {
        console.log(chalk.yellow('This project is already initialized.'))
        console.log()
        console.log(chalk.gray('  Agent:'), chalk.cyan(existingProject.agent.name))
        console.log(chalk.gray('  ID:'), chalk.gray(existingProject.agentId))
        console.log(chalk.gray('  Team:'), chalk.cyan(existingProject.team))
        console.log()

        const shouldRelink = await promptYesNo('Would you like to relink to a different agent?')
        if (!shouldRelink) {
          console.log()
          console.log(chalk.gray('Run'), chalk.cyan('struere dev'), chalk.gray('to start development'))
          console.log()
          return
        }
      }
    }

    let credentials = loadCredentials()
    if (!credentials) {
      console.log(chalk.gray('Authentication required'))
      console.log()
      credentials = await performLogin()
      if (!credentials) {
        console.log(chalk.red('Authentication failed'))
        process.exit(1)
      }
    } else {
      console.log(chalk.green('✓'), 'Logged in as', chalk.cyan(credentials.user.name || credentials.user.email))
      console.log()
    }

    let projectName = projectNameArg
    if (!projectName) {
      projectName = await deriveProjectName(cwd)
      if (!options.yes) {
        const confirmed = await promptText('Agent name:', projectName)
        projectName = confirmed || projectName
      }
    }

    projectName = slugify(projectName)

    spinner.start('Fetching agents')

    const { agents: existingAgents, error: listError } = await listAgents()
    if (listError) {
      spinner.fail('Failed to fetch agents')
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('struere login'), chalk.gray('to re-authenticate'))
      process.exit(1)
    }

    const agents = existingAgents.map(a => ({ id: a._id, name: a.name, slug: a.slug }))
    spinner.succeed(`Found ${agents.length} existing agent(s)`)

    let selectedAgent: { id: string; name: string; slug: string } | null = null
    let deploymentUrl = ''

    if (agents.length > 0 && !options.yes) {
      console.log()
      const choice = await promptChoice('Create new agent or link existing?', [
        { value: 'new', label: 'Create new agent' },
        ...agents.map((a) => ({ value: a.id, label: `${a.name} (${a.slug})` })),
      ])

      if (choice !== 'new') {
        selectedAgent = agents.find((a) => a.id === choice) || null
      }
    }

    if (!selectedAgent) {
      const displayName = projectName
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      spinner.start('Creating agent')

      const { agentId, error: createError } = await createAgent({
        name: displayName,
        slug: projectName,
        description: `${displayName} Agent`,
      })

      if (createError || !agentId) {
        spinner.fail('Failed to create agent')
        console.log()
        console.log(chalk.red('Error:'), createError || 'Unknown error')
        process.exit(1)
      }

      selectedAgent = { id: agentId, name: displayName, slug: projectName }
      deploymentUrl = `https://${projectName}-dev.struere.dev`
      spinner.succeed(`Created agent "${projectName}"`)
    } else {
      deploymentUrl = `https://${selectedAgent.slug}-dev.struere.dev`
      console.log()
      console.log(chalk.green('✓'), `Linked to "${selectedAgent.name}"`)
    }

    saveProject(cwd, {
      agentId: selectedAgent.id,
      team: credentials.organization.slug,
      agent: {
        slug: selectedAgent.slug,
        name: selectedAgent.name,
      },
    })
    console.log(chalk.green('✓'), 'Created struere.json')

    const configResult = writeProjectConfig(cwd, {
      projectName,
      agentId: selectedAgent.id,
      team: credentials.organization.slug,
      agentSlug: selectedAgent.slug,
      agentName: selectedAgent.name,
      deploymentUrl,
    })

    for (const file of configResult.createdFiles) {
      if (file !== 'struere.json') {
        console.log(chalk.green('✓'), `Created ${file}`)
      }
    }
    for (const file of configResult.updatedFiles) {
      console.log(chalk.green('✓'), `Updated ${file}`)
    }

    if (!hasAgentFiles(cwd)) {
      let shouldScaffold = options.yes

      if (!options.yes) {
        console.log()
        shouldScaffold = await promptYesNo('Scaffold starter files?')
      }

      if (shouldScaffold) {
        const scaffoldResult = scaffoldAgentFiles(cwd, projectName)
        console.log()
        for (const file of scaffoldResult.createdFiles) {
          console.log(chalk.green('✓'), `Created ${file}`)
        }
        for (const file of scaffoldResult.updatedFiles) {
          console.log(chalk.green('✓'), `Updated ${file}`)
        }
      }
    }

    console.log()
    spinner.start('Installing dependencies')

    const installResult = Bun.spawnSync(['bun', 'install'], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    if (installResult.exitCode === 0) {
      spinner.succeed('Dependencies installed')
    } else {
      spinner.warn('Could not install dependencies automatically')
      console.log(chalk.gray('  Run'), chalk.cyan('bun install'), chalk.gray('manually'))
    }

    spinner.start('Syncing initial config to Convex')

    const displayName = projectName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    const defaultConfig = {
      name: displayName,
      version: '0.1.0',
      systemPrompt: `You are ${displayName}, a helpful AI assistant. You help users with their questions and tasks.`,
      model: {
        provider: 'anthropic',
        name: 'claude-sonnet-4-20250514',
        temperature: 0.7,
        maxTokens: 4096,
      },
      tools: [] as Array<{
        name: string
        description: string
        parameters: unknown
        handlerCode?: string
        isBuiltin: boolean
      }>,
    }

    const syncResult = await syncToConvex(selectedAgent.id, defaultConfig)

    if (syncResult.success) {
      spinner.succeed('Initial config synced')
    } else {
      spinner.warn('Could not sync initial config')
      console.log(chalk.gray('  Run'), chalk.cyan('struere dev'), chalk.gray('to sync manually'))
    }

    console.log()
    console.log(chalk.green('Success!'), 'Project initialized')
    console.log()
    console.log(chalk.gray('Next steps:'))
    console.log(chalk.gray('  $'), chalk.cyan('struere dev'))
    console.log()
  })

export async function deriveProjectName(cwd: string): Promise<string> {
  const packageJsonPath = join(cwd, 'package.json')
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      if (pkg.name && typeof pkg.name === 'string') {
        return slugify(pkg.name)
      }
    } catch {
    }
  }
  return slugify(basename(cwd))
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function promptYesNo(message: string): Promise<boolean> {
  process.stdout.write(chalk.gray(`${message} (Y/n) `))

  const answer = await readLine()
  return answer === '' || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
}

async function promptText(message: string, defaultValue: string): Promise<string> {
  process.stdout.write(chalk.gray(`${message} `))
  process.stdout.write(chalk.cyan(`(${defaultValue}) `))

  const answer = await readLine()
  return answer || defaultValue
}

async function promptChoice(
  message: string,
  choices: Array<{ value: string; label: string }>
): Promise<string> {
  console.log(chalk.gray(message))
  console.log()

  for (let i = 0; i < choices.length; i++) {
    const prefix = i === 0 ? chalk.cyan('❯') : chalk.gray(' ')
    console.log(`${prefix} ${i + 1}. ${choices[i].label}`)
  }

  console.log()
  process.stdout.write(chalk.gray('Enter choice (1-' + choices.length + '): '))

  const answer = await readLine()
  const num = parseInt(answer, 10)
  if (num >= 1 && num <= choices.length) {
    return choices[num - 1].value
  }
  return choices[0].value
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    let buffer = ''

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false)
    }

    process.stdin.setEncoding('utf8')
    process.stdin.resume()

    const onData = (data: string) => {
      buffer += data
      if (buffer.includes('\n')) {
        process.stdin.removeListener('data', onData)
        process.stdin.pause()
        resolve(buffer.replace(/[\r\n]/g, '').trim())
      }
    }

    process.stdin.on('data', onData)
  })
}
