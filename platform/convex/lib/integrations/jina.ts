const MAX_CONTENT_LENGTH = 50000

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  const apiKey = process.env.JINA_API_KEY
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`
  }
  return headers
}

function truncateContent(data: any): any {
  if (typeof data === "string" && data.length > MAX_CONTENT_LENGTH) {
    return data.slice(0, MAX_CONTENT_LENGTH)
  }
  if (Array.isArray(data)) {
    return data.map(truncateContent)
  }
  if (data && typeof data === "object") {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      result[key] = truncateContent(value)
    }
    return result
  }
  return data
}

export async function jinaSearch(params: {
  query: string
  maxResults?: number
  site?: string[]
  gl?: string
  hl?: string
}): Promise<{ code: number; status: number; data: any }> {
  const url = new URL(`https://s.jina.ai/${encodeURIComponent(params.query)}`)
  url.searchParams.set("num", String(params.maxResults ?? 5))
  if (params.site && params.site.length > 0) {
    for (const s of params.site) {
      url.searchParams.append("site", s)
    }
  }
  if (params.gl) {
    url.searchParams.set("gl", params.gl)
  }
  if (params.hl) {
    url.searchParams.set("hl", params.hl)
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getHeaders(),
  })

  const json = await response.json()
  json.data = truncateContent(json.data)
  return json
}

export async function jinaFetch(params: {
  url: string
  targetSelector?: string
  removeSelector?: string
  tokenBudget?: number
}): Promise<{ code: number; status: number; data: any }> {
  const headers = getHeaders()
  if (params.targetSelector) {
    headers["X-Target-Selector"] = params.targetSelector
  }
  if (params.removeSelector) {
    headers["X-Remove-Selector"] = params.removeSelector
  }
  if (params.tokenBudget) {
    headers["X-Token-Budget"] = String(params.tokenBudget)
  }

  const response = await fetch(`https://r.jina.ai/${params.url}`, {
    method: "GET",
    headers,
  })

  const json = await response.json()
  json.data = truncateContent(json.data)
  return json
}
