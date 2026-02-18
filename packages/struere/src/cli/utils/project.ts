import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface StruereProject {
  version: '2.0'
  organization: {
    id: string
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
    const parsed = JSON.parse(data)

    if (parsed.version === '2.0') {
      return parsed as StruereProject
    }

    return null
  } catch {
    return null
  }
}

export function hasProject(cwd: string): boolean {
  return existsSync(join(cwd, PROJECT_FILE))
}

