import type { AgentConfig, ToolContext } from '@struere/core'

export interface ExecutionRequest {
  conversationId: string
  userId?: string
  message: string
  history?: ConversationMessage[]
  context?: Record<string, unknown>
}

export interface ExecutionResponse {
  conversationId: string
  message: string
  toolCalls?: ToolCallResult[]
  usage?: TokenUsage
  finishReason: 'stop' | 'tool-calls' | 'length' | 'content-filter' | 'error'
}

export interface StreamChunk {
  type: 'text-delta' | 'tool-call-start' | 'tool-call-delta' | 'tool-result' | 'finish' | 'error'
  textDelta?: string
  toolCallId?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  toolResult?: unknown
  finishReason?: string
  error?: string
  usage?: TokenUsage
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolCallResult {
  id: string
  name: string
  arguments: Record<string, unknown>
  result: unknown
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ProviderAdapter {
  generateText(options: GenerateOptions): Promise<GenerateResult>
  streamText(options: GenerateOptions): AsyncGenerator<StreamChunk>
}

export interface GenerateOptions {
  model: string
  systemPrompt: string
  messages: ConversationMessage[]
  tools?: ToolDefinition[]
  temperature?: number
  maxTokens?: number
}

export interface GenerateResult {
  text: string
  toolCalls?: ToolCall[]
  usage: TokenUsage
  finishReason: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface StateBackend {
  get<T = unknown>(key: string): Promise<T | undefined>
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

export interface ExecutorOptions {
  agent: AgentConfig
  stateBackend?: StateBackend
  onStream?: (chunk: StreamChunk) => void
}

export type ToolHandler = (
  params: Record<string, unknown>,
  context: ToolContext
) => Promise<unknown>
