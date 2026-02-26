import { loadCredentials, getApiKey } from './credentials'

const CONVEX_URL = process.env.STRUERE_CONVEX_URL || 'https://rapid-wildebeest-172.convex.cloud'

type Environment = 'development' | 'production'

function getToken(): string | null {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  return apiKey || credentials?.token || null
}

async function convexQuery(path: string, args: Record<string, unknown>): Promise<{ data?: unknown; error?: string }> {
  const token = getToken()
  if (!token) return { error: 'Not authenticated' }

  const response = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ path, args }),
  })

  const text = await response.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text)
  } catch {
    return { error: text || `HTTP ${response.status}` }
  }

  if (!response.ok) {
    const msg = (json.errorData as Record<string, string>)?.message || json.message || json.errorMessage || text
    return { error: String(msg) }
  }

  if (json.status === 'success') return { data: json.value }
  if (json.status === 'error') return { error: String(json.errorMessage || 'Unknown error') }
  return { error: `Unexpected response: ${text}` }
}

async function convexMutation(path: string, args: Record<string, unknown>): Promise<{ data?: unknown; error?: string }> {
  const token = getToken()
  if (!token) return { error: 'Not authenticated' }

  const response = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ path, args }),
  })

  const text = await response.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text)
  } catch {
    return { error: text || `HTTP ${response.status}` }
  }

  if (!response.ok) {
    const msg = (json.errorData as Record<string, string>)?.message || json.message || json.errorMessage || text
    return { error: String(msg) }
  }

  if (json.status === 'success') return { data: json.value }
  if (json.status === 'error') return { error: String(json.errorMessage || 'Unknown error') }
  return { error: `Unexpected response: ${text}` }
}

async function convexAction(path: string, args: Record<string, unknown>): Promise<{ data?: unknown; error?: string }> {
  const token = getToken()
  if (!token) return { error: 'Not authenticated' }

  const response = await fetch(`${CONVEX_URL}/api/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ path, args }),
  })

  const text = await response.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text)
  } catch {
    return { error: text || `HTTP ${response.status}` }
  }

  if (!response.ok) {
    const msg = (json.errorData as Record<string, string>)?.message || json.message || json.errorMessage || text
    return { error: String(msg) }
  }

  if (json.status === 'success') return { data: json.value }
  if (json.status === 'error') return { error: String(json.errorMessage || 'Unknown error') }
  return { error: `Unexpected response: ${text}` }
}

export async function getIntegrationConfig(provider: string, env: Environment) {
  return convexQuery('integrations:getConfig', { provider, environment: env })
}

export async function updateIntegrationConfig(provider: string, env: Environment, config: Record<string, unknown>) {
  return convexMutation('integrations:updateConfig', { provider, environment: env, config })
}

export async function testIntegrationConnection(provider: string, env: Environment) {
  return convexAction('integrations:testConnection', { provider, environment: env })
}

export async function deleteIntegrationConfig(provider: string, env: Environment) {
  return convexMutation('integrations:deleteConfig', { provider, environment: env })
}

export async function listIntegrationConfigs(env: Environment) {
  return convexQuery('integrations:listConfigs', { environment: env })
}

export async function setIntegrationStatus(provider: string, env: Environment, status: 'active' | 'inactive') {
  return convexMutation('integrations:setConfigStatus', { provider, environment: env, status })
}
