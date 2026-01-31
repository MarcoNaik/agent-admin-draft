import { existsSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import type { AgentConfigV2, EntityTypeConfig, RoleConfig, ToolReference } from '../../types'

export interface LoadedResources {
  agents: AgentConfigV2[]
  entityTypes: EntityTypeConfig[]
  roles: RoleConfig[]
  customTools: ToolReference[]
}

export async function loadAllResources(cwd: string): Promise<LoadedResources> {
  const agents = await loadAllAgents(join(cwd, 'agents'))
  const entityTypes = await loadAllEntityTypes(join(cwd, 'entity-types'))
  const roles = await loadAllRoles(join(cwd, 'roles'))
  const customTools = await loadCustomTools(join(cwd, 'tools'))

  return { agents, entityTypes, roles, customTools }
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

export async function loadCustomTools(dir: string): Promise<ToolReference[]> {
  if (!existsSync(dir)) {
    return []
  }

  const indexPath = join(dir, 'index.ts')
  if (!existsSync(indexPath)) {
    return []
  }

  try {
    const module = await import(indexPath)
    if (Array.isArray(module.default)) {
      return module.default
    }
    if (module.tools && Array.isArray(module.tools)) {
      return module.tools
    }
    return []
  } catch {
    return []
  }
}

async function loadFromIndex<T>(indexPath: string): Promise<T[]> {
  try {
    const module = await import(indexPath)

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
      const module = await import(filePath)
      if (module.default) {
        items.push(module.default as T)
      }
    } catch (error) {
      throw new Error(`Failed to load ${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return items
}

export function getResourceDirectories(cwd: string): {
  agents: string
  entityTypes: string
  roles: string
  tools: string
} {
  return {
    agents: join(cwd, 'agents'),
    entityTypes: join(cwd, 'entity-types'),
    roles: join(cwd, 'roles'),
    tools: join(cwd, 'tools'),
  }
}

export function hasResourceDirectories(cwd: string): boolean {
  const dirs = getResourceDirectories(cwd)
  return existsSync(dirs.agents) || existsSync(dirs.entityTypes) || existsSync(dirs.roles)
}
