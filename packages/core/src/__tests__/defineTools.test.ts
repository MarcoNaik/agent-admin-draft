import { describe, test, expect, mock } from 'bun:test'
import { defineTools } from '../defineTools'
import type { ToolContext } from '../types'

const mockContext: ToolContext = {
  conversationId: 'test-conv-123',
  userId: 'user-456',
  state: {
    get: async () => undefined,
    set: async () => {},
    delete: async () => {},
  },
}

describe('defineTools', () => {
  test('throws error when tool name is missing', () => {
    expect(() =>
      defineTools([
        {
          name: '',
          description: 'A tool',
          parameters: { type: 'object', properties: {} },
          handler: async () => 'result',
        },
      ])
    ).toThrow('Tool name is required')
  })

  test('throws error when tool description is missing', () => {
    expect(() =>
      defineTools([
        {
          name: 'my_tool',
          description: '',
          parameters: { type: 'object', properties: {} },
          handler: async () => 'result',
        },
      ])
    ).toThrow('Tool "my_tool" requires a description')
  })

  test('throws error when parameters are missing', () => {
    expect(() =>
      defineTools([
        {
          name: 'my_tool',
          description: 'A tool',
          parameters: undefined as any,
          handler: async () => 'result',
        },
      ])
    ).toThrow('Tool "my_tool" requires parameters definition')
  })

  test('throws error when handler is not a function', () => {
    expect(() =>
      defineTools([
        {
          name: 'my_tool',
          description: 'A tool',
          parameters: { type: 'object', properties: {} },
          handler: 'not a function' as any,
        },
      ])
    ).toThrow('Tool "my_tool" requires a handler function')
  })

  test('returns validated tool references', () => {
    const tools = defineTools([
      {
        name: 'get_weather',
        description: 'Get weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name' },
          },
          required: ['location'],
        },
        handler: async ({ location }) => `Weather in ${location}: sunny`,
      },
    ])

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('get_weather')
    expect(tools[0].description).toBe('Get weather for a location')
    expect(tools[0].parameters.type).toBe('object')
    expect(tools[0].parameters.required).toEqual(['location'])
  })

  test('validates multiple tools', () => {
    const tools = defineTools([
      {
        name: 'tool_one',
        description: 'First tool',
        parameters: { type: 'object', properties: {} },
        handler: async () => 'one',
      },
      {
        name: 'tool_two',
        description: 'Second tool',
        parameters: { type: 'object', properties: {} },
        handler: async () => 'two',
      },
    ])

    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe('tool_one')
    expect(tools[1].name).toBe('tool_two')
  })

  test('wrapped handler executes correctly', async () => {
    const tools = defineTools([
      {
        name: 'add_numbers',
        description: 'Add two numbers',
        parameters: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['a', 'b'],
        },
        handler: async ({ a, b }) => (a as number) + (b as number),
      },
    ])

    const result = await tools[0].handler({ a: 5, b: 3 }, mockContext)
    expect(result).toBe(8)
  })

  test('wrapped handler receives context', async () => {
    let receivedContext: ToolContext | null = null

    const tools = defineTools([
      {
        name: 'check_context',
        description: 'Check context',
        parameters: { type: 'object', properties: {} },
        handler: async (_params, context) => {
          receivedContext = context
          return 'done'
        },
      },
    ])

    await tools[0].handler({}, mockContext)

    expect(receivedContext).toBe(mockContext)
    expect(receivedContext!.conversationId).toBe('test-conv-123')
    expect(receivedContext!.userId).toBe('user-456')
  })

  test('wrapped handler propagates errors', async () => {
    const tools = defineTools([
      {
        name: 'failing_tool',
        description: 'A tool that fails',
        parameters: { type: 'object', properties: {} },
        handler: async () => {
          throw new Error('Tool execution failed')
        },
      },
    ])

    await expect(tools[0].handler({}, mockContext)).rejects.toThrow('Tool execution failed')
  })

  test('empty tools array returns empty array', () => {
    const tools = defineTools([])
    expect(tools).toEqual([])
  })
})
