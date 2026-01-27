import type { AgentConfig, ToolReference } from '@struere/core'

export function validateAgent(agent: AgentConfig): string[] {
  const errors: string[] = []

  if (!agent.name) {
    errors.push('Agent name is required')
  } else if (!/^[a-z0-9-]+$/.test(agent.name)) {
    errors.push('Agent name must be lowercase alphanumeric with hyphens only')
  }

  if (!agent.version) {
    errors.push('Agent version is required')
  } else if (!/^\d+\.\d+\.\d+/.test(agent.version)) {
    errors.push('Agent version must follow semver format (e.g., 1.0.0)')
  }

  if (!agent.systemPrompt) {
    errors.push('System prompt is required')
  } else if (typeof agent.systemPrompt === 'string' && agent.systemPrompt.trim().length === 0) {
    errors.push('System prompt cannot be empty')
  }

  if (agent.model) {
    const validProviders = ['anthropic', 'openai', 'google', 'custom']
    if (!validProviders.includes(agent.model.provider)) {
      errors.push(`Invalid model provider: ${agent.model.provider}`)
    }

    if (!agent.model.name) {
      errors.push('Model name is required when model is specified')
    }

    if (agent.model.temperature !== undefined) {
      if (agent.model.temperature < 0 || agent.model.temperature > 2) {
        errors.push('Model temperature must be between 0 and 2')
      }
    }

    if (agent.model.maxTokens !== undefined) {
      if (agent.model.maxTokens < 1) {
        errors.push('Model maxTokens must be at least 1')
      }
    }
  }

  if (agent.tools) {
    for (const tool of agent.tools) {
      const toolErrors = validateTool(tool)
      errors.push(...toolErrors)
    }
  }

  if (agent.state) {
    const validStorage = ['memory', 'redis', 'postgres', 'custom']
    if (!validStorage.includes(agent.state.storage)) {
      errors.push(`Invalid state storage: ${agent.state.storage}`)
    }

    if (agent.state.ttl !== undefined && agent.state.ttl < 0) {
      errors.push('State TTL must be non-negative')
    }
  }

  return errors
}

function validateTool(tool: ToolReference): string[] {
  const errors: string[] = []

  if (!tool.name) {
    errors.push('Tool name is required')
  } else if (!/^[a-z_][a-z0-9_]*$/.test(tool.name)) {
    errors.push(`Tool name "${tool.name}" must be snake_case`)
  }

  if (!tool.description) {
    errors.push(`Tool "${tool.name || 'unknown'}" requires a description`)
  }

  if (!tool.parameters) {
    errors.push(`Tool "${tool.name || 'unknown'}" requires parameters definition`)
  } else if (tool.parameters.type !== 'object') {
    errors.push(`Tool "${tool.name || 'unknown'}" parameters type must be "object"`)
  }

  if (typeof tool.handler !== 'function') {
    errors.push(`Tool "${tool.name || 'unknown'}" requires a handler function`)
  }

  return errors
}
