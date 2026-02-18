import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'fs'
import { join, dirname } from 'path'
import {
  getPackageJson,
  getPackageJsonV2,
  getTsConfig,
  getStruereConfig,
  getAgentTs,
  getAgentTsV2,
  getToolsTs,
  getToolsIndexTs,
  getBasicTestYaml,
  getEnvExample,
  getGitignore,
  getStruereJson,
  getStruereJsonV2,
  getEnvLocal,
  getClaudeMD,
  getClaudeMDV2,
  getEntityTypeTs,
  getRoleTs,
  getTriggerTs,
  getIndexTs,
  getExampleEvalYaml,
  getEvalYamlTemplate,
} from '../templates'

export interface ScaffoldOptions {
  projectName: string
  agentId: string
  team: string
  agentSlug: string
  agentName: string
  deploymentUrl: string
}

export interface ScaffoldOptionsV2 {
  projectName: string
  orgId: string
  orgSlug: string
  orgName: string
}

export interface ScaffoldResult {
  createdFiles: string[]
  updatedFiles: string[]
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function writeFile(cwd: string, relativePath: string, content: string): void {
  const fullPath = join(cwd, relativePath)
  ensureDir(fullPath)
  writeFileSync(fullPath, content)
}

export function writeProjectConfig(cwd: string, options: ScaffoldOptions): ScaffoldResult {
  const result: ScaffoldResult = {
    createdFiles: [],
    updatedFiles: [],
  }

  writeFile(cwd, 'struere.json', getStruereJson(options.agentId, options.team, options.agentSlug, options.agentName))
  result.createdFiles.push('struere.json')

  writeFile(cwd, '.env.local', getEnvLocal(options.deploymentUrl))
  result.createdFiles.push('.env.local')

  updateGitignore(cwd, result)

  return result
}

export function scaffoldProject(cwd: string, options: ScaffoldOptions): ScaffoldResult {
  const result: ScaffoldResult = {
    createdFiles: [],
    updatedFiles: [],
  }

  const files: Record<string, string> = {
    'package.json': getPackageJson(options.projectName),
    'tsconfig.json': getTsConfig(),
    'struere.config.ts': getStruereConfig(),
    'src/agent.ts': getAgentTs(options.projectName),
    'src/tools.ts': getToolsTs(),
    'src/workflows/.gitkeep': '',
    'tests/basic.test.yaml': getBasicTestYaml(),
    '.env.example': getEnvExample(),
    '.gitignore': getGitignore(),
    'struere.json': getStruereJson(options.agentId, options.team, options.agentSlug, options.agentName),
    '.env.local': getEnvLocal(options.deploymentUrl),
    'CLAUDE.md': getClaudeMD(options.projectName),
  }

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(cwd, relativePath)
    if (existsSync(fullPath)) {
      continue
    }
    writeFile(cwd, relativePath, content)
    result.createdFiles.push(relativePath)
  }

  return result
}

export function scaffoldAgentFiles(cwd: string, projectName: string): ScaffoldResult {
  const result: ScaffoldResult = {
    createdFiles: [],
    updatedFiles: [],
  }

  const files: Record<string, string> = {
    'package.json': getPackageJson(projectName),
    'tsconfig.json': getTsConfig(),
    'struere.config.ts': getStruereConfig(),
    'src/agent.ts': getAgentTs(projectName),
    'src/tools.ts': getToolsTs(),
    'src/workflows/.gitkeep': '',
    'tests/basic.test.yaml': getBasicTestYaml(),
    '.env.example': getEnvExample(),
    'CLAUDE.md': getClaudeMD(projectName),
  }

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(cwd, relativePath)
    if (existsSync(fullPath)) {
      continue
    }
    writeFile(cwd, relativePath, content)
    result.createdFiles.push(relativePath)
  }

  updateGitignore(cwd, result)

  return result
}

function updateGitignore(cwd: string, result: ScaffoldResult): void {
  const gitignorePath = join(cwd, '.gitignore')
  const linesToAdd = ['.env.local']

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8')
    const lines = content.split('\n')
    const missingLines = linesToAdd.filter((line) => !lines.some((l) => l.trim() === line))

    if (missingLines.length > 0) {
      const toAppend = '\n' + missingLines.join('\n') + '\n'
      appendFileSync(gitignorePath, toAppend)
      result.updatedFiles.push('.gitignore')
    }
  } else {
    writeFile(cwd, '.gitignore', getGitignore())
    result.createdFiles.push('.gitignore')
  }
}

export function hasAgentFiles(cwd: string): boolean {
  return existsSync(join(cwd, 'src', 'agent.ts'))
}

