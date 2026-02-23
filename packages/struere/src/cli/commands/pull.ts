import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { getPullState } from '../utils/convex'
import {
  generateAgentFile,
  generateEntityTypeFile,
  generateRoleFile,
  generateTriggerFile,
  generateToolsFile,
  generateIndexFile,
  collectCustomTools,
} from '../utils/generator'
import { performLogin } from './login'
import { runInit } from './init'
import { isInteractive } from '../utils/runtime'

export const pullCommand = new Command('pull')
  .description('Pull remote resources to local files')
  .option('--force', 'Overwrite existing local files')
  .option('--env <environment>', 'Environment to pull from', 'development')
  .option('--dry-run', 'Show what would be written without writing')
  .option('--json', 'Output raw JSON')
  .action(async (options: { force?: boolean; env: string; dryRun?: boolean; json?: boolean }) => {
    const spinner = ora()
    const cwd = process.cwd()
    const jsonMode = !!options.json
    const nonInteractive = !isInteractive()

    if (!jsonMode) {
      console.log()
      console.log(chalk.bold('Struere Pull'))
      console.log()
    }

    if (!hasProject(cwd)) {
      if (nonInteractive) {
        if (jsonMode) {
          console.log(JSON.stringify({ error: 'No struere.json found. Run struere init first.' }))
        } else {
          console.log(chalk.red('No struere.json found. Run struere init first.'))
        }
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

    const project = loadProject(cwd)
    if (!project) {
      if (jsonMode) {
        console.log(JSON.stringify({ error: 'Failed to load struere.json' }))
      } else {
        console.log(chalk.red('Failed to load struere.json'))
      }
      process.exit(1)
    }

    if (!jsonMode) {
      console.log(chalk.gray('Organization:'), chalk.cyan(project.organization.name))
      console.log(chalk.gray('Environment:'), chalk.cyan(options.env))
      console.log()
    }

    let credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      if (nonInteractive) {
        if (jsonMode) {
          console.log(JSON.stringify({ error: 'Not authenticated. Set STRUERE_API_KEY or run struere login.' }))
        } else {
          console.log(chalk.red('Not authenticated. Set STRUERE_API_KEY or run struere login.'))
        }
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

    if (!jsonMode) spinner.start('Fetching remote state')

    const environment = options.env as 'development' | 'production'
    const { state, error } = await getPullState(project.organization.id, environment)

    if (error || !state) {
      if (jsonMode) {
        console.log(JSON.stringify({ error: error || 'Failed to fetch remote state' }))
      } else {
        spinner.fail('Failed to fetch remote state')
        console.log(chalk.red('Error:'), error || 'Unknown error')
      }
      process.exit(1)
    }

    if (!jsonMode) {
      spinner.succeed('Remote state fetched')
      console.log()
    }

    const created: string[] = []
    const skipped: string[] = []

    const ensureDir = (dir: string) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }

    const writeOrSkip = (relativePath: string, content: string): boolean => {
      const fullPath = join(cwd, relativePath)
      if (existsSync(fullPath) && !options.force) {
        skipped.push(relativePath)
        return false
      }
      if (options.dryRun) {
        created.push(relativePath)
        return true
      }
      ensureDir(join(cwd, relativePath.split('/').slice(0, -1).join('/')))
      writeFileSync(fullPath, content)
      created.push(relativePath)
      return true
    }

    ensureDir(join(cwd, 'agents'))
    ensureDir(join(cwd, 'entity-types'))
    ensureDir(join(cwd, 'roles'))
    ensureDir(join(cwd, 'triggers'))
    ensureDir(join(cwd, 'tools'))

    const agentSlugs: string[] = []
    for (const agent of state.agents) {
      if (!agent.systemPrompt && agent.tools.length === 0) continue
      agentSlugs.push(agent.slug)
      const content = generateAgentFile(agent)
      writeOrSkip(`agents/${agent.slug}.ts`, content)
    }

    const entityTypeSlugs: string[] = []
    for (const et of state.entityTypes) {
      entityTypeSlugs.push(et.slug)
      const content = generateEntityTypeFile(et)
      writeOrSkip(`entity-types/${et.slug}.ts`, content)
    }

    const roleNames: string[] = []
    for (const role of state.roles) {
      roleNames.push(role.name)
      const content = generateRoleFile(role)
      writeOrSkip(`roles/${role.name}.ts`, content)
    }

    const triggerSlugs: string[] = []
    for (const trigger of state.triggers || []) {
      triggerSlugs.push(trigger.slug)
      const content = generateTriggerFile(trigger)
      writeOrSkip(`triggers/${trigger.slug}.ts`, content)
    }

    const customTools = collectCustomTools(state.agents)
    if (customTools.length > 0) {
      const content = generateToolsFile(customTools)
      writeOrSkip('tools/index.ts', content)
    }

    if (agentSlugs.length > 0) {
      const content = generateIndexFile('agents', agentSlugs)
      if (content) writeOrSkip('agents/index.ts', content)
    }

    if (entityTypeSlugs.length > 0) {
      const content = generateIndexFile('entity-types', entityTypeSlugs)
      if (content) writeOrSkip('entity-types/index.ts', content)
    }

    if (roleNames.length > 0) {
      const content = generateIndexFile('roles', roleNames)
      if (content) writeOrSkip('roles/index.ts', content)
    }

    if (triggerSlugs.length > 0) {
      const content = generateIndexFile('triggers', triggerSlugs)
      if (content) writeOrSkip('triggers/index.ts', content)
    }

    if (options.json) {
      console.log(JSON.stringify({
        created,
        skipped,
        dryRun: !!options.dryRun,
      }))
      return
    }

    if (options.dryRun) {
      console.log(chalk.cyan('Dry run - no files written'))
      console.log()
    }

    if (created.length > 0) {
      console.log(chalk.green(`${options.dryRun ? 'Would create' : 'Created'} ${created.length} files:`))
      for (const file of created) {
        console.log(chalk.gray('  +'), file)
      }
      console.log()
    }

    if (skipped.length > 0) {
      console.log(chalk.yellow(`Skipped ${skipped.length} existing files (use --force to overwrite):`))
      for (const file of skipped) {
        console.log(chalk.gray('  ~'), file)
      }
      console.log()
    }

    if (created.length === 0 && skipped.length === 0) {
      console.log(chalk.gray('No remote resources found.'))
      console.log()
    }

    if (!options.dryRun && created.length > 0) {
      console.log(chalk.gray('Run'), chalk.cyan('struere sync'), chalk.gray('to sync changes'))
      console.log()
    }
  })
