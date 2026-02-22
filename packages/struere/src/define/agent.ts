import type { AgentConfig } from '../types'

export function defineAgent(config: AgentConfig): AgentConfig {
  if (!config.name) {
    throw new Error('Agent name is required')
  }
  if (!config.version) {
    throw new Error('Agent version is required')
  }
  if (!config.systemPrompt) {
    throw new Error('System prompt is required')
  }

  return {
    model: {
      provider: 'xai',
      name: 'grok-4-1-fast',
      temperature: 0.7,
      maxTokens: 4096,
    },
    ...config,
  }
}
