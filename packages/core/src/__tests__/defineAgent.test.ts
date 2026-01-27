import { describe, test, expect } from 'bun:test'
import { defineAgent } from '../defineAgent'

describe('defineAgent', () => {
  test('throws error when name is missing', () => {
    expect(() =>
      defineAgent({
        name: '',
        version: '1.0.0',
        systemPrompt: 'You are a helpful assistant',
      })
    ).toThrow('Agent name is required')
  })

  test('throws error when version is missing', () => {
    expect(() =>
      defineAgent({
        name: 'test-agent',
        version: '',
        systemPrompt: 'You are a helpful assistant',
      })
    ).toThrow('Agent version is required')
  })

  test('throws error when systemPrompt is missing', () => {
    expect(() =>
      defineAgent({
        name: 'test-agent',
        version: '1.0.0',
        systemPrompt: '',
      })
    ).toThrow('System prompt is required')
  })

  test('applies default model configuration', () => {
    const agent = defineAgent({
      name: 'test-agent',
      version: '1.0.0',
      systemPrompt: 'You are a helpful assistant',
    })

    expect(agent.model).toEqual({
      provider: 'anthropic',
      name: 'claude-sonnet-4-20250514',
      temperature: 0.7,
      maxTokens: 4096,
    })
  })

  test('preserves custom model configuration', () => {
    const customModel = {
      provider: 'openai' as const,
      name: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 2048,
    }

    const agent = defineAgent({
      name: 'test-agent',
      version: '1.0.0',
      systemPrompt: 'You are a helpful assistant',
      model: customModel,
    })

    expect(agent.model).toEqual(customModel)
  })

  test('preserves all provided configuration', () => {
    const tools = [
      {
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object' as const, properties: {} },
        handler: async () => 'result',
      },
    ]

    const agent = defineAgent({
      name: 'my-agent',
      version: '2.0.0',
      description: 'A test agent',
      systemPrompt: 'You are a test assistant',
      tools,
      state: {
        storage: 'memory',
        ttl: 3600,
      },
    })

    expect(agent.name).toBe('my-agent')
    expect(agent.version).toBe('2.0.0')
    expect(agent.description).toBe('A test agent')
    expect(agent.systemPrompt).toBe('You are a test assistant')
    expect(agent.tools).toBe(tools)
    expect(agent.state).toEqual({ storage: 'memory', ttl: 3600 })
  })

  test('supports function systemPrompt', () => {
    const agent = defineAgent({
      name: 'test-agent',
      version: '1.0.0',
      systemPrompt: () => 'Dynamic prompt',
    })

    expect(typeof agent.systemPrompt).toBe('function')
  })

  test('supports async function systemPrompt', async () => {
    const agent = defineAgent({
      name: 'test-agent',
      version: '1.0.0',
      systemPrompt: async () => 'Async prompt',
    })

    expect(typeof agent.systemPrompt).toBe('function')
    const result = await (agent.systemPrompt as () => Promise<string>)()
    expect(result).toBe('Async prompt')
  })
})
