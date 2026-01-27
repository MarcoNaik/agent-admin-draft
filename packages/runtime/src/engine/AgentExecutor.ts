import type { AgentConfig, ToolContext, ToolReference } from '@struere/core'
import type {
  ExecutionRequest,
  ExecutionResponse,
  StreamChunk,
  ConversationMessage,
  ToolCallResult,
  StateBackend,
  ProviderAdapter,
  ToolDefinition
} from '../types.js'
import { createProvider } from '../providers/index.js'
import { convertToolReferenceToDefinition } from '../tools/ToolConverter.js'
import { MemoryStateBackend } from '../state/MemoryStateBackend.js'
import { ConversationStore } from '../state/ConversationStore.js'

const MAX_TOOL_ITERATIONS = 10

interface ModelConfiguration {
  provider: 'anthropic' | 'openai' | 'google' | 'custom'
  name: string
  temperature: number
  maxTokens: number
  apiKey?: string
}

const DEFAULT_MODEL: ModelConfiguration = {
  provider: 'anthropic',
  name: 'claude-sonnet-4-20250514',
  temperature: 0.7,
  maxTokens: 4096
}

export interface AgentExecutorOptions {
  stateBackend?: StateBackend
}

export class AgentExecutor {
  private agent: AgentConfig
  private provider: ProviderAdapter
  private stateBackend: StateBackend
  private conversationStore: ConversationStore
  private toolHandlers: Map<string, ToolReference['handler']>
  private toolDefinitions: ToolDefinition[]
  private modelConfig: ModelConfiguration

  constructor(agent: AgentConfig, options: AgentExecutorOptions = {}) {
    this.agent = agent
    this.modelConfig = {
      ...DEFAULT_MODEL,
      ...(agent.model || {})
    }

    this.stateBackend = options.stateBackend || new MemoryStateBackend({
      prefix: agent.state?.prefix,
      ttl: agent.state?.ttl
    })
    this.conversationStore = new ConversationStore(this.stateBackend)

    this.provider = createProvider({
      provider: this.modelConfig.provider as 'anthropic' | 'openai' | 'google',
      apiKey: this.modelConfig.apiKey
    })

    this.toolHandlers = new Map()
    this.toolDefinitions = []

    if (agent.tools) {
      for (const tool of agent.tools) {
        this.toolHandlers.set(tool.name, tool.handler)
        this.toolDefinitions.push(convertToolReferenceToDefinition(tool))
      }
    }
  }

  private createToolContext(conversationId: string, userId?: string): ToolContext {
    return {
      conversationId,
      userId,
      state: {
        get: async <T>(key: string) => this.stateBackend.get<T>(`${conversationId}:${key}`),
        set: async <T>(key: string, value: T) => this.stateBackend.set(`${conversationId}:${key}`, value),
        delete: async (key: string) => this.stateBackend.delete(`${conversationId}:${key}`)
      }
    }
  }

  private async getSystemPrompt(): Promise<string> {
    if (typeof this.agent.systemPrompt === 'function') {
      return this.agent.systemPrompt()
    }
    return this.agent.systemPrompt
  }

  private async executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<unknown> {
    const handler = this.toolHandlers.get(toolName)
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`)
    }
    return handler(args, context)
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const systemPrompt = await this.getSystemPrompt()
    const toolContext = this.createToolContext(request.conversationId, request.userId)

    let messages = request.history ? [...request.history] : await this.conversationStore.getMessages(request.conversationId)
    messages.push({ role: 'user', content: request.message })

    const allToolCalls: ToolCallResult[] = []
    let iterations = 0

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++

      const result = await this.provider.generateText({
        model: this.modelConfig.name,
        systemPrompt,
        messages,
        tools: this.toolDefinitions.length > 0 ? this.toolDefinitions : undefined,
        temperature: this.modelConfig.temperature,
        maxTokens: this.modelConfig.maxTokens
      })

      if (!result.toolCalls || result.toolCalls.length === 0) {
        await this.conversationStore.addMessages(request.conversationId, [
          { role: 'user', content: request.message },
          { role: 'assistant', content: result.text }
        ])

        return {
          conversationId: request.conversationId,
          message: result.text,
          toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
          usage: result.usage,
          finishReason: result.finishReason as ExecutionResponse['finishReason']
        }
      }

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: result.text || '',
        toolCalls: result.toolCalls
      }
      messages.push(assistantMessage)

      for (const toolCall of result.toolCalls) {
        const toolResult = await this.executeToolCall(toolCall.name, toolCall.arguments, toolContext)

        allToolCalls.push({
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments,
          result: toolResult
        })

        messages.push({
          role: 'tool',
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
          toolCallId: toolCall.id,
          toolName: toolCall.name
        })
      }
    }

    const lastAssistantMsg = messages.filter(m => m.role === 'assistant').pop()
    return {
      conversationId: request.conversationId,
      message: lastAssistantMsg?.content || 'Max tool iterations reached',
      toolCalls: allToolCalls,
      finishReason: 'stop'
    }
  }

  async *stream(request: ExecutionRequest): AsyncGenerator<StreamChunk> {
    const systemPrompt = await this.getSystemPrompt()
    const toolContext = this.createToolContext(request.conversationId, request.userId)

    let messages = request.history ? [...request.history] : await this.conversationStore.getMessages(request.conversationId)
    messages.push({ role: 'user', content: request.message })

    let iterations = 0
    let fullText = ''
    let pendingToolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = []

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++
      fullText = ''
      pendingToolCalls = []

      const stream = this.provider.streamText({
        model: this.modelConfig.name,
        systemPrompt,
        messages,
        tools: this.toolDefinitions.length > 0 ? this.toolDefinitions : undefined,
        temperature: this.modelConfig.temperature,
        maxTokens: this.modelConfig.maxTokens
      })

      for await (const chunk of stream) {
        if (chunk.type === 'text-delta') {
          fullText += chunk.textDelta
          yield chunk
        } else if (chunk.type === 'tool-call-start') {
          pendingToolCalls.push({
            id: chunk.toolCallId!,
            name: chunk.toolName!,
            arguments: chunk.toolArgs!
          })
          yield chunk
        } else if (chunk.type === 'finish' || chunk.type === 'error') {
          if (pendingToolCalls.length === 0) {
            await this.conversationStore.addMessages(request.conversationId, [
              { role: 'user', content: request.message },
              { role: 'assistant', content: fullText }
            ])
            yield chunk
            return
          }
        }
      }

      if (pendingToolCalls.length === 0) {
        yield { type: 'finish', finishReason: 'stop' }
        return
      }

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: fullText,
        toolCalls: pendingToolCalls
      }
      messages.push(assistantMessage)

      for (const toolCall of pendingToolCalls) {
        const toolResult = await this.executeToolCall(toolCall.name, toolCall.arguments, toolContext)

        yield {
          type: 'tool-result',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          toolResult
        }

        messages.push({
          role: 'tool',
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
          toolCallId: toolCall.id,
          toolName: toolCall.name
        })
      }
    }

    yield { type: 'finish', finishReason: 'stop' }
  }

  getConversationStore(): ConversationStore {
    return this.conversationStore
  }

  getStateBackend(): StateBackend {
    return this.stateBackend
  }
}
