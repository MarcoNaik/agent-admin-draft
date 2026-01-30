import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface StruereProject {
  agentId: string
  team: string
  agent: {
    slug: string
    name: string
  }
}

const PROJECT_FILE = 'struere.json'

export function loadProject(cwd: string): StruereProject | null {
  const projectPath = join(cwd, PROJECT_FILE)

  if (!existsSync(projectPath)) {
    return null
  }

  try {
    const data = readFileSync(projectPath, 'utf-8')
    return JSON.parse(data) as StruereProject
  } catch {
    return null
  }
}

export function saveProject(cwd: string, project: StruereProject): void {
  const projectPath = join(cwd, PROJECT_FILE)
  writeFileSync(projectPath, JSON.stringify(project, null, 2) + '\n')
}

export function hasProject(cwd: string): boolean {
  return existsSync(join(cwd, PROJECT_FILE))
}
