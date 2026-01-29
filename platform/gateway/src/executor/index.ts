import type { StreamChunk } from '@struere/platform-shared'
import type { Env, AgentContext } from '../types'
import {
  builtinTools,
  createToolContext,
  createDefaultActorContext,
  wrapAllToolsWithPermissions,
  mergeTools,
  formatToolForLLM
} from '../tools'
import type { ToolContext, ConversationActor, AgentBundleTool } from '../tools'

interface ExecuteOptions {
  bundleCode: string
  message: string
  conversationId: string
  userId?: string
  metadata?: Record<string, unknown>
  env: Env
  agent: AgentContext
  conversationActor?: ConversationActor
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

interface AgentConfig {
  systemPrompt?: string | (() => string | Promise<string>)
  model?: {
    provider?: string
    name?: string
    apiKey?: string
    temperature?: number
    maxTokens?: number
  }
  tools?: Array<{
    name: string
    description?: string
    parameters?: Record<string, unknown>
    handler: (args: Record<string, unknown>) => Promise<unknown>
  }>
  enableBuiltinTools?: boolean | string[]
}

interface MergedTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

async function prepareTools(
  agentConfig: AgentConfig,
  env: Env,
  agent: AgentContext,
  conversationActor: ConversationActor
): Promise<{ tools: MergedTool[]; toolContexts: Map<string, ToolContext> }> {
  const tools: MergedTool[] = []
  const toolContexts = new Map<string, ToolContext>()

  const enableBuiltin = agentConfig.enableBuiltinTools
  const shouldEnableBuiltin = enableBuiltin === true ||
    (Array.isArray(enableBuiltin) && enableBuiltin.length > 0) ||
    enableBuiltin === undefined

  if (shouldEnableBuiltin) {
    const builtinToolNames = Array.isArray(enableBuiltin)
      ? enableBuiltin
      : Object.keys(builtinTools)

    for (const toolName of builtinToolNames) {
      const tool = builtinTools[toolName]
      if (!tool) continue

      const ctx = await createToolContext(env, agent, toolName, conversationActor)
      toolContexts.set(toolName, ctx)

      const wrappedTools = wrapAllToolsWithPermissions({ [toolName]: tool }, ctx)
      const wrappedTool = wrappedTools[toolName]

      tools.push({
        name: wrappedTool.name,
        description: wrappedTool.description,
        parameters: wrappedTool.parameters,
        handler: wrappedTool.handler
      })
    }
  }

  const bundleTools: AgentBundleTool[] = agentConfig.tools || []
  for (const bundleTool of bundleTools) {
    const existingIdx = tools.findIndex(t => t.name === bundleTool.name)
    if (existingIdx === -1) {
      tools.push({
        name: bundleTool.name,
        description: bundleTool.description || '',
        parameters: bundleTool.parameters || {},
        handler: bundleTool.handler
      })
    }
  }

  return { tools, toolContexts }
}

export async function executeAgent(options: ExecuteOptions): Promise<ExecuteResult> {
  const { bundleCode, message, conversationId, userId, metadata, env, agent, conversationActor } = options

  const conversationKey = `conv:${agent.organizationId}:${conversationId}`
  const existingConv = await env.CONVERSATIONS.get(conversationKey, 'json') as {
    messages: Array<{ role: string; content: string | Array<{ type: string; tool_use_id?: string; content?: string; text?: string }> }>
    actor?: ConversationActor
  } | null

  const messages = existingConv?.messages || []
  messages.push({ role: 'user', content: message })

  const actor: ConversationActor = conversationActor ||
    existingConv?.actor ||
    createDefaultActorContext(agent.organizationId, userId)

  try {
    const agentModule = await importAgentModule(bundleCode)
    const agentConfig = agentModule.default || agentModule

    const systemPrompt = typeof agentConfig.systemPrompt === 'function'
      ? await agentConfig.systemPrompt()
      : agentConfig.systemPrompt || ''

    const { tools } = await prepareTools(agentConfig, env, agent, actor)

    const result = await callLLMWithToolLoop({
      model: agentConfig.model,
      systemPrompt,
      messages,
      tools,
      env,
      maxIterations: 10
    })

    messages.push({ role: 'assistant', content: result.content })

    await env.CONVERSATIONS.put(conversationKey, JSON.stringify({ messages, actor }), {
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
  const { bundleCode, message, conversationId, userId, env, agent, conversationActor, onChunk, onComplete, onError } = options

  const conversationKey = `conv:${agent.organizationId}:${conversationId}`
  const existingConv = await env.CONVERSATIONS.get(conversationKey, 'json') as {
    messages: Array<{ role: string; content: string }>
    actor?: ConversationActor
  } | null

  const messages = existingConv?.messages || []
  messages.push({ role: 'user', content: message })

  const actor: ConversationActor = conversationActor ||
    existingConv?.actor ||
    createDefaultActorContext(agent.organizationId, userId)

  try {
    const agentModule = await importAgentModule(bundleCode)
    const agentConfig = agentModule.default || agentModule

    const systemPrompt = typeof agentConfig.systemPrompt === 'function'
      ? await agentConfig.systemPrompt()
      : agentConfig.systemPrompt || ''

    const { tools } = await prepareTools(agentConfig, env, agent, actor)

    let fullContent = ''
    const toolCalls: ExecuteResult['toolCalls'] = []
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

    await streamLLM({
      model: agentConfig.model,
      systemPrompt,
      messages,
      tools,
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

    await env.CONVERSATIONS.put(conversationKey, JSON.stringify({ messages, actor }), {
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

async function importAgentModule(bundleCode: string): Promise<{ default?: AgentConfig } & AgentConfig> {
  const dataUrl = `data:application/javascript;base64,${btoa(bundleCode)}`
  return await import(dataUrl)
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
  messages: Array<{ role: string; content: string | Array<{ type: string; tool_use_id?: string; content?: string; text?: string }> }>
  tools: MergedTool[]
  env: Env
}

interface LLMOptionsWithLoop extends LLMOptions {
  maxIterations: number
}

async function callLLMWithToolLoop(options: LLMOptionsWithLoop): Promise<ExecuteResult> {
  const { model, systemPrompt, messages, tools, env, maxIterations } = options

  const allToolCalls: ExecuteResult['toolCalls'] = []
  let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  let iteration = 0
  let finalContent = ''

  const workingMessages = [...messages]

  while (iteration < maxIterations) {
    iteration++

    const result = await callLLMSingle({
      model,
      systemPrompt,
      messages: workingMessages,
      tools,
      env
    })

    totalUsage.inputTokens += result.usage.inputTokens
    totalUsage.outputTokens += result.usage.outputTokens
    totalUsage.totalTokens += result.usage.totalTokens

    finalContent = result.content
    allToolCalls.push(...result.toolCalls)

    if (result.finishReason !== 'tool_calls' || result.toolCalls.length === 0) {
      break
    }

    const assistantContent: Array<{ type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string }> = []

    if (result.content) {
      assistantContent.push({ type: 'text', text: result.content })
    }

    for (const tc of result.toolCalls) {
      assistantContent.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.arguments
      })
    }

    workingMessages.push({ role: 'assistant', content: assistantContent })

    const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = []
    for (const tc of result.toolCalls) {
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result)
      })
    }

    workingMessages.push({ role: 'user', content: toolResults })
  }

  return {
    content: finalContent,
    toolCalls: allToolCalls,
    usage: totalUsage,
    finishReason: iteration >= maxIterations ? 'max_tokens' : 'stop'
  }
}

async function callLLMSingle(options: LLMOptions): Promise<ExecuteResult> {
  const { model, systemPrompt, messages, tools, env } = options

  const modelName = model?.name || 'claude-sonnet-4-20250514'

  const formattedMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }))

  const formattedTools = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object' as const,
      properties: t.parameters,
      ...extractRequired(t.parameters)
    }
  }))

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': model?.apiKey || env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: model?.maxTokens || 4096,
      temperature: model?.temperature || 0.7,
      system: systemPrompt,
      messages: formattedMessages,
      tools: formattedTools.length > 0 ? formattedTools : undefined
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
      const tool = tools.find(t => t.name === block.name)
      if (tool) {
        try {
          const result = await tool.handler(block.input || {})
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input || {},
            result
          })
        } catch (error) {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input || {},
            result: { error: error instanceof Error ? error.message : 'Tool execution failed' }
          })
        }
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
    finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop'
  }
}

function extractRequired(parameters: Record<string, unknown>): { required?: string[] } {
  const required: string[] = []
  for (const [key, value] of Object.entries(parameters)) {
    if (value && typeof value === 'object' && 'required' in value && value.required === true) {
      required.push(key)
    }
  }
  return required.length > 0 ? { required } : {}
}

async function streamLLM(
  options: LLMOptions & { onChunk: (chunk: StreamChunk) => Promise<void> }
): Promise<void> {
  const { model, systemPrompt, messages, tools, env, onChunk } = options

  const modelName = model?.name || 'claude-sonnet-4-20250514'

  const formattedMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }))

  const formattedTools = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object' as const,
      properties: t.parameters,
      ...extractRequired(t.parameters)
    }
  }))

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': model?.apiKey || env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: model?.maxTokens || 4096,
      temperature: model?.temperature || 0.7,
      stream: true,
      system: systemPrompt,
      messages: formattedMessages,
      tools: formattedTools.length > 0 ? formattedTools : undefined
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
