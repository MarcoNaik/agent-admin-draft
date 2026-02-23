import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { select } from '@inquirer/prompts'
import { basename } from 'path'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { performLogin } from './login'
import { hasProject } from '../utils/project'
import { scaffoldProject } from '../utils/scaffold'
import { listMyOrganizations, OrgInfo } from '../utils/convex'
import { generateTypeDeclarations } from '../utils/plugin'
import { generateDocs } from './docs'
import { isInteractive } from '../utils/runtime'

export async function runInit(cwd: string, selectedOrg?: OrgInfo): Promise<boolean> {
  const spinner = ora()
  const nonInteractive = !isInteractive()

  let credentials = loadCredentials()
  if (!credentials) {
    if (nonInteractive) {
      console.log(chalk.red('Not authenticated. Set STRUERE_API_KEY or run struere login.'))
      return false
    }
    console.log(chalk.yellow('Not logged in - authenticating...'))
    console.log()
    credentials = await performLogin()
    if (!credentials) {
      console.log(chalk.red('Authentication failed'))
      return false
    }
    console.log()
  }

  console.log(chalk.green('✓'), 'Logged in as', chalk.cyan(credentials.user.name || credentials.user.email))

  let org = selectedOrg
  if (!org) {
    const { organizations, error } = await listMyOrganizations(credentials.token)
    if (error) {
      console.log(chalk.red('Failed to fetch organizations:'), error)
      return false
    }

    if (organizations.length === 0) {
      console.log(chalk.red('No organizations found. Please create one in the dashboard first.'))
      return false
    }

    if (organizations.length === 1) {
      org = organizations[0]
    } else {
      org = await select({
        message: 'Select organization:',
        choices: organizations.map((o) => ({
          name: `${o.name} (${o.slug})`,
          value: o,
        })),
      })
    }
  }

  console.log(chalk.gray('  Organization:'), chalk.cyan(org.name))
  console.log()

  const projectName = slugify(basename(cwd))

  spinner.start('Creating project structure')

  const scaffoldResult = scaffoldProject(cwd, {
    projectName,
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
  })

  spinner.succeed('Project structure created')

  for (const file of scaffoldResult.createdFiles) {
    console.log(chalk.green('✓'), `Created ${file}`)
  }

  generateTypeDeclarations(cwd)
  console.log(chalk.green('✓'), 'Generated .struere/types.d.ts')

  try {
    const { generated } = await generateDocs(cwd, ['claude'])
    for (const file of generated) {
      console.log(chalk.green('✓'), `Created ${file}`)
    }
  } catch {
    console.log(chalk.yellow('⚠'), 'Could not fetch docs for CLAUDE.md')
  }

  console.log()
  console.log(chalk.green('✓'), 'Project initialized')

  return true
}

export const initCommand = new Command('init')
  .description('Initialize a new Struere organization project')
  .argument('[project-name]', 'Project name')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .option('--org <slug>', 'Organization slug')
  .action(async (projectNameArg: string | undefined, options: { yes?: boolean; org?: string }) => {
    const cwd = process.cwd()
    const spinner = ora()
    const nonInteractive = !isInteractive()

    console.log()
    console.log(chalk.bold('Struere CLI'))
    console.log()

    if (hasProject(cwd)) {
      console.log(chalk.yellow('This project is already initialized.'))
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('struere sync'), chalk.gray('to sync changes'))
      console.log()
      return
    }

    let credentials = loadCredentials()
    const apiKey = getApiKey()
    if (!credentials && !apiKey) {
      if (nonInteractive) {
        console.log(chalk.red('Not authenticated. Set STRUERE_API_KEY or run struere login.'))
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

    if (credentials) {
      console.log(chalk.green('✓'), 'Logged in as', chalk.cyan(credentials.user.name || credentials.user.email))
    }

    const { organizations, error } = await listMyOrganizations(credentials?.token || '')
    if (error) {
      console.log(chalk.red('Failed to fetch organizations:'), error)
      process.exit(1)
    }

    if (organizations.length === 0) {
      console.log(chalk.red('No organizations found. Please create one in the dashboard first.'))
      process.exit(1)
    }

    let selectedOrg: OrgInfo
    if (options.org) {
      const found = organizations.find((o) => o.slug === options.org)
      if (!found) {
        console.log(chalk.red(`Organization "${options.org}" not found.`))
        console.log(chalk.gray('Available:'), organizations.map((o) => o.slug).join(', '))
        process.exit(1)
      }
      selectedOrg = found
    } else if (organizations.length === 1) {
      selectedOrg = organizations[0]
    } else if (nonInteractive) {
      console.log(chalk.red('Multiple organizations found. Use --org <slug> to specify one.'))
      console.log(chalk.gray('Available:'), organizations.map((o) => o.slug).join(', '))
      process.exit(1)
    } else {
      selectedOrg = await select({
        message: 'Select organization:',
        choices: organizations.map((o) => ({
          name: `${o.name} (${o.slug})`,
          value: o,
        })),
      })
    }

    console.log(chalk.gray('  Organization:'), chalk.cyan(selectedOrg.name))
    console.log()

    let projectName = projectNameArg
    if (!projectName) {
      projectName = slugify(basename(cwd))
    }

    projectName = slugify(projectName)

    spinner.start('Creating project structure')

    const scaffoldResult = scaffoldProject(cwd, {
      projectName,
      orgId: selectedOrg.id,
      orgSlug: selectedOrg.slug,
      orgName: selectedOrg.name,
    })

    spinner.succeed('Project structure created')

    for (const file of scaffoldResult.createdFiles) {
      console.log(chalk.green('✓'), `Created ${file}`)
    }

    generateTypeDeclarations(cwd)
    console.log(chalk.green('✓'), 'Generated .struere/types.d.ts')

    try {
      const { generated } = await generateDocs(cwd, ['claude'])
      for (const file of generated) {
        console.log(chalk.green('✓'), `Created ${file}`)
      }
    } catch {
      console.log(chalk.yellow('⚠'), 'Could not fetch docs for CLAUDE.md')
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
    console.log(chalk.gray('  2.'), chalk.cyan('struere sync'), chalk.gray('- Sync to development'))
    console.log()
  })

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
