import { Command } from 'commander'
import chalk from 'chalk'
import { readFileSync } from 'fs'
import { confirm } from '@inquirer/prompts'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { hasProject } from '../utils/project'
import { performLogin } from './login'
import { runInit } from './init'
import { isInteractive, createOutput } from '../utils/runtime'
import {
  listWhatsAppConnections,
  listTemplates,
  createTemplate,
  deleteTemplate,
  getTemplateStatus,
} from '../utils/whatsapp'
import { renderTable } from '../utils/table'

type Environment = 'development' | 'production'

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

async function resolveConnectionId(env: Environment, connectionIdFlag?: string): Promise<string> {
  if (connectionIdFlag) return connectionIdFlag

  const out = createOutput()
  out.start('Fetching WhatsApp connections')
  const { data, error } = await listWhatsAppConnections(env)

  if (error || !data) {
    out.fail('Failed to fetch connections')
    out.error(error ?? 'Unknown error')
    process.exit(1)
  }

  const connections = data as Array<{ _id: string; status: string; phoneNumber?: string; label?: string }>
  const connected = connections.filter((c) => c.status === 'connected')

  if (connected.length === 0) {
    out.fail('No connected WhatsApp numbers found')
    out.info('Connect a phone number in the dashboard first')
    process.exit(1)
  }

  if (connected.length === 1) {
    const c = connected[0]
    const label = c.label || (c.phoneNumber ? `+${c.phoneNumber}` : c._id)
    out.succeed(`Using connection: ${label}`)
    return c._id
  }

  if (!isInteractive()) {
    const c = connected[0]
    const label = c.label || (c.phoneNumber ? `+${c.phoneNumber}` : c._id)
    out.succeed(`Auto-selected connection: ${label}`)
    return c._id
  }

  out.succeed(`Found ${connected.length} connections`)
  console.log()
  for (let i = 0; i < connected.length; i++) {
    const c = connected[i]
    const label = c.label || (c.phoneNumber ? `+${c.phoneNumber}` : 'Unknown')
    console.log(`  ${chalk.cyan(String(i + 1))}. ${label} ${chalk.gray(`(${c._id.slice(-12)})`)}`)
  }
  console.log()
  console.log(chalk.yellow('Multiple connections found. Use --connection <id> to specify one.'))
  process.exit(1)
}

function statusColor(status: string): string {
  switch (status?.toUpperCase()) {
    case 'APPROVED': return chalk.green(status)
    case 'PENDING': return chalk.yellow(status)
    case 'REJECTED': return chalk.red(status)
    case 'PAUSED': return chalk.hex('#FF8800')(status)
    default: return chalk.gray(status)
  }
}

export const templatesCommand = new Command('templates')
  .description('Manage WhatsApp message templates')

templatesCommand
  .command('list')
  .description('List all message templates')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--connection <id>', 'WhatsApp connection ID')
  .option('--json', 'Output raw JSON')
  .action(async (opts) => {
    await ensureAuth()
    const env = opts.env as Environment
    const connectionId = await resolveConnectionId(env, opts.connection)

    const out = createOutput()
    out.start('Fetching templates')
    const { data, error } = await listTemplates(connectionId, env)

    if (error) {
      out.fail('Failed to fetch templates')
      out.error(error)
      process.exit(1)
    }

    const result = data as { data?: Array<Record<string, unknown>> } | null
    const templates = result?.data ?? []
    out.succeed(`Found ${templates.length} templates`)

    if (opts.json) {
      console.log(JSON.stringify(templates, null, 2))
      return
    }

    console.log()

    if (templates.length === 0) {
      console.log(chalk.gray('  No templates found'))
      console.log()
      return
    }

    renderTable(
      [
        { key: 'name', label: 'Name', width: 30 },
        { key: 'category', label: 'Category', width: 16 },
        { key: 'language', label: 'Language', width: 10 },
        { key: 'status', label: 'Status', width: 12 },
      ],
      templates.map((t) => ({
        name: t.name,
        category: t.category,
        language: t.language,
        status: statusColor(String(t.status ?? '')),
      }))
    )
    console.log()
  })

