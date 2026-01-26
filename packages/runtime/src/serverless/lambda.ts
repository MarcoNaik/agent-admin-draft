import type { AgentConfig } from '@marco-kueks/agent-factory-core'
import { createHandler, type HandlerOptions, type ServerlessRequest } from './handler.js'

export interface LambdaEvent {
  httpMethod: string
  body: string | null
  headers: Record<string, string | undefined>
  queryStringParameters?: Record<string, string | undefined>
  isBase64Encoded?: boolean
}

export interface LambdaContext {
  awsRequestId: string
  functionName: string
  memoryLimitInMB: string
  remainingTime?: number
}

export interface LambdaResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  isBase64Encoded?: boolean
}

export interface LambdaStreamingResponse {
  statusCode: number
  headers: Record<string, string>
}

export function createLambdaHandler(agent: AgentConfig, options: HandlerOptions = {}) {
  const handler = createHandler(agent, { ...options, streaming: false })

  return async (event: LambdaEvent, context: LambdaContext): Promise<LambdaResponse> => {
    let body: unknown = null

    if (event.body) {
      if (event.isBase64Encoded) {
        body = JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'))
      } else {
        body = JSON.parse(event.body)
      }
    }

    const serverlessRequest: ServerlessRequest = {
      method: event.httpMethod,
      body,
      headers: event.headers,
      query: event.queryStringParameters
    }

    const response = await handler(serverlessRequest)

    return {
      statusCode: response.status,
      headers: response.headers,
      body: typeof response.body === 'string' ? response.body : JSON.stringify({ error: 'Streaming not supported in Lambda' })
    }
  }
}

export function createLambdaStreamingHandler(agent: AgentConfig, options: HandlerOptions = {}) {
  const handler = createHandler(agent, { ...options, streaming: true })

  return async function* (event: LambdaEvent, context: LambdaContext): AsyncGenerator<string | LambdaStreamingResponse> {
    let body: unknown = null

    if (event.body) {
      if (event.isBase64Encoded) {
        body = JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'))
      } else {
        body = JSON.parse(event.body)
      }
    }

    const serverlessRequest: ServerlessRequest = {
      method: event.httpMethod,
      body,
      headers: event.headers,
      query: event.queryStringParameters
    }

    const response = await handler(serverlessRequest)

    yield {
      statusCode: response.status,
      headers: response.headers
    }

    if (response.body instanceof ReadableStream) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        yield decoder.decode(value, { stream: true })
      }
    } else {
      yield response.body
    }
  }
}
