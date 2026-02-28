import { loadCredentials, getApiKey, saveCredentials } from './credentials'

const CONVEX_URL = process.env.STRUERE_CONVEX_URL || 'https://rapid-wildebeest-172.convex.cloud'

export function getSiteUrl(): string {
  return CONVEX_URL.replace('.cloud', '.site')
}

export async function refreshToken(): Promise<string | null> {
  const credentials = loadCredentials()
  if (!credentials?.sessionId) return null

  const siteUrl = getSiteUrl()
  try {
    const response = await fetch(`${siteUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: credentials.sessionId }),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return null

    const data = await response.json() as { token: string }
    if (!data.token) return null

    credentials.token = data.token
    saveCredentials(credentials)
    return data.token
  } catch {
    return null
  }
}

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
      channel?: 'widget' | 'whatsapp' | 'api' | 'dashboard'
      contextParams?: Record<string, unknown>
    }>
  }>
  triggers?: Array<{
    name: string
    slug: string
    description?: string
    entityType: string
    action: string
    condition?: Record<string, unknown>
    actions: Array<{
      tool: string
      args: Record<string, unknown>
      as?: string
    }>
    schedule?: {
      delay?: number
      at?: string
      offset?: number
      cancelPrevious?: boolean
    }
    retry?: {
      maxAttempts?: number
      backoffMs?: number
    }
  }>
  fixtures?: Array<{
    name: string
    slug: string
    entities: Array<{
      ref: string
      type: string
      data: Record<string, unknown>
      status?: string
    }>
    relations?: Array<{
      from: string
      to: string
      type: string
      metadata?: Record<string, unknown>
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
  environment: 'development' | 'production' | 'eval'
}

async function syncViaHttp(apiKey: string, payload: SyncOptions): Promise<SyncResult> {
  const siteUrl = getSiteUrl()

  let response: Response
  try {
    response = await fetch(`${siteUrl}/v1/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        agents: payload.agents,
        entityTypes: payload.entityTypes,
        roles: payload.roles,
        evalSuites: payload.evalSuites,
        triggers: payload.triggers,
        fixtures: payload.fixtures,
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

  let json: Record<string, unknown>
  try {
    json = JSON.parse(text)
  } catch {
    return { success: false, error: text || `HTTP ${response.status}` }
  }

  if (!response.ok) {
    const msg = (json.error as string) || text
    return { success: false, error: msg }
  }

  return json as unknown as SyncResult
}

export async function syncOrganization(payload: SyncOptions): Promise<SyncResult> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()

  if (apiKey && !credentials?.token) {
    return syncViaHttp(apiKey, payload)
  }

  if (credentials?.sessionId) {
    await refreshToken()
  }

  const freshCredentials = loadCredentials()
  const token = apiKey || freshCredentials?.token

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
    return { success: false, error: json.errorData?.message || json.errorMessage || 'Unknown error from Convex' }
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

export async function getSyncState(organizationId?: string, environment?: 'development' | 'production' | 'eval'): Promise<{ state?: SyncState; error?: string }> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()

  if (apiKey && !credentials?.token) {
    const siteUrl = getSiteUrl()
    try {
      const response = await fetch(`${siteUrl}/v1/sync/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: '{}',
      })

      if (!response.ok) {
        const error = await response.text()
        return { error }
      }

      const result = await response.json() as SyncState
      return { state: result }
    } catch (err) {
      return { error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  if (credentials?.sessionId) {
    await refreshToken()
  }

  const freshCredentials = loadCredentials()
  const token = apiKey || freshCredentials?.token

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
  tools: Array<{ name: string; description: string; parameters: unknown; handlerCode?: string }>
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

export interface PullStateTrigger {
  name: string
  slug: string
  description?: string
  entityType: string
  action: string
  condition?: Record<string, unknown>
  actions: Array<{ tool: string; args: Record<string, unknown>; as?: string }>
  schedule?: { delay?: number; at?: string; offset?: number; cancelPrevious?: boolean }
  retry?: { maxAttempts?: number; backoffMs?: number }
}

export interface PullState {
  agents: PullStateAgent[]
  entityTypes: PullStateEntityType[]
  roles: PullStateRole[]
  triggers: PullStateTrigger[]
}

export interface CompilePromptOptions {
  slug: string
  environment: 'development' | 'production' | 'eval'
  message?: string
  channel?: string
  threadMetadata?: Record<string, unknown>
}

export interface CompilePromptResult {
  raw: string
  compiled: string
  context: Record<string, unknown>
}

export async function compilePrompt(options: CompilePromptOptions): Promise<{ result?: CompilePromptResult; error?: string }> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()

  if (apiKey && !credentials?.token) {
    const siteUrl = getSiteUrl()
    try {
      const response = await fetch(`${siteUrl}/v1/compile-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          slug: options.slug,
          message: options.message,
          channel: options.channel,
          threadMetadata: options.threadMetadata,
        }),
        signal: AbortSignal.timeout(30000),
      })

      const text = await response.text()

      let json: Record<string, unknown>
      try {
        json = JSON.parse(text)
      } catch {
        return { error: text || `HTTP ${response.status}` }
      }

      if (!response.ok) {
        return { error: (json.error as string) || text }
      }

      return { result: json as unknown as CompilePromptResult }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        return { error: 'Request timed out after 30s' }
      }
      return { error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  if (credentials?.sessionId) {
    await refreshToken()
  }

  const freshCredentials = loadCredentials()
  const token = apiKey || freshCredentials?.token

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const agentResponse = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'agents:getBySlug',
      args: { slug: options.slug },
    }),
  })

  if (!agentResponse.ok) {
    return { error: await agentResponse.text() }
  }

  const agentResult = await agentResponse.json() as { status: string; value?: { _id: string } | null; errorMessage?: string }

  if (agentResult.status === 'error') {
    return { error: agentResult.errorMessage || 'Failed to look up agent' }
  }

  if (!agentResult.value) {
    return { error: `Agent not found: ${options.slug}` }
  }

  const response = await fetch(`${CONVEX_URL}/api/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'agents:compileSystemPrompt',
      args: {
        agentId: agentResult.value._id,
        environment: options.environment,
        sampleContext: {
          message: options.message,
          channel: options.channel,
          threadMetadata: options.threadMetadata,
        },
      },
    }),
    signal: AbortSignal.timeout(30000),
  })

  const text = await response.text()

  let json: { status?: string; value?: CompilePromptResult | null; errorMessage?: string; errorData?: { message?: string } }
  try {
    json = JSON.parse(text)
  } catch {
    return { error: text || `HTTP ${response.status}` }
  }

  if (!response.ok) {
    const msg = json.errorData?.message || json.errorMessage || text
    return { error: msg }
  }

  if (json.status === 'success' && json.value) {
    return { result: json.value }
  }

  if (json.status === 'success' && json.value === null) {
    return { error: `Agent not found or no config for environment: ${options.environment}` }
  }

  if (json.status === 'error') {
    return { error: json.errorData?.message || json.errorMessage || 'Unknown error from Convex' }
  }

  return { error: `Unexpected response: ${text}` }
}

export async function getPullState(
  organizationId?: string,
  environment: 'development' | 'production' | 'eval' = 'development'
): Promise<{ state?: PullState; error?: string }> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()

  if (apiKey && !credentials?.token) {
    const siteUrl = getSiteUrl()
    try {
      const response = await fetch(`${siteUrl}/v1/sync/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: '{}',
      })

      if (!response.ok) {
        const error = await response.text()
        return { error }
      }

      const result = await response.json() as PullState
      return { state: result }
    } catch (err) {
      return { error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  if (credentials?.sessionId) {
    await refreshToken()
  }

  const freshCredentials = loadCredentials()
  const token = apiKey || freshCredentials?.token

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
