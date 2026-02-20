import { loadCredentials, getApiKey } from './credentials'

const CONVEX_URL = process.env.STRUERE_CONVEX_URL || 'https://rapid-wildebeest-172.convex.cloud'

type Environment = 'development' | 'production'

function getToken(): string | null {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  return apiKey || credentials?.token || null
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

export async function listWhatsAppConnections(env: Environment) {
  return convexQuery('whatsapp:listConnections', { environment: env })
}

export async function listTemplates(connectionId: string, env: Environment) {
  return convexAction('whatsappActions:listTemplates', {
    connectionId,
    environment: env,
  })
}

export async function createTemplate(
  connectionId: string,
  env: Environment,
  name: string,
  language: string,
  category: string,
  components: Array<Record<string, unknown>>,
  allowCategoryChange?: boolean
) {
  return convexAction('whatsappActions:createTemplate', {
    connectionId,
    environment: env,
    name,
    language,
    category,
    components,
    ...(allowCategoryChange !== undefined && { allowCategoryChange }),
  })
}

export async function deleteTemplate(connectionId: string, env: Environment, name: string) {
  return convexAction('whatsappActions:deleteTemplate', {
    connectionId,
    environment: env,
    name,
  })
}

export async function getTemplateStatus(connectionId: string, env: Environment, name: string) {
  return convexAction('whatsappActions:getTemplateStatus', {
    connectionId,
    environment: env,
    name,
  })
}
