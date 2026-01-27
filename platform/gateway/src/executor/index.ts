import type { StreamChunk } from '@struere/platform-shared'
import type { Env, AgentContext } from '../types'

interface ExecuteOptions {
  bundleCode: string
  message: string
  conversationId: string
  userId?: string
  metadata?: Record<string, unknown>
  env: Env
  agent: AgentContext
}

interface ExecuteResult {
  content: string
  toolCalls: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
    result: unknown
  }>
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  finishReason: 'stop' | 'tool_calls' | 'max_tokens' | 'error'
  error?: string
}

interface StreamOptions extends ExecuteOptions {
  onChunk: (chunk: StreamChunk) => Promise<void>
  onComplete: (result: ExecuteResult) => Promise<void>
  onError: (error: Error) => Promise<void>
}

export async function executeAgent(options: ExecuteOptions): Promise<ExecuteResult> {
  const { bundleCode, message, conversationId, userId, metadata, env, agent } = options

  const conversationKey = `conv:${agent.organizationId}:${conversationId}`
  const existingConv = await env.CONVERSATIONS.get(conversationKey, 'json') as {
    messages: Array<{ role: string; content: string }>
  } | null

  const messages = existingConv?.messages || []
  messages.push({ role: 'user', content: message })

  try {
    const agentModule = await importAgentModule(bundleCode)
    const agentConfig = agentModule.default || agentModule

    const systemPrompt = typeof agentConfig.systemPrompt === 'function'
      ? await agentConfig.systemPrompt()
      : agentConfig.systemPrompt

    const result = await callLLM({
      model: agentConfig.model,
      systemPrompt,
      messages,
      tools: agentConfig.tools,
      env
    })

    messages.push({ role: 'assistant', content: result.content })

    await env.CONVERSATIONS.put(conversationKey, JSON.stringify({ messages }), {
      expirationTtl: 60 * 60 * 24
    })

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      content: '',
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      finishReason: 'error',
      error: errorMessage
    }
  }
}

export async function streamAgent(options: StreamOptions): Promise<void> {
  const { bundleCode, message, conversationId, env, agent, onChunk, onComplete, onError } = options

  const conversationKey = `conv:${agent.organizationId}:${conversationId}`
  const existingConv = await env.CONVERSATIONS.get(conversationKey, 'json') as {
    messages: Array<{ role: string; content: string }>
  } | null

  const messages = existingConv?.messages || []
  messages.push({ role: 'user', content: message })

  try {
    const agentModule = await importAgentModule(bundleCode)
    const agentConfig = agentModule.default || agentModule

    const systemPrompt = typeof agentConfig.systemPrompt === 'function'
      ? await agentConfig.systemPrompt()
      : agentConfig.systemPrompt

    let fullContent = ''
    const toolCalls: ExecuteResult['toolCalls'] = []
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

    await streamLLM({
      model: agentConfig.model,
      systemPrompt,
      messages,
      tools: agentConfig.tools,
      env,
      onChunk: async (chunk) => {
        if (chunk.type === 'text-delta' && chunk.content) {
          fullContent += chunk.content
        }
        await onChunk(chunk)
      }
    })

    await onChunk({ type: 'finish', usage })

    messages.push({ role: 'assistant', content: fullContent })

    await env.CONVERSATIONS.put(conversationKey, JSON.stringify({ messages }), {
      expirationTtl: 60 * 60 * 24
    })

    await onComplete({
      content: fullContent,
      toolCalls,
      usage,
      finishReason: 'stop'
    })
  } catch (error) {
    await onError(error instanceof Error ? error : new Error('Unknown error'))
  }
}

async function importAgentModule(bundleCode: string): Promise<Record<string, unknown>> {
  const blob = new Blob([bundleCode], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)

  try {
    return await import(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

interface LLMOptions {
  model?: {
    provider?: string
    name?: string
    apiKey?: string
    temperature?: number
    maxTokens?: number
  }
  systemPrompt: string
  messages: Array<{ role: string; content: string }>
  tools?: Array<{
    name: string
    description?: string
    parameters?: Record<string, unknown>
    handler: (args: Record<string, unknown>) => Promise<unknown>
  }>
  env: Env
}

async function callLLM(options: LLMOptions): Promise<ExecuteResult> {
  const { model, systemPrompt, messages, tools } = options

  const provider = model?.provider || 'anthropic'
  const modelName = model?.name || 'claude-sonnet-4-20250514'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': model?.apiKey || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: model?.maxTokens || 4096,
      temperature: model?.temperature || 0.7,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      })),
      tools: tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters || { type: 'object', properties: {} }
      }))
    })
  })

  const data = await response.json() as {
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>
    usage: { input_tokens: number; output_tokens: number }
    stop_reason: string
  }

  let content = ''
  const toolCalls: ExecuteResult['toolCalls'] = []

  for (const block of data.content) {
    if (block.type === 'text' && block.text) {
      content += block.text
    } else if (block.type === 'tool_use' && block.id && block.name) {
      const tool = tools?.find(t => t.name === block.name)
      if (tool) {
        const result = await tool.handler(block.input || {})
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input || {},
          result
        })
      }
    }
  }

  return {
    content,
    toolCalls,
    usage: {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens
    },
    finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'tool_calls'
  }
}

async function streamLLM(
  options: LLMOptions & { onChunk: (chunk: StreamChunk) => Promise<void> }
): Promise<void> {
  const { model, systemPrompt, messages, tools, onChunk } = options

  const modelName = model?.name || 'claude-sonnet-4-20250514'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': model?.apiKey || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: model?.maxTokens || 4096,
      temperature: model?.temperature || 0.7,
      stream: true,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      })),
      tools: tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters || { type: 'object', properties: {} }
      }))
    })
  })

  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const event = JSON.parse(data) as {
            type: string
            delta?: { type: string; text?: string }
          }

          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            await onChunk({ type: 'text-delta', content: event.delta.text })
          }
        } catch {
          continue
        }
      }
    }
  }
}
