import { Command } from 'commander'
import chalk from 'chalk'
import { hasProject, getProjectVersion } from '../utils/project'
import { scaffoldAgent, scaffoldEntityType, scaffoldRole } from '../utils/scaffold'
import { runInit } from './init'

export const addCommand = new Command('add')
  .description('Scaffold a new resource')
  .argument('<type>', 'Resource type: agent, entity-type, or role')
  .argument('<name>', 'Resource name')
  .action(async (type: string, name: string) => {
    const cwd = process.cwd()

    console.log()

    if (!hasProject(cwd)) {
      console.log(chalk.yellow('No struere.json found - initializing project...'))
      console.log()
      const success = await runInit(cwd)
      if (!success) {
        process.exit(1)
      }
      console.log()
    }

    const version = getProjectVersion(cwd)
    if (version === '1.0') {
      console.log(chalk.yellow('This is a v1 agent-centric project.'))
      console.log(chalk.yellow('The add command requires v2 structure.'))
      console.log()
      process.exit(1)
    }

    const slug = slugify(name)
    const displayName = name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    let result

    switch (type.toLowerCase()) {
      case 'agent':
        result = scaffoldAgent(cwd, displayName, slug)
        if (result.createdFiles.length > 0) {
          console.log(chalk.green('✓'), `Created agent "${displayName}"`)
          for (const file of result.createdFiles) {
            console.log(chalk.gray('  →'), file)
          }
        } else {
          console.log(chalk.yellow('Agent already exists:'), `agents/${slug}.ts`)
        }
        break

      case 'entity-type':
      case 'entitytype':
      case 'type':
        result = scaffoldEntityType(cwd, displayName, slug)
        if (result.createdFiles.length > 0) {
          console.log(chalk.green('✓'), `Created entity type "${displayName}"`)
          for (const file of result.createdFiles) {
            console.log(chalk.gray('  →'), file)
          }
        } else {
          console.log(chalk.yellow('Entity type already exists:'), `entity-types/${slug}.ts`)
        }
        break

      case 'role':
        result = scaffoldRole(cwd, slug)
        if (result.createdFiles.length > 0) {
          console.log(chalk.green('✓'), `Created role "${slug}"`)
          for (const file of result.createdFiles) {
            console.log(chalk.gray('  →'), file)
          }
        } else {
          console.log(chalk.yellow('Role already exists:'), `roles/${slug}.ts`)
        }
        break

      default:
        console.log(chalk.red('Unknown resource type:'), type)
        console.log()
        console.log('Available types:')
        console.log(chalk.gray('  -'), chalk.cyan('agent'), '- Create an AI agent')
        console.log(chalk.gray('  -'), chalk.cyan('entity-type'), '- Create an entity type schema')
        console.log(chalk.gray('  -'), chalk.cyan('role'), '- Create a role with permissions')
        console.log()
        process.exit(1)
    }

    console.log()
    console.log(chalk.gray('Run'), chalk.cyan('struere dev'), chalk.gray('to sync changes'))
    console.log()
  })

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
