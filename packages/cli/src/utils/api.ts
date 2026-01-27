import { getToken, getApiKey } from './credentials'

const DEFAULT_API_URL = 'https://api.struere.dev'
const DEFAULT_GATEWAY_URL = 'https://gateway.struere.dev'
const DEFAULT_SYNC_URL = 'wss://gateway.struere.dev'

export function getApiUrl(): string {
  return process.env.STRUERE_API_URL || DEFAULT_API_URL
}

export function getGatewayUrl(): string {
  return process.env.STRUERE_GATEWAY_URL || DEFAULT_GATEWAY_URL
}

export function getSyncUrl(): string {
  return process.env.STRUERE_SYNC_URL || DEFAULT_SYNC_URL
}

export class ApiClient {
  private baseUrl: string
  private tokenOverride?: string
  private useClerkAuth: boolean

  constructor(baseUrl?: string, token?: string, useClerkAuth = false) {
    this.baseUrl = baseUrl || getApiUrl()
    this.tokenOverride = token
    this.useClerkAuth = useClerkAuth || !!token
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.tokenOverride || getToken()
    const apiKey = getApiKey()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    } else if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers
    })

    const data = await response.json() as T | { error: { code: string; message: string } }

    if (!response.ok) {
      const error = data as { error: { code: string; message: string } }
      throw new ApiError(
        error.error?.message || `HTTP ${response.status}`,
        error.error?.code || 'UNKNOWN_ERROR',
        response.status
      )
    }

    return data as T
  }

  async login(email: string, password: string) {
    return this.request<{
      token: string
      user: { id: string; email: string; name: string; organizationId: string; role: string }
    }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
  }

  async signup(email: string, name: string, password: string) {
    return this.request<{
      token: string
      user: { id: string; email: string; name: string; organizationId: string; role: string }
    }>('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, name, password })
    })
  }

  async getMe() {
    const endpoint = this.useClerkAuth ? '/v1/auth/clerk/me' : '/v1/auth/me'
    return this.request<{
      user: { id: string; email: string; name: string; organizationId: string; role: string }
      organization: { id: string; name: string; slug: string; plan: string }
      cliToken?: string
    }>(endpoint)
  }

  async refreshToken() {
    return this.request<{ token: string }>('/v1/auth/refresh', { method: 'POST' })
  }

  async listAgents() {
    return this.request<{
      agents: Array<{
        id: string
        name: string
        slug: string
        description: string | null
        status: string
        currentVersionId: string | null
        createdAt: string
        updatedAt: string
      }>
    }>('/v1/agents')
  }

  async createAgent(data: { name: string; slug: string; description?: string }) {
    return this.request<{
      agent: { id: string; name: string; slug: string; status: string }
    }>('/v1/agents', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getAgent(agentId: string) {
    return this.request<{
      agent: { id: string; name: string; slug: string; status: string; currentVersionId: string | null }
      versions: Array<{ id: string; version: string; status: string; deployedAt: string }>
    }>(`/v1/agents/${agentId}`)
  }

  async deployAgent(agentId: string, data: {
    bundle: string
    version: string
    environment: 'preview' | 'staging' | 'production'
    metadata: { modelProvider: string; modelName: string; toolCount: number; bundleSize: number }
  }) {
    return this.request<{
      deployment: {
        id: string
        agentId: string
        versionId: string
        version: string
        environment: string
        url: string
        status: string
      }
    }>(`/v1/deployments/agents/${agentId}/deploy`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async createApiKey(data: { name: string; permissions: string[] }) {
    return this.request<{
      apiKey: {
        id: string
        name: string
        key: string
        keyPrefix: string
        permissions: string[]
      }
    }>('/v1/api-keys', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async listApiKeys() {
    return this.request<{
      apiKeys: Array<{
        id: string
        name: string
        keyPrefix: string
        permissions: string[]
        lastUsedAt: string | null
        createdAt: string
      }>
    }>('/v1/api-keys')
  }

  async getUsage(period: 'hour' | 'day' | 'week' | 'month' = 'day') {
    return this.request<{
      period: string
      startDate: string
      endDate: string
      summary: {
        executions: number
        inputTokens: number
        outputTokens: number
        totalTokens: number
        avgDurationMs: number
        successRate: number
      }
    }>(`/v1/usage?period=${period}`)
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
