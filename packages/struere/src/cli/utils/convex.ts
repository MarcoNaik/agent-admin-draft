import { loadCredentials, getApiKey } from './credentials'

const CONVEX_URL = process.env.STRUERE_CONVEX_URL || 'https://struere.convex.cloud'

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

interface SyncResult {
  success: boolean
  error?: string
}

interface DeployResult {
  success: boolean
  configId?: string
  error?: string
}

export async function syncToConvex(
  agentId: string,
  config: AgentConfig
): Promise<SyncResult> {
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

export async function deployToProduction(agentId: string): Promise<DeployResult> {
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
      path: 'agents:deploy',
      args: { agentId },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { success: false, error }
  }

  const result = await response.json() as { success?: boolean; configId?: string }
  return { success: result.success ?? true, configId: result.configId }
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
    organizationId: string
  }
  organization: {
    id: string
    name: string
    slug: string
  }
}

export async function getUserInfo(token: string): Promise<{ userInfo?: UserInfo; error?: string }> {
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

  const user = await response.json() as { _id: string; email: string; name?: string; organizationId: string } | null
  if (!user) {
    return { error: 'User not found' }
  }

  const orgResponse = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'organizations:getCurrent',
      args: {},
    }),
  })

  if (!orgResponse.ok) {
    return { error: 'Failed to fetch organization' }
  }

  const org = await orgResponse.json() as { _id: string; name: string; slug: string }

  return {
    userInfo: {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
      },
      organization: {
        id: org._id,
        name: org.name,
        slug: org.slug,
      },
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
