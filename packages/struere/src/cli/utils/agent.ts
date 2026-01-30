import { join } from 'path'
import type { AgentConfig } from '../../types'

export async function loadAgent(cwd: string): Promise<AgentConfig> {
  const agentPath = join(cwd, 'src/agent.ts')

  try {
    const module = await import(`${agentPath}?t=${Date.now()}`)
    const agent = module.default || module

    if (!agent.name) {
      throw new Error('Agent must have a name')
    }

    if (!agent.version) {
      throw new Error('Agent must have a version')
    }

    if (!agent.systemPrompt) {
      throw new Error('Agent must have a systemPrompt')
    }

    return agent as AgentConfig
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      throw new Error(`Agent not found at ${agentPath}`)
    }
    throw error
  }
}
