const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.struere.dev"

interface ApiOptions {
  method?: string
  body?: unknown
  token?: string
}

async function fetchApi<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error?.message || `HTTP ${response.status}`)
  }

  return data as T
}

export interface Agent {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  currentVersionId: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentVersion {
  id: string
  version: string
  status: string
  deployedAt: string
}

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  permissions: string[]
  lastUsedAt: string | null
  createdAt: string
}

export interface UsageSummary {
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
}

export interface Deployment {
  id: string
  agentId: string
  versionId: string
  environment: "preview" | "staging" | "production"
  url: string
  status: string
  createdAt: string
}

export interface DeployKey {
  id: string
  name: string
  keyPrefix: string
  environment: "preview" | "production"
  createdAt: string
}

export interface EnvironmentVariable {
  id: string
  key: string
  value: string
  environment: "preview" | "production"
  createdAt: string
}

export interface AgentLog {
  id: string
  agentId: string
  level: "info" | "warn" | "error" | "debug"
  message: string
  metadata: Record<string, unknown>
  timestamp: string
}

export const api = {
  agents: {
    list: (token: string) =>
      fetchApi<{ agents: Agent[] }>("/v1/agents", { token }),

    get: (token: string, id: string) =>
      fetchApi<{ agent: Agent; versions: AgentVersion[] }>(`/v1/agents/${id}`, { token }),

    create: (token: string, data: { name: string; slug: string; description?: string }) =>
      fetchApi<{ agent: Agent }>("/v1/agents", { method: "POST", body: data, token }),

    update: (token: string, id: string, data: { name?: string; description?: string; status?: string }) =>
      fetchApi<{ agent: Agent }>(`/v1/agents/${id}`, { method: "PATCH", body: data, token }),

    delete: (token: string, id: string) =>
      fetchApi<{ success: boolean }>(`/v1/agents/${id}`, { method: "DELETE", token }),
  },

  apiKeys: {
    list: (token: string) =>
      fetchApi<{ apiKeys: ApiKey[] }>("/v1/api-keys", { token }),

    create: (token: string, data: { name: string; permissions: string[] }) =>
      fetchApi<{ apiKey: ApiKey & { key: string } }>("/v1/api-keys", { method: "POST", body: data, token }),

    delete: (token: string, id: string) =>
      fetchApi<{ success: boolean }>(`/v1/api-keys/${id}`, { method: "DELETE", token }),
  },

  usage: {
    get: (token: string, period: "hour" | "day" | "week" | "month" = "day") =>
      fetchApi<UsageSummary>(`/v1/usage?period=${period}`, { token }),
  },

  user: {
    me: (token: string) =>
      fetchApi<{
        user: { id: string; email: string; name: string; organizationId: string; role: string }
        organization: { id: string; name: string; slug: string; plan: string }
      }>("/v1/auth/clerk/me", { token }),
  },

  deployments: {
    list: (token: string, agentId: string) =>
      fetchApi<{ deployments: Deployment[] }>(`/v1/agents/${agentId}/deployments`, { token }),
  },

  deployKeys: {
    list: (token: string, agentId: string) =>
      fetchApi<{ deployKeys: DeployKey[] }>(`/v1/agents/${agentId}/deploy-keys`, { token }),

    create: (token: string, agentId: string, data: { name: string; environment: "preview" | "production" }) =>
      fetchApi<{ deployKey: DeployKey & { key: string } }>(`/v1/agents/${agentId}/deploy-keys`, {
        method: "POST",
        body: data,
        token,
      }),

    delete: (token: string, agentId: string, keyId: string) =>
      fetchApi<{ success: boolean }>(`/v1/agents/${agentId}/deploy-keys/${keyId}`, { method: "DELETE", token }),
  },

  envVars: {
    list: (token: string, agentId: string) =>
      fetchApi<{ envVars: EnvironmentVariable[] }>(`/v1/agents/${agentId}/env-vars`, { token }),

    set: (token: string, agentId: string, data: { key: string; value: string; environment: "preview" | "production" }) =>
      fetchApi<{ envVar: EnvironmentVariable }>(`/v1/agents/${agentId}/env-vars`, {
        method: "POST",
        body: data,
        token,
      }),

    delete: (token: string, agentId: string, key: string, environment: "preview" | "production") =>
      fetchApi<{ success: boolean }>(`/v1/agents/${agentId}/env-vars/${key}?environment=${environment}`, {
        method: "DELETE",
        token,
      }),
  },

  logs: {
    list: (token: string, agentId: string, options?: { level?: string; limit?: number }) =>
      fetchApi<{ logs: AgentLog[] }>(
        `/v1/agents/${agentId}/logs${options ? `?${new URLSearchParams(options as Record<string, string>)}` : ""}`,
        { token }
      ),
  },
}
