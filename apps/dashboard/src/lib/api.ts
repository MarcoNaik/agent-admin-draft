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
}
