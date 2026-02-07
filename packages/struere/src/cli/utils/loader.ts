import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, basename } from 'path'
import YAML from 'yaml'
import type { AgentConfigV2, EntityTypeConfig, RoleConfig, ToolReference, EvalSuiteDefinition } from '../../types'

export interface LoadedResources {
  agents: AgentConfigV2[]
  entityTypes: EntityTypeConfig[]
  roles: RoleConfig[]
  customTools: ToolReference[]
  evalSuites: EvalSuiteDefinition[]
  errors: string[]
}

export async function loadAllResources(cwd: string): Promise<LoadedResources> {
  const errors: string[] = []
  const agents = await loadAllAgents(join(cwd, 'agents'))
  const entityTypes = await loadAllEntityTypes(join(cwd, 'entity-types'))
  const roles = await loadAllRoles(join(cwd, 'roles'))
  const { tools: customTools, error: toolsError } = await loadCustomTools(join(cwd, 'tools'))
  if (toolsError) {
    errors.push(toolsError)
  }
  const { suites: evalSuites, errors: evalErrors } = loadAllEvalSuites(join(cwd, 'evals'))
  errors.push(...evalErrors)

  return { agents, entityTypes, roles, customTools, evalSuites, errors }
}

export async function loadAllAgents(dir: string): Promise<AgentConfigV2[]> {
  if (!existsSync(dir)) {
    return []
  }

  const indexPath = join(dir, 'index.ts')
  if (existsSync(indexPath)) {
    return loadFromIndex<AgentConfigV2>(indexPath)
  }

  return loadFromDirectory<AgentConfigV2>(dir)
}

export async function loadAllEntityTypes(dir: string): Promise<EntityTypeConfig[]> {
  if (!existsSync(dir)) {
    return []
  }

  const indexPath = join(dir, 'index.ts')
  if (existsSync(indexPath)) {
    return loadFromIndex<EntityTypeConfig>(indexPath)
  }

  return loadFromDirectory<EntityTypeConfig>(dir)
}

export async function loadAllRoles(dir: string): Promise<RoleConfig[]> {
  if (!existsSync(dir)) {
    return []
  }

  const indexPath = join(dir, 'index.ts')
  if (existsSync(indexPath)) {
    return loadFromIndex<RoleConfig>(indexPath)
  }

  return loadFromDirectory<RoleConfig>(dir)
}

export async function loadCustomTools(dir: string): Promise<{ tools: ToolReference[]; error?: string }> {
  if (!existsSync(dir)) {
    return { tools: [] }
  }

  const indexPath = join(dir, 'index.ts')
  if (!existsSync(indexPath)) {
    return { tools: [] }
  }

  try {
    const module = await import(`${indexPath}?update=${Date.now()}`)
    if (Array.isArray(module.default)) {
      return { tools: module.default }
    }
    if (module.tools && Array.isArray(module.tools)) {
      return { tools: module.tools }
    }
    return { tools: [], error: `tools/index.ts was loaded but does not export a tools array (expected default export or named "tools" export)` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { tools: [], error: `Failed to load tools/index.ts: ${message}` }
  }
}

async function loadFromIndex<T>(indexPath: string): Promise<T[]> {
  try {
    const module = await import(`${indexPath}?update=${Date.now()}`)

    if (Array.isArray(module.default)) {
      return module.default
    }

    const items: T[] = []
    for (const key of Object.keys(module)) {
      if (key === 'default') continue
      const value = module[key]
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        items.push(value as T)
      }
    }

    return items
  } catch (error) {
    throw new Error(`Failed to load index at ${indexPath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function loadFromDirectory<T>(dir: string): Promise<T[]> {
  const files = readdirSync(dir).filter(
    (f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.d.ts')
  )

  const items: T[] = []

  for (const file of files) {
    const filePath = join(dir, file)
    try {
      const module = await import(`${filePath}?update=${Date.now()}`)
      if (module.default) {
        items.push(module.default as T)
      }
    } catch (error) {
      throw new Error(`Failed to load ${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return items
}

export function loadAllEvalSuites(dir: string): { suites: EvalSuiteDefinition[]; errors: string[] } {
  const suites: EvalSuiteDefinition[] = []
  const errors: string[] = []

  if (!existsSync(dir)) {
    return { suites, errors }
  }

  const files = readdirSync(dir).filter(
    (f) => f.endsWith('.eval.yaml') || f.endsWith('.eval.yml')
  )

  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), 'utf-8')
      const parsed = YAML.parse(content) as EvalSuiteDefinition
      suites.push(parsed)
    } catch (err) {
      errors.push(`Failed to parse ${file}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { suites, errors }
}

export function getResourceDirectories(cwd: string): {
  agents: string
  entityTypes: string
  roles: string
  tools: string
  evals: string
} {
  return {
    agents: join(cwd, 'agents'),
    entityTypes: join(cwd, 'entity-types'),
    roles: join(cwd, 'roles'),
    tools: join(cwd, 'tools'),
    evals: join(cwd, 'evals'),
  }
}

export function hasResourceDirectories(cwd: string): boolean {
  const dirs = getResourceDirectories(cwd)
  return existsSync(dirs.agents) || existsSync(dirs.entityTypes) || existsSync(dirs.roles)
}
