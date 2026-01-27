import type { Context } from 'hono'
import { ValidationError, ExecutionError, chatRequestSchema, generateId } from '@struere/platform-shared'
import { executeAgent, streamAgent } from '../executor'
import type { Env, AgentContext, ApiKeyContext } from '../types'

export async function chatHandler(
  c: Context<{ Bindings: Env; Variables: { apiKey: ApiKeyContext; agent: AgentContext } }>
) {
  const body = await c.req.json()
  const parsed = chatRequestSchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError('Invalid input', { errors: parsed.error.flatten() })
  }

  const { message, conversationId, userId, stream, metadata } = parsed.data
  const agent = c.get('agent')
  const apiKey = c.get('apiKey')

  const execContext = {
    conversationId: conversationId || generateId('conv'),
    userId,
    startTime: Date.now()
  }

  const bundle = await c.env.BUNDLES.get(agent.bundleKey)
  if (!bundle) {
    throw new ExecutionError('Agent bundle not found')
  }

  const bundleCode = await bundle.text()

  if (stream) {
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    streamAgent({
      bundleCode,
      message,
      conversationId: execContext.conversationId,
      userId,
      metadata,
      env: c.env,
      agent,
      onChunk: async (chunk) => {
        await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      },
      onComplete: async (result) => {
        await recordExecution(c.env, agent, apiKey, execContext, result)
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
    bundleCode,
    message,
    conversationId: execContext.conversationId,
    userId,
    metadata,
    env: c.env,
    agent
  })

  await recordExecution(c.env, agent, apiKey, execContext, result)

  return c.json({
    id: generateId('msg'),
    conversationId: execContext.conversationId,
    content: result.content,
    toolCalls: result.toolCalls,
    usage: result.usage,
    finishReason: result.finishReason
  })
}

async function recordExecution(
  env: Env,
  agent: AgentContext,
  apiKey: ApiKeyContext,
  context: { conversationId: string; startTime: number },
  result: { usage: { inputTokens: number; outputTokens: number }; error?: string }
) {
  const durationMs = Date.now() - context.startTime

  await env.DB.prepare(`
    INSERT INTO executions (
      id, organization_id, agent_id, version_id, conversation_id,
      input_tokens, output_tokens, duration_ms, status, error_message, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    generateId('exe'),
    apiKey.organizationId,
    agent.agentId,
    agent.versionId,
    context.conversationId,
    result.usage.inputTokens,
    result.usage.outputTokens,
    durationMs,
    result.error ? 'error' : 'success',
    result.error || null,
    Math.floor(Date.now() / 1000)
  ).run()
}
