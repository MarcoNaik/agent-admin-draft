import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { hasProject, loadProjectV2, getProjectVersion } from '../utils/project'
import { getPullState } from '../utils/convex'
import {
  generateAgentFile,
  generateEntityTypeFile,
  generateRoleFile,
  generateToolsFile,
  generateIndexFile,
  collectCustomTools,
} from '../utils/generator'
import { performLogin } from './login'
import { runInit } from './init'

export const pullCommand = new Command('pull')
  .description('Pull remote resources to local files')
  .option('--force', 'Overwrite existing local files')
  .option('--env <environment>', 'Environment to pull from', 'development')
  .option('--include-pack-managed', 'Include pack-managed resources')
  .option('--dry-run', 'Show what would be written without writing')
  .action(async (options: { force?: boolean; env: string; includePackManaged?: boolean; dryRun?: boolean }) => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Struere Pull'))
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
      console.log(chalk.yellow('The pull command requires v2 structure.'))
      console.log()
      process.exit(1)
    }

    const project = loadProjectV2(cwd)
    if (!project) {
      console.log(chalk.red('Failed to load struere.json'))
      process.exit(1)
    }

    console.log(chalk.gray('Organization:'), chalk.cyan(project.organization.name))
    console.log(chalk.gray('Environment:'), chalk.cyan(options.env))
    console.log()

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

    spinner.start('Fetching remote state')

    const environment = options.env as 'development' | 'production'
    const { state, error } = await getPullState(project.organization.id, environment, options.includePackManaged ?? false)

    if (error || !state) {
      spinner.fail('Failed to fetch remote state')
      console.log(chalk.red('Error:'), error || 'Unknown error')
      process.exit(1)
    }

    spinner.succeed('Remote state fetched')
    console.log()

    const created: string[] = []
    const skipped: string[] = []
    const packManaged: string[] = []

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
      if (et.isPackManaged && !options.includePackManaged) {
        packManaged.push(`entity-types/${et.slug}.ts`)
        continue
      }
      entityTypeSlugs.push(et.slug)
      const content = generateEntityTypeFile(et)
      writeOrSkip(`entity-types/${et.slug}.ts`, content)
    }

    const roleNames: string[] = []
    for (const role of state.roles) {
      if (role.isPackManaged && !options.includePackManaged) {
        packManaged.push(`roles/${role.name}.ts`)
        continue
      }
      roleNames.push(role.name)
      const content = generateRoleFile(role)
      writeOrSkip(`roles/${role.name}.ts`, content)
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

    if (packManaged.length > 0) {
      console.log(chalk.gray(`Skipped ${packManaged.length} pack-managed resources (use --include-pack-managed to include):`))
      for (const file of packManaged) {
        console.log(chalk.gray('  ·'), file)
      }
      console.log()
    }

    if (created.length === 0 && skipped.length === 0 && packManaged.length === 0) {
      console.log(chalk.gray('No remote resources found.'))
      console.log()
    }

    if (!options.dryRun && created.length > 0) {
      console.log(chalk.gray('Run'), chalk.cyan('struere dev'), chalk.gray('to sync changes'))
      console.log()
    }
  })
