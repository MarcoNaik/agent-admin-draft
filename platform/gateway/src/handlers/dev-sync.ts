import type { Context } from 'hono'
import { ValidationError, ExecutionError, chatRequestSchema, generateId } from '@struere/platform-shared'
import { executeAgent, streamAgent } from '../executor'
import type { Env } from '../types'

export async function devSyncHandler(c: Context<{ Bindings: Env }>) {
  const sessionId = c.req.param('sessionId')

  const session = await c.env.STATE.get(`dev:${sessionId}`, 'json') as {
    organizationId: string
    agentId: string
    bundleCode: string
  } | null

  if (!session) {
    throw new ExecutionError('Dev session not found or expired')
  }

  const body = await c.req.json()
  const parsed = chatRequestSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
  }

  const { message, conversationId, userId, stream, metadata } = parsed.data
  const convId = conversationId || generateId('conv')

  if (stream) {
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    streamAgent({
      bundleCode: session.bundleCode,
      message,
      conversationId: convId,
      userId,
      metadata,
      env: c.env,
      agent: {
        agentId: session.agentId,
        organizationId: session.organizationId,
        slug: 'dev',
        versionId: 'dev',
        bundleKey: 'dev'
      },
      onChunk: async (chunk) => {
        await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      },
      onComplete: async () => {
        await writer.close()
      },
      onError: async (error) => {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`))
        await writer.close()
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  }

  const result = await executeAgent({
    bundleCode: session.bundleCode,
    message,
    conversationId: convId,
    userId,
    metadata,
    env: c.env,
    agent: {
      agentId: session.agentId,
      organizationId: session.organizationId,
      slug: 'dev',
      versionId: 'dev',
      bundleKey: 'dev'
    }
  })

  return c.json({
    id: generateId('msg'),
    conversationId: convId,
    content: result.content,
    toolCalls: result.toolCalls,
    usage: result.usage,
    finishReason: result.finishReason
  })
}