export function scaffoldProjectV2(cwd: string, options: ScaffoldOptionsV2): ScaffoldResult {
  const result: ScaffoldResult = {
    createdFiles: [],
    updatedFiles: [],
  }

  const directories = [
    'agents',
    'entity-types',
    'roles',
    'tools',
    'evals',
    'triggers',
    '.struere',
  ]

  for (const dir of directories) {
    const dirPath = join(cwd, dir)
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true })
    }
  }

  const files: Record<string, string> = {
    'struere.json': getStruereJsonV2(options.orgId, options.orgSlug, options.orgName),
    'package.json': getPackageJsonV2(options.projectName),
    'tsconfig.json': getTsConfig(),
    'struere.config.ts': getStruereConfig(),
    '.env.example': getEnvExample(),
    '.gitignore': getGitignore(),
    'CLAUDE.md': getClaudeMDV2(options.orgName),
    'agents/index.ts': getIndexTs('agents'),
    'entity-types/index.ts': getIndexTs('entity-types'),
    'roles/index.ts': getIndexTs('roles'),
    'tools/index.ts': getToolsIndexTs(),
    'triggers/index.ts': getIndexTs('triggers'),
    'evals/basic-agent-tests.eval.yaml': getExampleEvalYaml('my-agent'),
  }

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(cwd, relativePath)
    if (existsSync(fullPath)) {
      continue
    }
    writeFile(cwd, relativePath, content)
    result.createdFiles.push(relativePath)
  }

  return result
}

export function scaffoldAgent(cwd: string, name: string, slug: string): ScaffoldResult {
  const result: ScaffoldResult = {
    createdFiles: [],
    updatedFiles: [],
  }

  const agentsDir = join(cwd, 'agents')
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true })
  }

  const fileName = `${slug}.ts`
  const filePath = join(agentsDir, fileName)

  if (existsSync(filePath)) {
    return result
  }

  writeFileSync(filePath, getAgentTsV2(name, slug))
  result.createdFiles.push(`agents/${fileName}`)

  return result
}

export function scaffoldEntityType(cwd: string, name: string, slug: string): ScaffoldResult {
  const result: ScaffoldResult = {
    createdFiles: [],
    updatedFiles: [],
  }

  const entityTypesDir = join(cwd, 'entity-types')
  if (!existsSync(entityTypesDir)) {
    mkdirSync(entityTypesDir, { recursive: true })
  }

  const fileName = `${slug}.ts`
  const filePath = join(entityTypesDir, fileName)

  if (existsSync(filePath)) {
    return result
  }

  writeFileSync(filePath, getEntityTypeTs(name, slug))
  result.createdFiles.push(`entity-types/${fileName}`)

  return result
}

export function scaffoldRole(cwd: string, name: string): ScaffoldResult {
  const result: ScaffoldResult = {
    createdFiles: [],
    updatedFiles: [],
  }

  const rolesDir = join(cwd, 'roles')
  if (!existsSync(rolesDir)) {
    mkdirSync(rolesDir, { recursive: true })
  }

  const fileName = `${name}.ts`
  const filePath = join(rolesDir, fileName)

  if (existsSync(filePath)) {
    return result
  }

  writeFileSync(filePath, getRoleTs(name))
  result.createdFiles.push(`roles/${fileName}`)

  return result
}

export function scaffoldEval(cwd: string, name: string, slug: string, agentSlug: string = 'my-agent'): ScaffoldResult {
  const result: ScaffoldResult = {
    createdFiles: [],
    updatedFiles: [],
  }

  const evalsDir = join(cwd, 'evals')
  if (!existsSync(evalsDir)) {
    mkdirSync(evalsDir, { recursive: true })
  }

  const fileName = `${slug}.eval.yaml`
  const filePath = join(evalsDir, fileName)

  if (existsSync(filePath)) {
    return result
  }

  const displayName = name
    .split('-')
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  writeFileSync(filePath, getEvalYamlTemplate(displayName, slug, agentSlug))
  result.createdFiles.push(`evals/${fileName}`)

  return result
}

export function scaffoldTrigger(cwd: string, name: string, slug: string): ScaffoldResult {
  const result: ScaffoldResult = {
    createdFiles: [],
    updatedFiles: [],
  }

  const triggersDir = join(cwd, 'triggers')
  if (!existsSync(triggersDir)) {
    mkdirSync(triggersDir, { recursive: true })
  }

  const fileName = `${slug}.ts`
  const filePath = join(triggersDir, fileName)

  if (existsSync(filePath)) {
    return result
  }

  writeFileSync(filePath, getTriggerTs(name, slug))
  result.createdFiles.push(`triggers/${fileName}`)

  return result
}

export function hasV2Structure(cwd: string): boolean {
  return existsSync(join(cwd, 'agents')) ||
         existsSync(join(cwd, 'entity-types')) ||
         existsSync(join(cwd, 'roles'))
}
