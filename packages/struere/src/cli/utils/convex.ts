import { loadCredentials, getApiKey } from './credentials'

const CONVEX_URL = process.env.STRUERE_CONVEX_URL || 'https://rapid-wildebeest-172.convex.cloud'

export interface UserInfo {
  user: {
    id: string
    email: string
    name?: string
  }
  organizations: OrgInfo[]
}

export interface OrgInfo {
  id: string
  name: string
  slug: string
  role: string
}

export async function listMyOrganizations(token: string): Promise<{ organizations: OrgInfo[]; error?: string }> {
  const response = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'organizations:listMyOrganizations',
      args: {},
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { organizations: [], error }
  }

  const result = await response.json() as { status: string; value?: OrgInfo[] }
  return { organizations: result.value || [] }
}

export async function getUserInfo(token: string): Promise<{ userInfo?: UserInfo; error?: string }> {
  const ensureResponse = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'users:ensureUser',
      args: {},
    }),
  })

  if (!ensureResponse.ok) {
    const error = await ensureResponse.text()
    return { error }
  }

  const response = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'users:getCurrent',
      args: {},
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { error }
  }

  const userResponse = await response.json() as { status: string; value?: { _id: string; email: string; name?: string } }
  const user = userResponse.value
  if (!user) {
    return { error: 'User not found' }
  }

  const { organizations, error: orgsError } = await listMyOrganizations(token)
  if (orgsError) {
    return { error: orgsError }
  }

  return {
    userInfo: {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
      organizations,
    },
  }
}

export interface SyncPayload {
  agents: Array<{
    name: string
    slug: string
    version: string
    description?: string
    systemPrompt: string
    model: {
      provider: string
      name: string
      temperature?: number
      maxTokens?: number
    }
    tools: Array<{
      name: string
      description: string
      parameters: unknown
      handlerCode?: string
      isBuiltin: boolean
    }>
  }>
  entityTypes: Array<{
    name: string
    slug: string
    schema: unknown
    searchFields?: string[]
    displayConfig?: unknown
  }>
  roles: Array<{
    name: string
    description?: string
    policies: Array<{
      resource: string
      actions: string[]
      effect: 'allow' | 'deny'
    }>
    scopeRules?: Array<{
      entityType: string
      field: string
      operator: string
      value: string
    }>
    fieldMasks?: Array<{
      entityType: string
      fieldPath: string
      maskType: 'hide' | 'redact'
      maskConfig?: Record<string, unknown>
    }>
  }>
  evalSuites?: Array<{
    name: string
    slug: string
    agentSlug: string
    description?: string
    tags?: string[]
    judgeModel?: {
      provider: string
      name: string
    }
    judgeContext?: string
    judgePrompt?: string
    cases: Array<{
      name: string
      description?: string
      tags?: string[]
      turns: Array<{
        userMessage: string
        assertions?: Array<{
          type: 'llm_judge' | 'contains' | 'matches' | 'tool_called' | 'tool_not_called'
          criteria?: string
          value?: string
          weight?: number
        }>
      }>
      finalAssertions?: Array<{
        type: 'llm_judge' | 'contains' | 'matches' | 'tool_called' | 'tool_not_called'
        criteria?: string
        value?: string
        weight?: number
      }>
    }>
  }>
}

export interface SyncResult {
  success: boolean
  entityTypes?: { created: string[]; updated: string[]; deleted: string[] }
  roles?: { created: string[]; updated: string[]; deleted: string[] }
  agents?: { created: string[]; updated: string[]; deleted: string[] }
  evalSuites?: { created: string[]; updated: string[]; deleted: string[]; skipped: string[] }
  error?: string
}

export interface SyncOptions extends SyncPayload {
  organizationId?: string
  environment: 'development' | 'production'
}

export async function syncOrganization(payload: SyncOptions): Promise<SyncResult> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  const token = apiKey || credentials?.token

  if (!token) {
    return { success: false, error: 'Not authenticated' }
  }

  let response: Response
  try {
    response = await fetch(`${CONVEX_URL}/api/mutation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        path: 'sync:syncOrganization',
        args: payload,
      }),
      signal: AbortSignal.timeout(30000),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return { success: false, error: 'Sync request timed out after 30s' }
    }
    return { success: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }

  const text = await response.text()

  let json: { status?: string; value?: SyncResult; errorMessage?: string; message?: string; errorData?: { message?: string; code?: string }; code?: string }
  try {
    json = JSON.parse(text)
  } catch {
    return { success: false, error: text || `HTTP ${response.status}` }
  }

  if (!response.ok) {
    const msg = json.errorData?.message || json.message || json.errorMessage || text
    return { success: false, error: msg }
  }

  if (json.status === 'success' && json.value) {
    return json.value
  }

  if (json.status === 'error') {
    return { success: false, error: json.errorMessage || 'Unknown error from Convex' }
  }

  return { success: false, error: `Unexpected response: ${text}` }
}

export interface SyncState {
  agents: Array<{ slug: string; name: string; version: string; hasConfig: boolean }>
  entityTypes: Array<{ slug: string; name: string }>
  roles: Array<{ name: string; policyCount: number }>
  evalSuites?: Array<{ slug: string; name: string; agentId: string }>
  triggers?: Array<{ slug: string; name: string; entityType: string; action: string }>
}

export async function getSyncState(organizationId?: string, environment?: 'development' | 'production'): Promise<{ state?: SyncState; error?: string }> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  const token = apiKey || credentials?.token

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const response = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'sync:getSyncState',
      args: { organizationId, environment },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { error }
  }

  const result = await response.json() as { status: string; value?: SyncState; errorMessage?: string }

  if (result.status === 'success') {
    return { state: result.value }
  }

  if (result.status === 'error') {
    return { error: result.errorMessage || 'Unknown error from Convex' }
  }

  return { error: `Unexpected response: ${JSON.stringify(result)}` }
}

export interface PullStateAgent {
  name: string
  slug: string
  description?: string
  version: string
  systemPrompt: string
  model: { provider: string; name: string; temperature?: number; maxTokens?: number }
  tools: Array<{ name: string; description: string; parameters: unknown; handlerCode?: string; isBuiltin: boolean }>
}

export interface PullStateEntityType {
  name: string
  slug: string
  schema: unknown
  searchFields?: string[]
  displayConfig?: unknown
}

export interface PullStateRole {
  name: string
  description?: string
  policies: Array<{ resource: string; actions: string[]; effect: string }>
  scopeRules: Array<{ entityType: string; field: string; operator: string; value: string }>
  fieldMasks: Array<{ entityType: string; fieldPath: string; maskType: string; maskConfig?: Record<string, unknown> }>
}

export interface PullState {
  agents: PullStateAgent[]
  entityTypes: PullStateEntityType[]
  roles: PullStateRole[]
}

export async function getPullState(
  organizationId?: string,
  environment: 'development' | 'production' = 'development'
): Promise<{ state?: PullState; error?: string }> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  const token = apiKey || credentials?.token

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const response = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'sync:getPullState',
      args: { organizationId, environment },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { error }
  }

  const result = await response.json() as { status: string; value?: PullState; errorMessage?: string }

  if (result.status === 'success') {
    return { state: result.value }
  }

  if (result.status === 'error') {
    return { error: result.errorMessage || 'Unknown error from Convex' }
  }

  return { error: `Unexpected response: ${JSON.stringify(result)}` }
}
