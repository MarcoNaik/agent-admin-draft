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

export async function queryEntityTypes(env: Environment) {
  return convexQuery('entityTypes:list', { environment: env })
}

export async function queryEntityTypeBySlug(slug: string, env: Environment) {
  return convexQuery('entityTypes:getBySlug', { slug, environment: env })
}

export async function queryEntities(
  slug: string,
  env: Environment,
  opts?: { status?: string; limit?: number }
) {
  return convexQuery('entities:list', {
    entityTypeSlug: slug,
    environment: env,
    ...(opts?.status && { status: opts.status }),
    ...(opts?.limit && { limit: opts.limit }),
  })
}

export async function queryEntity(id: string, env: Environment) {
  return convexQuery('entities:getWithType', { id, environment: env })
}

export async function searchEntities(
  slug: string,
  query: string,
  env: Environment,
  limit?: number
) {
  return convexQuery('entities:search', {
    entityTypeSlug: slug,
    environment: env,
    query,
    ...(limit && { limit }),
  })
}

export async function createEntity(
  slug: string,
  data: Record<string, unknown>,
  env: Environment,
  status?: string
) {
  return convexMutation('entities:create', {
    entityTypeSlug: slug,
    environment: env,
    data,
    ...(status && { status }),
  })
}

export async function updateEntity(
  id: string,
  data: Record<string, unknown>,
  env: Environment,
  status?: string
) {
  return convexMutation('entities:update', {
    id,
    environment: env,
    data,
    ...(status && { status }),
  })
}

export async function removeEntity(id: string, env: Environment) {
  return convexMutation('entities:remove', { id, environment: env })
}
