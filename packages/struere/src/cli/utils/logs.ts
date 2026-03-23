import { loadCredentials, getApiKey } from './credentials'
import { CONVEX_URL } from './config'

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

export async function queryThreads(options: {
  environment: string
  agentId?: string
  channel?: string
  limit?: number
}): Promise<{ data?: unknown; error?: string }> {
  return convexQuery('threads:listWithPreviews', {
    environment: options.environment,
    ...(options.agentId && { agentId: options.agentId }),
    ...(options.channel && { channel: options.channel }),
    ...(options.limit && { limit: options.limit }),
  })
}

export async function queryThreadDetail(threadId: string, messageLimit?: number): Promise<{ data?: unknown; error?: string }> {
  return convexQuery('threads:getWithMessages', {
    id: threadId,
    ...(messageLimit && { messageLimit }),
  })
}

export async function queryThreadExecutions(threadId: string): Promise<{ data?: unknown; error?: string }> {
  return convexQuery('executions:getByThread', { threadId })
}

export async function resolveAgentSlug(slug: string, organizationId?: string): Promise<{ data?: string; error?: string }> {
  const result = await convexQuery('agents:getBySlug', { slug, ...(organizationId && { organizationId }) })
  if (result.error) return { error: result.error }
  if (!result.data) return { error: `No agent found with slug "${slug}"` }
  const agent = result.data as { _id: string }
  return { data: agent._id }
}
