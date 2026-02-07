import { loadCredentials, getApiKey } from './credentials'
import type { EvalSuiteDefinition, EvalRunStatus, EvalResultSummary } from '../../types'

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
      priority?: number
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
}

export interface SyncResult {
  success: boolean
  entityTypes?: { created: string[]; updated: string[]; deleted: string[]; preserved?: string[] }
  roles?: { created: string[]; updated: string[]; deleted: string[]; preserved?: string[] }
  agents?: { created: string[]; updated: string[]; deleted: string[]; preserved?: string[] }
  packResourcesPreserved?: boolean
  error?: string
}

export interface SyncOptions extends SyncPayload {
  organizationId?: string
  environment: 'development' | 'production'
  preservePackResources?: boolean
  preserveUnmanagedAgents?: boolean
}

export async function syncOrganization(payload: SyncOptions): Promise<SyncResult> {
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
      path: 'sync:syncOrganization',
      args: payload,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { success: false, error }
  }

  const json = await response.json() as { status: string; value?: SyncResult; errorMessage?: string }

  if (json.status === 'success' && json.value) {
    return json.value
  }

  if (json.status === 'error') {
    return { success: false, error: json.errorMessage || 'Unknown error from Convex' }
  }

  return { success: false, error: `Unexpected response: ${JSON.stringify(json)}` }
}

export interface SyncState {
  agents: Array<{ slug: string; name: string; version: string; hasConfig: boolean }>
  entityTypes: Array<{ slug: string; name: string; isPackManaged?: boolean }>
  roles: Array<{ name: string; policyCount: number; isPackManaged?: boolean }>
  installedPacks?: Array<{ packId: string; version: string; entityTypeCount: number; roleCount: number }>
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
  isPackManaged: boolean
}

export interface PullStateEntityType {
  name: string
  slug: string
  schema: unknown
  searchFields?: string[]
  displayConfig?: unknown
  isPackManaged: boolean
}

export interface PullStateRole {
  name: string
  description?: string
  isPackManaged: boolean
  policies: Array<{ resource: string; actions: string[]; effect: string; priority: number }>
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
  environment: 'development' | 'production' = 'development',
  includePackManaged: boolean = false
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
      args: { organizationId, environment, includePackManaged },
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

async function resolveAgentId(agentSlug: string): Promise<string | undefined> {
  const { agents } = await listAgents()
  const agent = agents.find((a) => a.slug === agentSlug || a._id === agentSlug)
  return agent?._id
}

export async function syncEvalSuites(
  suites: EvalSuiteDefinition[]
): Promise<{ suiteIds?: Record<string, string>; error?: string }> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  const token = apiKey || credentials?.token

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const suiteIds: Record<string, string> = {}