templatesCommand
  .command('create <name>')
  .description('Create a new message template')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--connection <id>', 'WhatsApp connection ID')
  .option('--language <code>', 'Language code', 'en_US')
  .option('--category <cat>', 'Category (UTILITY|MARKETING|AUTHENTICATION)', 'UTILITY')
  .option('--components <json>', 'Components as JSON string')
  .option('--file <path>', 'Read components from a JSON file')
  .option('--allow-category-change', 'Allow Meta to reassign category')
  .option('--json', 'Output raw JSON')
  .action(async (name, opts) => {
    await ensureAuth()
    const env = opts.env as Environment
    const connectionId = await resolveConnectionId(env, opts.connection)

    let components: Array<Record<string, unknown>>

    if (opts.file) {
      try {
        const fileContent = readFileSync(opts.file, 'utf-8')
        const parsed = JSON.parse(fileContent)
        components = Array.isArray(parsed) ? parsed : parsed.components ?? [parsed]
      } catch (err) {
        console.log(chalk.red('Failed to read components file:'), err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    } else if (opts.components) {
      try {
        components = JSON.parse(opts.components)
      } catch {
        console.log(chalk.red('Invalid JSON in --components'))
        process.exit(1)
      }
    } else {
      console.log(chalk.red('Provide --components <json> or --file <path>'))
      process.exit(1)
    }

    if (!Array.isArray(components)) {
      console.log(chalk.red('Components must be a JSON array'))
      process.exit(1)
    }

    const out = createOutput()
    out.start(`Creating template "${name}"`)
    const { data, error } = await createTemplate(
      connectionId,
      env,
      name,
      opts.language,
      opts.category.toUpperCase(),
      components,
      opts.allowCategoryChange
    )

    if (error) {
      out.fail('Failed to create template')
      out.error(error)
      process.exit(1)
    }

    const result = data as { id: string; status: string; category: string }
    out.succeed(`Template "${name}" created`)

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log()
      console.log(`  ${chalk.gray('ID:')}       ${result.id}`)
      console.log(`  ${chalk.gray('Status:')}   ${statusColor(result.status)}`)
      console.log(`  ${chalk.gray('Category:')} ${result.category}`)
      console.log()
    }
  })

templatesCommand
  .command('delete <name>')
  .description('Delete a message template')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--connection <id>', 'WhatsApp connection ID')
  .option('--yes', 'Skip confirmation')
  .action(async (name, opts) => {
    await ensureAuth()
    const env = opts.env as Environment
    const connectionId = await resolveConnectionId(env, opts.connection)

    if (!opts.yes && isInteractive()) {
      const confirmed = await confirm({
        message: `Delete template "${name}"? This cannot be undone.`,
        default: false,
      })
      if (!confirmed) {
        console.log(chalk.gray('Cancelled'))
        return
      }
    }

    const out = createOutput()
    out.start(`Deleting template "${name}"`)
    const { error } = await deleteTemplate(connectionId, env, name)

    if (error) {
      out.fail('Failed to delete template')
      out.error(error)
      process.exit(1)
    }

    out.succeed(`Template "${name}" deleted`)
    console.log()
  })

templatesCommand
  .command('status <name>')
  .description('Check template approval status')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--connection <id>', 'WhatsApp connection ID')
  .option('--json', 'Output raw JSON')
  .action(async (name, opts) => {
    await ensureAuth()
    const env = opts.env as Environment
    const connectionId = await resolveConnectionId(env, opts.connection)

    const out = createOutput()
    out.start(`Checking status for "${name}"`)
    const { data, error } = await getTemplateStatus(connectionId, env, name)

    if (error) {
      out.fail('Failed to fetch template status')
      out.error(error)
      process.exit(1)
    }

    const result = data as { data?: Array<Record<string, unknown>> } | null
    const templates = result?.data ?? []

    if (templates.length === 0) {
      out.fail(`Template "${name}" not found`)
      process.exit(1)
    }

    out.succeed(`Template "${name}" found`)

    if (opts.json) {
      console.log(JSON.stringify(templates, null, 2))
      return
    }

    console.log()
    for (const t of templates) {
      console.log(`  ${chalk.gray('Name:')}       ${t.name}`)
      console.log(`  ${chalk.gray('Status:')}     ${statusColor(String(t.status ?? ''))}`)
      console.log(`  ${chalk.gray('Category:')}   ${t.category}`)
      console.log(`  ${chalk.gray('Language:')}   ${t.language}`)
      if (t.components) {
        console.log(`  ${chalk.gray('Components:')} ${JSON.stringify(t.components, null, 2).split('\n').join('\n               ')}`)
      }
      console.log()
    }
  })
