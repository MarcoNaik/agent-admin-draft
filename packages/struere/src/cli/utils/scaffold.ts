import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import {
  getPackageJson,
  getTsConfig,
  getAgentTs,
  getToolsIndexTs,
  getEnvExample,
  getGitignore,
  getStruereJson,
  getEntityTypeTs,
  getRoleTs,
  getTriggerTs,
  getExampleEvalYaml,
  getEvalYamlTemplate,
} from '../templates'

export interface ScaffoldOptions {
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

export function scaffoldProject(cwd: string, options: ScaffoldOptions): ScaffoldResult {
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
    'struere.json': getStruereJson(options.orgId, options.orgSlug, options.orgName),
    'package.json': getPackageJson(options.projectName),
    'tsconfig.json': getTsConfig(),
    '.env.example': getEnvExample(),
    '.gitignore': getGitignore(),
    'tools/index.ts': getToolsIndexTs(),
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

  writeFileSync(filePath, getAgentTs(name, slug))
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