  for (const suite of suites) {
    const agentId = await resolveAgentId(suite.agent)
    if (!agentId) {
      return { error: `Agent "${suite.agent}" not found. Make sure the agent exists before syncing evals.` }
    }

    const listResponse = await fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        path: 'evals:listAllSuites',
        args: { environment: 'development' },
      }),
    })

    let existingSuiteId: string | undefined

    if (listResponse.ok) {
      const listResult = await listResponse.json() as { status: string; value?: Array<{ _id: string; slug: string }> }
      const existing = (listResult.value || []).find((s) => s.slug === suite.slug)
      if (existing) {
        existingSuiteId = existing._id
      }
    }

    if (!existingSuiteId) {
      const createResponse = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          path: 'evals:createSuite',
          args: {
            agentId,
            name: suite.suite,
            slug: suite.slug,
            description: suite.description,
            tags: suite.tags,
            judgeModel: suite.judgeModel
              ? { provider: 'anthropic', name: suite.judgeModel }
              : undefined,
            environment: 'development',
          },
        }),
      })

      if (!createResponse.ok) {
        const error = await createResponse.text()
        return { error: `Failed to create suite "${suite.suite}": ${error}` }
      }

      const createResult = await createResponse.json() as { status: string; value?: string }
      existingSuiteId = createResult.value
    } else {
      const updateResponse = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          path: 'evals:updateSuite',
          args: {
            id: existingSuiteId,
            name: suite.suite,
            description: suite.description,
            tags: suite.tags,
            judgeModel: suite.judgeModel
              ? { provider: 'anthropic', name: suite.judgeModel }
              : undefined,
          },
        }),
      })

      if (!updateResponse.ok) {
        const error = await updateResponse.text()
        return { error: `Failed to update suite "${suite.suite}": ${error}` }
      }

      const deleteResponse = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          path: 'evals:deleteCasesBySuite',
          args: { suiteId: existingSuiteId },
        }),
      })

      if (!deleteResponse.ok) {
        const error = await deleteResponse.text()
        return { error: `Failed to clear cases for suite "${suite.suite}": ${error}` }
      }
    }

    if (existingSuiteId) {
      suiteIds[suite.slug] = existingSuiteId

      for (let i = 0; i < suite.cases.length; i++) {
        const c = suite.cases[i]
        const turns = c.turns.map((t) => ({
          userMessage: t.user,
          assertions: t.assertions?.map((a) => ({
            type: a.type,
            ...(a.criteria ? { criteria: a.criteria } : {}),
            ...(a.value ? { value: a.value } : {}),
            ...(a.weight ? { weight: a.weight } : {}),
          })),
        }))

        const finalAssertions = c.finalAssertions?.map((a) => ({
          type: a.type,
          ...(a.criteria ? { criteria: a.criteria } : {}),
          ...(a.value ? { value: a.value } : {}),
          ...(a.weight ? { weight: a.weight } : {}),
        }))

        const caseResponse = await fetch(`${CONVEX_URL}/api/mutation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            path: 'evals:createCase',
            args: {
              suiteId: existingSuiteId,
              name: c.name,
              description: c.description,
              tags: c.tags,
              turns,
              finalAssertions,
            },
          }),
        })

        if (!caseResponse.ok) {
          const error = await caseResponse.text()
          return { error: `Failed to create case "${c.name}": ${error}` }
        }
      }
    }
  }

  return { suiteIds }
}

export async function startEvalRun(
  suiteSlug: string
): Promise<{ runId?: string; suiteId?: string; error?: string }> {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  const token = apiKey || credentials?.token

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const listResponse = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'evals:listAllSuites',
      args: { environment: 'development' },
    }),
  })

  if (!listResponse.ok) {
    return { error: 'Failed to list suites' }
  }

  const listResult = await listResponse.json() as { status: string; value?: Array<{ _id: string; slug: string }> }
  const suite = (listResult.value || []).find((s) => s.slug === suiteSlug)

  if (!suite) {
    return { error: `Suite "${suiteSlug}" not found` }
  }

  const response = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'evals:startRun',
      args: {
        suiteId: suite._id,
        triggerSource: 'cli',
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { error }
  }

  const result = await response.json() as { status: string; value?: string }
  return { runId: result.value, suiteId: suite._id }
}

export async function pollEvalRun(
  runId: string,
  onProgress?: (status: EvalRunStatus) => void
): Promise<{ run?: EvalRunStatus; error?: string }> {
  const maxAttempts = 300
  const pollInterval = 2000

  for (let i = 0; i < maxAttempts; i++) {
    const currentCredentials = loadCredentials()
    const currentApiKey = getApiKey()
    const token = currentApiKey || currentCredentials?.token

    if (!token) {
      return { error: 'Authentication expired. Please run "struere login" again.' }
    }

    const response = await fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        path: 'evals:getRun',
        args: { id: runId },
      }),
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { error: 'Authentication expired. Please run "struere login" again.' }
      }
      return { error: `Failed to poll run status (HTTP ${response.status})` }
    }

    const result = await response.json() as { status: string; value?: EvalRunStatus }
    const run = result.value

    if (!run) {
      return { error: 'Run not found' }
    }

    if (onProgress) {
      onProgress(run)
    }

    if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
      return { run }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  return { error: 'Run timed out after 10 minutes' }
}

export async function getEvalRunResults(
  runId: string
): Promise<{ results?: EvalResultSummary[]; error?: string }> {
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
      path: 'evals:getRunResults',
      args: { runId },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { error }
  }

  const result = await response.json() as { status: string; value?: EvalResultSummary[] }
  return { results: result.value || [] }
}
