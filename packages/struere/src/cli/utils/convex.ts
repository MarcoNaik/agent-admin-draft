import { loadCredentials, getApiKey } from './credentials'

const CONVEX_URL = process.env.STRUERE_CONVEX_URL || 'https://rapid-wildebeest-172.convex.cloud'

interface AgentConfig {
  name: string
  version: string
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
}

interface AgentSyncResult {
  success: boolean
  error?: string
}

export async function syncToConvex(
  agentId: string,
  config: AgentConfig
): Promise<AgentSyncResult> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  const token = apiKey || credentials?.token

  if (!token) {
    return { success: false, error: 'Not authenticated' }
  }

  const response = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'agents:syncDevelopment',
      args: {
        agentId,
        config,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { success: false, error }
  }

  const result = await response.json() as { success?: boolean }
  return { success: result.success ?? true }
}

export interface AgentInfo {
  _id: string
  name: string
  slug: string
  description?: string
  status: string
}

export async function listAgents(): Promise<{ agents: AgentInfo[]; error?: string }> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  const token = apiKey || credentials?.token

  if (!token) {
    return { agents: [], error: 'Not authenticated' }
  }

  const response = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'agents:list',
      args: {},
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { agents: [], error }
  }

  const result = await response.json() as AgentInfo[] | { value?: AgentInfo[] }
  const agents = Array.isArray(result) ? result : ((result as { value?: AgentInfo[] })?.value || [])
  return { agents }
}

export async function createAgent(data: { name: string; slug: string; description?: string }): Promise<{ agentId?: string; error?: string }> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  const token = apiKey || credentials?.token

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const response = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'agents:create',
      args: data,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { error }
  }

  const agentId = await response.json() as string
  return { agentId }
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

export function extractConfig(agent: {
  name: string
  version?: string
  systemPrompt: string | (() => string | Promise<string>)
  model?: {
    provider?: string
    name?: string
    temperature?: number
    maxTokens?: number
  }
  tools?: Array<{
    name: string
    description: string
    parameters?: unknown
    handler?: Function
  }>
}): AgentConfig {
  const BUILTIN_TOOLS = [
    'entity.create',
    'entity.get',
    'entity.query',
    'entity.update',
    'entity.delete',
    'entity.link',
    'entity.unlink',
    'event.emit',
    'event.query',
    'job.enqueue',
    'job.status',
  ]

  let systemPrompt: string
  if (typeof agent.systemPrompt === 'function') {
    const result = agent.systemPrompt()
    if (result instanceof Promise) {
      throw new Error('Async system prompts must be resolved before syncing')
    }
    systemPrompt = result
  } else {
    systemPrompt = agent.systemPrompt
  }

  const tools = (agent.tools || []).map((tool) => {
    const isBuiltin = BUILTIN_TOOLS.includes(tool.name)

    let handlerCode: string | undefined
    if (!isBuiltin && tool.handler) {
      handlerCode = extractHandlerCode(tool.handler)
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || { type: 'object', properties: {} },
      handlerCode,
      isBuiltin,
    }
  })

  return {
    name: agent.name,
    version: agent.version || '0.0.1',
    systemPrompt,
    model: {
      provider: agent.model?.provider || 'anthropic',
      name: agent.model?.name || 'claude-sonnet-4-20250514',
      temperature: agent.model?.temperature,
      maxTokens: agent.model?.maxTokens,
    },
    tools,
  }
}

function extractHandlerCode(handler: Function): string {
  const code = handler.toString()

  const arrowMatch = code.match(/(?:async\s*)?\([^)]*\)\s*=>\s*\{?([\s\S]*)\}?$/)
  if (arrowMatch) {
    let body = arrowMatch[1].trim()
    if (body.startsWith('{') && body.endsWith('}')) {
      body = body.slice(1, -1).trim()
    }
    return body
  }

  const funcMatch = code.match(/(?:async\s*)?function[^(]*\([^)]*\)\s*\{([\s\S]*)\}$/)
  if (funcMatch) {
    return funcMatch[1].trim()
  }

  return code
}

export function getConvexUrl(): string {
  return CONVEX_URL
}

export interface Execution {
  _id: string
  agentId: string
  status: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  errorMessage?: string
  createdAt: number
}

export async function getRecentExecutions(limit: number = 100): Promise<{ executions: Execution[]; error?: string }> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  const token = apiKey || credentials?.token

  if (!token) {
    return { executions: [], error: 'Not authenticated' }
  }

  const response = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'executions:list',
      args: { limit },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { executions: [], error }
  }

  const executions = await response.json() as Execution[]
  return { executions: executions || [] }
}

export interface ThreadState {
  thread: {
    _id: string
    agentId: string
    createdAt: number
    updatedAt: number
  }
  messages: Array<{
    _id: string
    role: string
    content: string
    createdAt: number
  }>
}

export async function getThreadState(threadId: string): Promise<{ state?: ThreadState; error?: string }> {
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
      path: 'threads:getWithMessages',
      args: { threadId },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { error }
  }

  const state = await response.json() as ThreadState | null
  if (!state) {
    return { error: 'Thread not found' }
  }

  return { state }
}

export interface ChatResponse {
  message: string
  toolCalls?: Array<{
    name: string
    parameters: Record<string, unknown>
    result: unknown
  }>
}

export async function runTestConversation(
  agentId: string,
  message: string,
  threadId?: string
): Promise<{ response?: ChatResponse; threadId?: string; error?: string }> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  const token = apiKey || credentials?.token

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const response = await fetch(`${CONVEX_URL}/api/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'agent:chat',
      args: {
        agentId,
        message,
        threadId,
        environment: 'development',
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { error }
  }

  const result = await response.json() as { message: string; toolCalls?: ChatResponse['toolCalls']; threadId?: string }
  return {
    response: {
      message: result.message,
      toolCalls: result.toolCalls,
    },
    threadId: result.threadId,
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
  entityTypes?: { created: string[]; updated: string[]; deleted: string[]; preserved?: string[] }
  roles?: { created: string[]; updated: string[]; deleted: string[]; preserved?: string[] }
  agents?: { created: string[]; updated: string[]; deleted: string[]; preserved?: string[] }
  evalSuites?: { created: string[]; updated: string[]; deleted: string[]; skipped: string[] }
  error?: string
}

export interface SyncOptions extends SyncPayload {
  organizationId?: string
  environment: 'development' | 'production'
  preserveUnmanagedAgents?: boolean
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

