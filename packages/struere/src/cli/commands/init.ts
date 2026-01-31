import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { basename } from 'path'
import { loadCredentials } from '../utils/credentials'
import { performLogin } from './login'
import { hasProject, saveProjectV2, getProjectVersion } from '../utils/project'
import { scaffoldProjectV2 } from '../utils/scaffold'

export const initCommand = new Command('init')
  .description('Initialize a new Struere organization project')
  .argument('[project-name]', 'Project name')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (projectNameArg: string | undefined, options: { yes?: boolean }) => {
    const cwd = process.cwd()
    const spinner = ora()

    console.log()
    console.log(chalk.bold('Struere CLI'))
    console.log()

    if (hasProject(cwd)) {
      const version = getProjectVersion(cwd)
      if (version === '2.0') {
        console.log(chalk.yellow('This project is already initialized (v2.0).'))
        console.log()
        console.log(chalk.gray('Run'), chalk.cyan('struere dev'), chalk.gray('to start development'))
        console.log()
        return
      } else if (version === '1.0') {
        console.log(chalk.yellow('This is a v1 agent-centric project.'))
        console.log(chalk.yellow('The new CLI uses an organization-centric structure.'))
        console.log()
        console.log(chalk.gray('Please create a new project directory for the v2 structure.'))
        console.log()
        return
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
      console.log(chalk.gray('  Organization:'), chalk.cyan(credentials.organization.name))
      console.log()
    }

    if (!options.yes) {
      const confirmed = await promptYesNo(`Initialize project for organization "${credentials.organization.name}"?`)
      if (!confirmed) {
        console.log()
        console.log(chalk.gray('Cancelled'))
        return
      }
    }

    let projectName = projectNameArg
    if (!projectName) {
      projectName = slugify(basename(cwd))
      if (!options.yes) {
        const confirmed = await promptText('Project name:', projectName)
        projectName = confirmed || projectName
      }
    }

    projectName = slugify(projectName)

    spinner.start('Creating project structure')

    const scaffoldResult = scaffoldProjectV2(cwd, {
      projectName,
      orgId: credentials.organization.id,
      orgSlug: credentials.organization.slug,
      orgName: credentials.organization.name,
    })

    spinner.succeed('Project structure created')

    for (const file of scaffoldResult.createdFiles) {
      console.log(chalk.green('✓'), `Created ${file}`)
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

    console.log()
    console.log(chalk.green('Success!'), 'Project initialized')
    console.log()
    console.log(chalk.gray('Project structure:'))
    console.log(chalk.gray('  agents/       '), chalk.cyan('Agent definitions'))
    console.log(chalk.gray('  entity-types/ '), chalk.cyan('Entity type schemas'))
    console.log(chalk.gray('  roles/        '), chalk.cyan('Role + permission definitions'))
    console.log(chalk.gray('  tools/        '), chalk.cyan('Shared custom tools'))
    console.log()
    console.log(chalk.gray('Next steps:'))
    console.log(chalk.gray('  1.'), chalk.cyan('struere add agent my-agent'), chalk.gray('- Create an agent'))
    console.log(chalk.gray('  2.'), chalk.cyan('struere dev'), chalk.gray('- Start development'))
    console.log()
  })

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
