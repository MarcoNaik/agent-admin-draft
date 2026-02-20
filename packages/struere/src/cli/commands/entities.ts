import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { input, confirm } from '@inquirer/prompts'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { performLogin } from './login'
import { runInit } from './init'
import {
  queryEntityTypes,
  queryEntityTypeBySlug,
  queryEntities,
  queryEntity,
  searchEntities,
  createEntity,
  updateEntity,
  removeEntity,
} from '../utils/entities'
import { renderTable, deriveColumnsFromSchema } from '../utils/table'

type Environment = 'development' | 'production'

async function ensureAuth(): Promise<boolean> {
  const cwd = process.cwd()

  if (!hasProject(cwd)) {
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

function flattenEntityForTable(entity: Record<string, unknown>): Record<string, unknown> {
  const data = entity.data as Record<string, unknown> | undefined
  return {
    _id: (entity._id as string)?.slice(-12) ?? '',
    ...data,
    status: entity.status,
  }
}

export const entitiesCommand = new Command('entities')
  .description('Manage entity data')

entitiesCommand
  .command('types')
  .description('List available entity types')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--json', 'Output raw JSON')
  .action(async (opts) => {
    await ensureAuth()
    const spinner = ora()
    const env = opts.env as Environment

    spinner.start('Fetching entity types')
    const { data, error } = await queryEntityTypes(env)

    if (error || !data) {
      spinner.fail('Failed to fetch entity types')
      console.log(chalk.red('Error:'), error)
      process.exit(1)
    }

    spinner.succeed('Entity types loaded')

    const types = data as Array<Record<string, unknown>>

    if (opts.json) {
      console.log(JSON.stringify(types, null, 2))
      return
    }

    console.log()
    renderTable(
      [
        { key: 'name', label: 'Name', width: 20 },
        { key: 'slug', label: 'Slug', width: 20 },
        { key: 'fieldCount', label: 'Fields', width: 8, align: 'right' },
        { key: 'searchFields', label: 'Search Fields', width: 30 },
      ],
      types.map((t) => {
        const schema = t.schema as { properties?: Record<string, unknown> } | undefined
        return {
          name: t.name,
          slug: t.slug,
          fieldCount: schema?.properties ? Object.keys(schema.properties).length : 0,
          searchFields: (t.searchFields as string[] | undefined)?.join(', ') ?? '',
        }
      })
    )
    console.log()
  })

entitiesCommand
  .command('list <type>')
  .description('List entities of a type')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--status <status>', 'Filter by status')
  .option('--limit <n>', 'Maximum results', '50')
  .option('--json', 'Output raw JSON')
  .action(async (type, opts) => {
    await ensureAuth()
    const spinner = ora()
    const env = opts.env as Environment

    spinner.start(`Fetching ${type} entities`)

    const [entitiesResult, typeResult] = await Promise.all([
      queryEntities(type, env, {
        status: opts.status,
        limit: parseInt(opts.limit, 10),
      }),
      queryEntityTypeBySlug(type, env),
    ])

    if (entitiesResult.error || !entitiesResult.data) {
      spinner.fail(`Failed to fetch ${type} entities`)
      console.log(chalk.red('Error:'), entitiesResult.error)
      process.exit(1)
    }

    const entities = entitiesResult.data as Array<Record<string, unknown>>
    spinner.succeed(`Found ${entities.length} ${type} entities`)

    if (opts.json) {
      console.log(JSON.stringify(entities, null, 2))
      return
    }

    console.log()

    const entityType = typeResult.data as Record<string, unknown> | undefined
    const schema = entityType?.schema as { properties?: Record<string, unknown> } | undefined
    const displayConfig = entityType?.displayConfig as { columns?: string[] } | undefined
    const columns = deriveColumnsFromSchema(schema ?? {}, displayConfig ?? undefined)

    renderTable(columns, entities.map(flattenEntityForTable))
    console.log()
  })

entitiesCommand
  .command('get <id>')
  .description('Get entity details')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--json', 'Output raw JSON')
  .action(async (id, opts) => {
    await ensureAuth()
    const spinner = ora()
    const env = opts.env as Environment

    spinner.start('Fetching entity')
    const { data, error } = await queryEntity(id, env)

    if (error || !data) {
      spinner.fail('Failed to fetch entity')
      console.log(chalk.red('Error:'), error || 'Entity not found')
      process.exit(1)
    }

    spinner.succeed('Entity loaded')

    const result = data as { entity: Record<string, unknown>; entityType: Record<string, unknown> }

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    const entity = result.entity
    const entityType = result.entityType
    const entityData = entity.data as Record<string, unknown> | undefined

    console.log()
    console.log(chalk.bold(`${entityType.name}`) + chalk.gray(` (${entityType.slug})`))
    console.log(chalk.gray('─'.repeat(50)))
    console.log(`  ${chalk.gray('ID:')}        ${entity._id}`)
    console.log(`  ${chalk.gray('Status:')}    ${entity.status}`)
    console.log(`  ${chalk.gray('Created:')}   ${new Date(entity.createdAt as number).toLocaleString()}`)
    console.log(`  ${chalk.gray('Updated:')}   ${new Date(entity.updatedAt as number).toLocaleString()}`)
    console.log()
    console.log(chalk.bold('  Data'))
    console.log(chalk.gray('  ' + '─'.repeat(48)))

    if (entityData) {
      const maxKeyLen = Math.max(...Object.keys(entityData).map((k) => k.length))
      for (const [key, value] of Object.entries(entityData)) {
        const display = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
        console.log(`  ${chalk.gray(key.padEnd(maxKeyLen))}  ${display}`)
      }
    }
    console.log()
  })

entitiesCommand
  .command('create <type>')
  .description('Create a new entity')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--data <json>', 'Entity data as JSON')
  .option('--status <status>', 'Initial status')
  .option('--json', 'Output raw JSON')
  .action(async (type, opts) => {
    await ensureAuth()
    const spinner = ora()
    const env = opts.env as Environment

    let data: Record<string, unknown>

    if (opts.data) {
      try {
        data = JSON.parse(opts.data)
      } catch {
        console.log(chalk.red('Invalid JSON in --data'))
        process.exit(1)
      }
    } else {
      spinner.start(`Fetching ${type} schema`)
      const { data: typeData, error } = await queryEntityTypeBySlug(type, env)

      if (error || !typeData) {
        spinner.fail(`Entity type not found: ${type}`)
        console.log(chalk.red('Error:'), error || 'Not found')
        process.exit(1)
      }

      spinner.succeed(`Schema loaded for ${type}`)
      console.log()

      const entityType = typeData as Record<string, unknown>
      const schema = entityType.schema as { properties?: Record<string, SchemaProperty>; required?: string[] } | undefined

      if (!schema?.properties) {
        console.log(chalk.red('Entity type has no schema properties defined'))
        process.exit(1)
      }

      data = {}
      for (const [key, prop] of Object.entries(schema.properties)) {
        const isRequired = schema.required?.includes(key)
        const label = isRequired ? `${key} ${chalk.red('*')}` : key
        const hint = prop.type ? chalk.gray(` (${prop.type})`) : ''

        const value = await input({
          message: `${label}${hint}:`,
        })

        if (value === '' && !isRequired) continue

        if (prop.type === 'number') {
          data[key] = Number(value)
        } else if (prop.type === 'boolean') {
          data[key] = value.toLowerCase() === 'true'
        } else if (prop.type === 'object' || prop.type === 'array') {
          try {
            data[key] = JSON.parse(value)
          } catch {
            data[key] = value
          }
        } else {
          data[key] = value
        }
      }

      console.log()
    }

    spinner.start(`Creating ${type} entity`)
    const { data: result, error } = await createEntity(type, data, env, opts.status)

    if (error) {
      spinner.fail('Failed to create entity')
      console.log(chalk.red('Error:'), error)
      process.exit(1)
    }

    spinner.succeed(`Entity created`)

    if (opts.json) {
      console.log(JSON.stringify({ id: result }, null, 2))
    } else {
      console.log()
      console.log(chalk.gray('  ID:'), chalk.cyan(String(result)))
      console.log()
    }
  })

entitiesCommand
  .command('update <id>')
  .description('Update an entity')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--data <json>', 'Update data as JSON')
  .option('--status <status>', 'New status')
  .option('--json', 'Output raw JSON')
  .action(async (id, opts) => {
    await ensureAuth()
    const spinner = ora()
    const env = opts.env as Environment

    if (!opts.data && !opts.status) {
      console.log(chalk.red('Provide --data and/or --status'))
      process.exit(1)
    }

    let data: Record<string, unknown> = {}
    if (opts.data) {
      try {
        data = JSON.parse(opts.data)
      } catch {
        console.log(chalk.red('Invalid JSON in --data'))
        process.exit(1)
      }
    }

    spinner.start('Updating entity')
    const { data: result, error } = await updateEntity(id, data, env, opts.status)

    if (error) {
      spinner.fail('Failed to update entity')
      console.log(chalk.red('Error:'), error)
      process.exit(1)
    }

    spinner.succeed('Entity updated')

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log()
      console.log(chalk.green('  Entity updated successfully'))
      console.log()
    }
  })

entitiesCommand
  .command('delete <id>')
  .description('Delete an entity')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--yes', 'Skip confirmation')
  .action(async (id, opts) => {
    await ensureAuth()
    const spinner = ora()
    const env = opts.env as Environment

    spinner.start('Fetching entity')
    const { data, error: fetchError } = await queryEntity(id, env)

    if (fetchError || !data) {
      spinner.fail('Failed to fetch entity')
      console.log(chalk.red('Error:'), fetchError || 'Entity not found')
      process.exit(1)
    }

    spinner.succeed('Entity loaded')

    const result = data as { entity: Record<string, unknown>; entityType: Record<string, unknown> }
    const entity = result.entity
    const entityType = result.entityType
    const entityData = entity.data as Record<string, unknown> | undefined

    console.log()
    console.log(chalk.bold(`  ${entityType.name}`), chalk.gray(`(${entity._id})`))

    if (entityData) {
      const preview = Object.entries(entityData).slice(0, 3)
      for (const [key, value] of preview) {
        console.log(`  ${chalk.gray(key + ':')} ${String(value ?? '')}`)
      }
    }
    console.log()

    if (!opts.yes) {
      const confirmed = await confirm({
        message: 'Are you sure you want to delete this entity?',
        default: false,
      })

      if (!confirmed) {
        console.log(chalk.gray('Cancelled'))
        return
      }
    }

    spinner.start('Deleting entity')
    const { error } = await removeEntity(id, env)

    if (error) {
      spinner.fail('Failed to delete entity')
      console.log(chalk.red('Error:'), error)
      process.exit(1)
    }

    spinner.succeed('Entity deleted')
    console.log()
  })

entitiesCommand
  .command('search <type> <query>')
  .description('Search entities')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--limit <n>', 'Maximum results', '25')
  .option('--json', 'Output raw JSON')
  .action(async (type, query, opts) => {
    await ensureAuth()
    const spinner = ora()
    const env = opts.env as Environment

    spinner.start(`Searching ${type} for "${query}"`)

    const [searchResult, typeResult] = await Promise.all([
      searchEntities(type, query, env, parseInt(opts.limit, 10)),
      queryEntityTypeBySlug(type, env),
    ])

    if (searchResult.error || !searchResult.data) {
      spinner.fail('Search failed')
      console.log(chalk.red('Error:'), searchResult.error)
      process.exit(1)
    }

    const entities = searchResult.data as Array<Record<string, unknown>>
    spinner.succeed(`Found ${entities.length} results`)

    if (opts.json) {
      console.log(JSON.stringify(entities, null, 2))
      return
    }

    console.log()

    const entityType = typeResult.data as Record<string, unknown> | undefined
    const schema = entityType?.schema as { properties?: Record<string, unknown> } | undefined
    const displayConfig = entityType?.displayConfig as { columns?: string[] } | undefined
    const columns = deriveColumnsFromSchema(schema ?? {}, displayConfig ?? undefined)

    renderTable(columns, entities.map(flattenEntityForTable))
    console.log()
  })

interface SchemaProperty {
  type?: string
  description?: string
}
