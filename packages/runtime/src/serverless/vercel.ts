import type { AgentConfig } from '@marco-kueks/agent-factory-core'
import { createHandler, type HandlerOptions, type ServerlessRequest, type ServerlessResponse } from './handler.js'

export interface VercelRequest {
  method: string
  body: unknown
  headers: Headers | Record<string, string | undefined>
  url?: string
}

export interface VercelContext {
  waitUntil?: (promise: Promise<unknown>) => void
}

function headersToRecord(headers: Headers | Record<string, string | undefined>): Record<string, string | undefined> {
  if (headers instanceof Headers) {
    const record: Record<string, string | undefined> = {}
    headers.forEach((value, key) => {
      record[key.toLowerCase()] = value
    })
    return record
  }
  return headers
}

export function createVercelHandler(agent: AgentConfig, options: HandlerOptions = {}) {
  const handler = createHandler(agent, options)

  return async (req: VercelRequest | Request, context?: VercelContext): Promise<Response> => {
    let method: string
    let body: unknown
    let headers: Record<string, string | undefined>

    if (req instanceof Request) {
      method = req.method
      headers = headersToRecord(req.headers)
      if (method === 'POST') {
        body = await req.json()
      }
    } else {
      method = req.method
      headers = headersToRecord(req.headers)
      body = req.body
    }

    const serverlessRequest: ServerlessRequest = {
      method,
      body,
      headers
    }

    const response = await handler(serverlessRequest)

    if (response.body instanceof ReadableStream) {
      return new Response(response.body, {
        status: response.status,
        headers: response.headers
      })
    }

    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    })
  }
}

export const config = {
  runtime: 'edge'
}
