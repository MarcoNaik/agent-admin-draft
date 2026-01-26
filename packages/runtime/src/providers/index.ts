import type { ProviderAdapter } from '../types.js'
import { AnthropicAdapter } from './AnthropicAdapter.js'
import { OpenAIAdapter } from './OpenAIAdapter.js'
import { GoogleAdapter } from './GoogleAdapter.js'

export type ProviderType = 'anthropic' | 'openai' | 'google'

export interface ProviderConfig {
  provider: ProviderType
  apiKey?: string
}

export function createProvider(config: ProviderConfig): ProviderAdapter {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicAdapter(config.apiKey)
    case 'openai':
      return new OpenAIAdapter(config.apiKey)
    case 'google':
      return new GoogleAdapter(config.apiKey)
    default:
      throw new Error(`Unsupported provider: ${config.provider}`)
  }
}

export { AnthropicAdapter } from './AnthropicAdapter.js'
export { OpenAIAdapter } from './OpenAIAdapter.js'
export { GoogleAdapter } from './GoogleAdapter.js'
