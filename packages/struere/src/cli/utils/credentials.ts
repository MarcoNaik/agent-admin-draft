import { homedir } from 'os'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'

export interface Credentials {
  token: string
  apiKey?: string
  user: {
    id: string
    email: string
    name: string
    organizationId?: string
  }
  organization?: {
    id: string
    name: string
    slug: string
  }
  expiresAt: string
}

const CONFIG_DIR = join(homedir(), '.struere')
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json')

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

export function saveCredentials(credentials: Credentials): void {
  ensureConfigDir()
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), { mode: 0o600 })
}

export function loadCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_FILE)) {
    return null
  }

  try {
    const data = readFileSync(CREDENTIALS_FILE, 'utf-8')
    const credentials = JSON.parse(data) as Credentials

    if (new Date(credentials.expiresAt) < new Date()) {
      clearCredentials()
      return null
    }

    return credentials
  } catch {
    return null
  }
}

export function clearCredentials(): void {
  if (existsSync(CREDENTIALS_FILE)) {
    unlinkSync(CREDENTIALS_FILE)
  }
}

export function getApiKey(): string | null {
  const credentials = loadCredentials()
  if (credentials?.apiKey) {
    return credentials.apiKey
  }
  return process.env.STRUERE_API_KEY || null
}
