import { describe, test, expect } from 'bun:test'
import { validateAgent } from '../utils/validate'
import type { AgentConfig, ToolReference } from '@struere/core'

describe('validateAgent', () => {
  const validAgent: AgentConfig = {
    name: 'test-agent',
    version: '1.0.0',
    systemPrompt: 'You are a helpful assistant',
  }

  describe('name validation', () => {
    test('returns error when name is missing', () => {
      const errors = validateAgent({ ...validAgent, name: '' })
      expect(errors).toContain('Agent name is required')
    })

    test('returns error when name contains uppercase', () => {
      const errors = validateAgent({ ...validAgent, name: 'TestAgent' })
      expect(errors).toContain('Agent name must be lowercase alphanumeric with hyphens only')
    })

    test('returns error when name contains spaces', () => {
      const errors = validateAgent({ ...validAgent, name: 'test agent' })
      expect(errors).toContain('Agent name must be lowercase alphanumeric with hyphens only')
    })

    test('returns error when name contains underscores', () => {
      const errors = validateAgent({ ...validAgent, name: 'test_agent' })
      expect(errors).toContain('Agent name must be lowercase alphanumeric with hyphens only')
    })

    test('accepts valid hyphenated name', () => {
      const errors = validateAgent({ ...validAgent, name: 'my-test-agent-123' })
      expect(errors).not.toContain('Agent name must be lowercase alphanumeric with hyphens only')
    })
  })

  describe('version validation', () => {
    test('returns error when version is missing', () => {
      const errors = validateAgent({ ...validAgent, version: '' })
      expect(errors).toContain('Agent version is required')
    })

    test('returns error for invalid version format', () => {
      const errors = validateAgent({ ...validAgent, version: 'v1' })
      expect(errors).toContain('Agent version must follow semver format (e.g., 1.0.0)')
    })

    test('returns error for invalid version format without dots', () => {
      const errors = validateAgent({ ...validAgent, version: '100' })
      expect(errors).toContain('Agent version must follow semver format (e.g., 1.0.0)')
    })

    test('accepts valid semver version', () => {
      const errors = validateAgent({ ...validAgent, version: '1.2.3' })
      expect(errors).not.toContain('Agent version must follow semver format (e.g., 1.0.0)')
    })

    test('accepts semver with prerelease', () => {
      const errors = validateAgent({ ...validAgent, version: '1.0.0-beta.1' })
      expect(errors).not.toContain('Agent version must follow semver format (e.g., 1.0.0)')
    })
  })

  describe('systemPrompt validation', () => {
    test('returns error when systemPrompt is missing', () => {
      const errors = validateAgent({ ...validAgent, systemPrompt: '' })
      expect(errors).toContain('System prompt is required')
    })

    test('returns error when systemPrompt is whitespace only', () => {
      const errors = validateAgent({ ...validAgent, systemPrompt: '   ' })
      expect(errors).toContain('System prompt cannot be empty')
    })

    test('accepts function systemPrompt', () => {
      const errors = validateAgent({ ...validAgent, systemPrompt: () => 'dynamic' })
      expect(errors).toHaveLength(0)
    })
  })

  describe('model validation', () => {
    test('returns error for invalid provider', () => {
      const errors = validateAgent({
        ...validAgent,
        model: { provider: 'invalid' as any, name: 'model-1' },
      })
      expect(errors).toContain('Invalid model provider: invalid')
    })

    test('returns error when model name is missing', () => {
      const errors = validateAgent({
        ...validAgent,
        model: { provider: 'anthropic', name: '' },
      })
      expect(errors).toContain('Model name is required when model is specified')
    })

    test('returns error when temperature is below 0', () => {
      const errors = validateAgent({
        ...validAgent,
        model: { provider: 'openai', name: 'gpt-4', temperature: -0.5 },
      })
      expect(errors).toContain('Model temperature must be between 0 and 2')
    })

    test('returns error when temperature is above 2', () => {
      const errors = validateAgent({
        ...validAgent,
        model: { provider: 'openai', name: 'gpt-4', temperature: 2.5 },
      })
      expect(errors).toContain('Model temperature must be between 0 and 2')
    })

    test('returns error when maxTokens is less than 1', () => {
      const errors = validateAgent({
        ...validAgent,
        model: { provider: 'anthropic', name: 'claude-3', maxTokens: 0 },
      })
      expect(errors).toContain('Model maxTokens must be at least 1')
    })

    test('accepts valid model configuration', () => {
      const errors = validateAgent({
        ...validAgent,
        model: {
          provider: 'anthropic',
          name: 'claude-sonnet-4-20250514',
          temperature: 0.7,
          maxTokens: 4096,
        },
      })
      expect(errors).toHaveLength(0)
    })

    test('accepts all valid providers', () => {
      const providers = ['anthropic', 'openai', 'google', 'custom'] as const
      for (const provider of providers) {
        const errors = validateAgent({
          ...validAgent,
          model: { provider, name: 'model-name' },
        })
        expect(errors).not.toContain(`Invalid model provider: ${provider}`)
      }
    })
  })

  describe('tools validation', () => {
    const validTool: ToolReference = {
      name: 'get_weather',
      description: 'Get weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
        },
      },
      handler: async () => 'sunny',
    }

    test('returns error when tool name is missing', () => {
      const errors = validateAgent({
        ...validAgent,
        tools: [{ ...validTool, name: '' }],
      })
      expect(errors).toContain('Tool name is required')
    })

    test('returns error when tool name is not snake_case', () => {
      const errors = validateAgent({
        ...validAgent,
        tools: [{ ...validTool, name: 'getWeather' }],
      })
      expect(errors).toContain('Tool name "getWeather" must be snake_case')
    })

    test('returns error when tool name starts with number', () => {
      const errors = validateAgent({
        ...validAgent,
        tools: [{ ...validTool, name: '123_tool' }],
      })
      expect(errors).toContain('Tool name "123_tool" must be snake_case')
    })

    test('returns error when tool description is missing', () => {
      const errors = validateAgent({
        ...validAgent,
        tools: [{ ...validTool, description: '' }],
      })
      expect(errors).toContain('Tool "get_weather" requires a description')
    })

    test('returns error when tool parameters are missing', () => {
      const errors = validateAgent({
        ...validAgent,
        tools: [{ ...validTool, parameters: undefined as any }],
      })
      expect(errors).toContain('Tool "get_weather" requires parameters definition')
    })

    test('returns error when tool parameters type is not object', () => {
      const errors = validateAgent({
        ...validAgent,
        tools: [{ ...validTool, parameters: { type: 'array' } as any }],
      })
      expect(errors).toContain('Tool "get_weather" parameters type must be "object"')
    })

    test('returns error when tool handler is not a function', () => {
      const errors = validateAgent({
        ...validAgent,
        tools: [{ ...validTool, handler: 'not a function' as any }],
      })
      expect(errors).toContain('Tool "get_weather" requires a handler function')
    })

    test('accepts valid tool', () => {
      const errors = validateAgent({
        ...validAgent,
        tools: [validTool],
      })
      expect(errors).toHaveLength(0)
    })

    test('validates multiple tools', () => {
      const errors = validateAgent({
        ...validAgent,
        tools: [
          { ...validTool, name: 'InvalidName' },
          { ...validTool, name: 'also_invalid!' },
        ],
      })
      expect(errors).toContain('Tool name "InvalidName" must be snake_case')
      expect(errors).toContain('Tool name "also_invalid!" must be snake_case')
    })
  })

  describe('state validation', () => {
    test('returns error for invalid storage type', () => {
      const errors = validateAgent({
        ...validAgent,
        state: { storage: 'invalid' as any },
      })
      expect(errors).toContain('Invalid state storage: invalid')
    })

    test('returns error when TTL is negative', () => {
      const errors = validateAgent({
        ...validAgent,
        state: { storage: 'memory', ttl: -100 },
      })
      expect(errors).toContain('State TTL must be non-negative')
    })

    test('accepts valid state configuration', () => {
      const errors = validateAgent({
        ...validAgent,
        state: { storage: 'redis', ttl: 3600, prefix: 'myapp' },
      })
      expect(errors).toHaveLength(0)
    })

    test('accepts all valid storage types', () => {
      const storageTypes = ['memory', 'redis', 'postgres', 'custom'] as const
      for (const storage of storageTypes) {
        const errors = validateAgent({
          ...validAgent,
          state: { storage },
        })
        expect(errors).not.toContain(`Invalid state storage: ${storage}`)
      }
    })

    test('accepts zero TTL', () => {
      const errors = validateAgent({
        ...validAgent,
        state: { storage: 'memory', ttl: 0 },
      })
      expect(errors).not.toContain('State TTL must be non-negative')
    })
  })

  describe('complete validation', () => {
    test('returns empty array for valid agent', () => {
      const errors = validateAgent(validAgent)
      expect(errors).toHaveLength(0)
    })

    test('collects multiple errors', () => {
      const errors = validateAgent({
        name: '',
        version: 'invalid',
        systemPrompt: '',
        model: { provider: 'unknown' as any, name: '' },
      })
      expect(errors.length).toBeGreaterThan(3)
    })
  })
})
