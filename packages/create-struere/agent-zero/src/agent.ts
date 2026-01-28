import { defineAgent } from '@struere/core'
import { context } from './context'
import { tools } from './tools'

export default defineAgent({
  name: 'agent-zero',
  version: '0.1.0',
  description: 'Agent Zero Agent',
  model: {
    provider: 'anthropic',
    name: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 4096,
  },
  systemPrompt: `You are Agent Zero, a helpful AI assistant.

Your capabilities:
- Answer questions accurately and helpfully
- Use available tools when appropriate
- Maintain conversation context

Always be concise, accurate, and helpful.`,
  tools,
  context,
  state: {
    storage: 'memory',
    ttl: 3600,
  },
})
