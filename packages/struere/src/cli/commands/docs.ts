import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { loadProject } from '../utils/project'
import { loadAllResources, type LoadedResources } from '../utils/loader'
import { installSkill } from '../utils/skill'

const TEMPLATE_URL = 'https://docs.struere.dev/llms-workspace.txt'
const FALLBACK_TEMPLATE = `# Struere Workspace

> Run \`struere docs\` with internet access to generate full documentation.

{{PROJECT_CONTEXT}}`

type Target = 'claude' | 'cursor' | 'copilot'

const ALL_TARGETS: Target[] = ['claude', 'cursor', 'copilot']

const TARGET_FILES: Record<Target, string> = {
  claude: 'CLAUDE.md',
  cursor: '.cursorrules',
  copilot: '.github/copilot-instructions.md',
}

function buildProjectContext(orgName: string, resources: LoadedResources): string {
  const lines: string[] = []
  lines.push(`## This Project`)
  lines.push('')
  lines.push(`Organization: ${orgName}`)

  if (resources.agents.length > 0) {
    lines.push('')
    lines.push(`### Agents (${resources.agents.length})`)
    for (const agent of resources.agents) {
      const tools = agent.tools?.length ? ` — tools: ${agent.tools.join(', ')}` : ''
      lines.push(`- **${agent.name}** (\`${agent.slug}\`) v${agent.version}${tools}`)
    }
  }

  if (resources.entityTypes.length > 0) {
    lines.push('')
    lines.push(`### Data Types (${resources.entityTypes.length})`)
    for (const et of resources.entityTypes) {
      const fields = et.schema?.properties ? Object.keys(et.schema.properties).join(', ') : ''
      const fieldStr = fields ? ` — fields: ${fields}` : ''
      lines.push(`- **${et.name}** (\`${et.slug}\`)${fieldStr}`)
    }
  }

  if (resources.roles.length > 0) {
    lines.push('')
    lines.push(`### Roles (${resources.roles.length})`)
    for (const role of resources.roles) {
      const policyCount = role.policies?.length || 0
      lines.push(`- **${role.name}** — ${policyCount} ${policyCount === 1 ? 'policy' : 'policies'}`)
    }
  }

  if (resources.triggers.length > 0) {
    lines.push('')
    lines.push(`### Triggers (${resources.triggers.length})`)
    for (const trigger of resources.triggers) {
      lines.push(`- **${trigger.name}** (\`${trigger.slug}\`) — on \`${trigger.on.entityType}.${trigger.on.action}\``)
    }
  }

  if (resources.customTools.length > 0) {
    lines.push('')
    lines.push(`### Custom Tools (${resources.customTools.length})`)
    for (const tool of resources.customTools) {
      lines.push(`- **${tool.name}** — ${tool.description}`)
    }
  }

  return lines.join('\n')
}

async function fetchTemplate(): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(TEMPLATE_URL, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } catch {
    return FALLBACK_TEMPLATE
  }
}

function writeTarget(cwd: string, target: Target, content: string): void {
  const filePath = join(cwd, TARGET_FILES[target])
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(filePath, content)
}

export async function generateDocs(cwd: string, targets: Target[]): Promise<{ generated: string[]; error?: string }> {
  const generated: string[] = []

  let projectContext: string | null = null
  const project = loadProject(cwd)
  if (project) {
    try {
      const resources = await loadAllResources(cwd)
      projectContext = buildProjectContext(project.organization.name, resources)
    } catch {
      projectContext = buildProjectContext(project.organization.name, {
        agents: [], entityTypes: [], roles: [], customTools: [], evalSuites: [], triggers: [], fixtures: [], errors: [],
      })
    }
  }

  const template = await fetchTemplate()
  const content = template.replace('{{PROJECT_CONTEXT}}', projectContext ?? '')

  for (const target of targets) {
    writeTarget(cwd, target, content)
    generated.push(TARGET_FILES[target])
  }

  await installSkill(cwd)

  return { generated }
}

export const docsCommand = new Command('docs')
  .description('Generate AI context files (CLAUDE.md, .cursorrules, copilot-instructions) from live docs')
  .option('--claude', 'Generate CLAUDE.md only')
  .option('--cursor', 'Generate .cursorrules only')
  .option('--copilot', 'Generate .github/copilot-instructions.md only')
  .action(async (options: { claude?: boolean; cursor?: boolean; copilot?: boolean }) => {
    const cwd = process.cwd()
    const spinner = ora()

    console.log()
    console.log(chalk.bold('Struere Docs'))
    console.log()

    let targets: Target[]
    if (options.claude || options.cursor || options.copilot) {
      targets = []
      if (options.claude) targets.push('claude')
      if (options.cursor) targets.push('cursor')
      if (options.copilot) targets.push('copilot')
    } else {
      targets = [...ALL_TARGETS]
    }

    spinner.start('Generating context files')

    const { generated, error } = await generateDocs(cwd, targets)

    if (error) {
      spinner.fail('Failed to generate docs')
      console.log(chalk.red('Error:'), error)
      process.exit(1)
    }

    spinner.succeed(`Generated ${generated.length} file${generated.length === 1 ? '' : 's'}`)
    for (const file of generated) {
      console.log(chalk.green('  ✓'), file)
    }
    console.log()
  })
