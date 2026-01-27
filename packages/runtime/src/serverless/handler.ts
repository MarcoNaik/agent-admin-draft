import type { AgentConfig } from '@struere/core'
import { AgentExecutor } from '../engine/AgentExecutor.js'
import type { ExecutionRequest, StreamChunk } from '../types.js'

export interface ServerlessRequest {
  method: string
  body: unknown
  headers: Record<string, string | undefined>
  query?: Record<string, string | undefined>
}

export interface ServerlessResponse {
  status: number
  headers: Record<string, string>
  body: string | ReadableStream
}

export interface HandlerOptions {
  streaming?: boolean
  corsOrigins?: string[]
}

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function getCorsHeaders(origins: string[]): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origins.length > 0 ? origins.join(', ') : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }
}

export function createHandler(agent: AgentConfig, options: HandlerOptions = {}) {
  const executor = new AgentExecutor(agent)
  const corsHeaders = getCorsHeaders(options.corsOrigins || [])

  return async (request: ServerlessRequest): Promise<ServerlessResponse> => {
    if (request.method === 'OPTIONS') {
      return {
        status: 204,
        headers: corsHeaders,
        body: ''
      }
    }

    if (request.method !== 'POST') {
      return {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method not allowed' })
      }
    }

    const body = request.body as {
      message?: string
      conversationId?: string
      userId?: string
      stream?: boolean
    }

    if (!body.message) {
      return {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Message is required' })
      }
    }

    const executionRequest: ExecutionRequest = {
      conversationId: body.conversationId || generateConversationId(),
      userId: body.userId,
      message: body.message
    }

    const shouldStream = body.stream ?? options.streaming ?? false

    if (shouldStream) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()

          const sendEvent = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
          }

          sendEvent('start', { conversationId: executionRequest.conversationId })

          for await (const chunk of executor.stream(executionRequest)) {
            sendEvent(chunk.type, chunk)
          }

          controller.close()
        }
      })

      return {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        body: stream
      }
    }

    const response = await executor.execute(executionRequest)

    return {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    }
  }
}

export { AgentExecutor }
