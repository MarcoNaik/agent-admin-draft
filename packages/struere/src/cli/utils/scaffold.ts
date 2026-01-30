import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'fs'
import { join, dirname } from 'path'
import {
  getPackageJson,
  getTsConfig,
  getStruereConfig,
  getAgentTs,
  getContextTs,
  getToolsTs,
  getBasicTestYaml,
  getEnvExample,
  getGitignore,
  getStruereJson,
  getEnvLocal,
  getClaudeMd,
} from '../templates'

export interface ScaffoldOptions {
  projectName: string
  agentId: string
  team: string
  agentSlug: string
  agentName: string
  deploymentUrl: string
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
    'src/context.ts': getContextTs(),
    'src/tools.ts': getToolsTs(),
    'src/workflows/.gitkeep': '',
    'tests/basic.test.yaml': getBasicTestYaml(),
    '.env.example': getEnvExample(),
    '.gitignore': getGitignore(),
    'struere.json': getStruereJson(options.agentId, options.team, options.agentSlug, options.agentName),
    '.env.local': getEnvLocal(options.deploymentUrl),
    '.claude.md': getClaudeMd(options.projectName),
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
    'src/context.ts': getContextTs(),
    'src/tools.ts': getToolsTs(),
    'src/workflows/.gitkeep': '',
    'tests/basic.test.yaml': getBasicTestYaml(),
    '.env.example': getEnvExample(),
    '.claude.md': getClaudeMd(projectName),
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
