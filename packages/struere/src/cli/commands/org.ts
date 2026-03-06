import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { input, confirm } from '@inquirer/prompts'
import { loadCredentials } from '../utils/credentials'
import { listMyOrganizations, createOrganization, OrgInfo } from '../utils/convex'
import { refreshToken } from '../utils/convex'
import { slugify } from './init'
import { isInteractive } from '../utils/runtime'

export async function promptCreateOrg(token: string): Promise<OrgInfo | null> {
  if (!isInteractive()) {
    console.log(chalk.red('No organizations found. Run struere org create to create one.'))
    return null
  }

  const shouldCreate = await confirm({
    message: 'No organizations found. Create one now?',
    default: true,
  })

  if (!shouldCreate) return null

  const name = await input({
    message: 'Organization name:',
    validate: (v) => v.trim().length > 0 || 'Name is required',
  })

  const slug = slugify(name.trim())
  const spinner = ora()
  spinner.start('Creating organization')

  const { organization, error } = await createOrganization(token, name.trim(), slug)

  if (error || !organization) {
    spinner.fail('Failed to create organization')
    console.log(chalk.red(error || 'Unknown error'))
    return null
  }

  spinner.succeed(`Created organization ${chalk.cyan(organization.name)} (${organization.slug})`)
  return organization
}

export const orgCommand = new Command('org')
  .description('Manage organizations')

orgCommand
  .command('list')
  .description('List your organizations')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    const credentials = loadCredentials()
    if (!credentials) {
      console.log(chalk.red('Not authenticated. Run struere login first.'))
      process.exit(1)
    }

    await refreshToken()
    const fresh = loadCredentials()
    const token = fresh?.token || credentials.token

    const spinner = ora()
    spinner.start('Fetching organizations')

    const { organizations, error } = await listMyOrganizations(token)

    if (error) {
      spinner.fail('Failed to fetch organizations')
      console.log(chalk.red(error))
      process.exit(1)
    }

    spinner.stop()

    if (options.json) {
      console.log(JSON.stringify(organizations, null, 2))
      return
    }

    if (organizations.length === 0) {
      console.log(chalk.yellow('No organizations found.'))
      console.log(chalk.gray('Run'), chalk.cyan('struere org create'), chalk.gray('to create one.'))
      return
    }

    console.log()
    console.log(chalk.bold('Organizations'))
    console.log()
    for (const org of organizations) {
      console.log(`  ${chalk.cyan(org.name)} ${chalk.gray(`(${org.slug})`)} ${chalk.gray(`- ${org.role}`)}`)
    }
    console.log()
  })

orgCommand
  .command('create')
  .argument('[name]', 'Organization name')
  .description('Create a new organization')
  .option('--slug <slug>', 'Custom slug')
  .option('--json', 'Output as JSON')
  .action(async (nameArg: string | undefined, options: { slug?: string; json?: boolean }) => {
    const credentials = loadCredentials()
    if (!credentials) {
      console.log(chalk.red('Not authenticated. Run struere login first.'))
      process.exit(1)
    }

    await refreshToken()
    const fresh = loadCredentials()
    const token = fresh?.token || credentials.token

    let name = nameArg
    if (!name) {
      if (!isInteractive()) {
        console.log(chalk.red('Organization name is required in non-interactive mode.'))
        process.exit(1)
      }
      name = await input({
        message: 'Organization name:',
        validate: (v) => v.trim().length > 0 || 'Name is required',
      })
    }

    name = name.trim()
    const slug = options.slug || slugify(name)

    const spinner = ora()
    spinner.start('Creating organization')

    const { organization, error } = await createOrganization(token, name, slug)

    if (error || !organization) {
      spinner.fail('Failed to create organization')
      console.log(chalk.red(error || 'Unknown error'))
      process.exit(1)
    }

    spinner.stop()

    if (options.json) {
      console.log(JSON.stringify(organization, null, 2))
      return
    }

    console.log(chalk.green('✓'), `Created organization ${chalk.cyan(organization.name)} (${organization.slug})`)
    console.log()
    console.log(chalk.gray('Next steps:'))
    console.log(chalk.gray('  •'), chalk.cyan('struere init'), chalk.gray('- Initialize a project'))
    console.log()
  })
