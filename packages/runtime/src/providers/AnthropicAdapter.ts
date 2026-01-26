import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, streamText, type CoreMessage } from 'ai'
import type {
  ProviderAdapter,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  ToolCall
} from '../types.js'
import { convertToAISDKTools, convertToAISDKMessages } from '../tools/ToolConverter.js'

export class AnthropicAdapter implements ProviderAdapter {
  private client: ReturnType<typeof createAnthropic>

  constructor(apiKey?: string) {
    this.client = createAnthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY
    })
  }

  async generateText(options: GenerateOptions): Promise<GenerateResult> {
    const model = this.client(options.model)
    const tools = options.tools ? convertToAISDKTools(options.tools) : undefined
    const messages = convertToAISDKMessages(options.messages) as CoreMessage[]

    const result = await generateText({
      model,
      system: options.systemPrompt,
      messages,
      tools,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    })

    const toolCalls: ToolCall[] = result.toolCalls?.map((tc) => ({
      id: tc.toolCallId,
      name: tc.toolName,
      arguments: tc.args as Record<string, unknown>
    })) || []

    return {
      text: result.text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: result.usage?.promptTokens || 0,
        completionTokens: result.usage?.completionTokens || 0,
        totalTokens: (result.usage?.promptTokens || 0) + (result.usage?.completionTokens || 0)
      },
      finishReason: result.finishReason || 'stop'
    }
  }

  async *streamText(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const model = this.client(options.model)
    const tools = options.tools ? convertToAISDKTools(options.tools) : undefined
    const messages = convertToAISDKMessages(options.messages) as CoreMessage[]

    const result = streamText({
      model,
      system: options.systemPrompt,
      messages,
      tools,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    })

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        yield {
          type: 'text-delta',
          textDelta: part.textDelta
        }
      } else if (part.type === 'tool-call') {
        yield {
          type: 'tool-call-start',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          toolArgs: part.args as Record<string, unknown>
        }
      } else if (part.type === 'finish') {
        yield {
          type: 'finish',
          finishReason: part.finishReason,
          usage: {
            promptTokens: part.usage?.promptTokens || 0,
            completionTokens: part.usage?.completionTokens || 0,
            totalTokens: (part.usage?.promptTokens || 0) + (part.usage?.completionTokens || 0)
          }
        }
      } else if (part.type === 'error') {
        yield {
          type: 'error',
          error: String(part.error)
        }
      }
    }
  }
}
