import { describe, test, expect } from 'bun:test'
import {
  convertToAISDKTools,
  convertToolReferenceToDefinition,
  convertToAISDKMessages,
} from '../tools/ToolConverter.js'
import type { ToolDefinition, ConversationMessage } from '../types.js'

describe('ToolConverter', () => {
  describe('convertToolReferenceToDefinition', () => {
    test('converts tool reference to definition', () => {
      const toolRef = {
        name: 'get_weather',
        description: 'Get weather for a location',
        parameters: {
          type: 'object' as const,
          properties: {
            location: { type: 'string', description: 'City name' },
          },
          required: ['location'],
        },
        handler: async () => 'sunny',
      }

      const definition = convertToolReferenceToDefinition(toolRef)

      expect(definition.name).toBe('get_weather')
      expect(definition.description).toBe('Get weather for a location')
      expect(definition.parameters.type).toBe('object')
      expect(definition.parameters.properties.location.type).toBe('string')
      expect(definition.parameters.required).toEqual(['location'])
    })
  })

  describe('convertToAISDKTools', () => {
    test('converts tool definitions to AI SDK format with correct structure', () => {
      const toolDefs: ToolDefinition[] = [
        {
          name: 'calculate',
          description: 'Perform a calculation',
          parameters: {
            type: 'object',
            properties: {
              expression: { type: 'string', description: 'Math expression' },
            },
            required: ['expression'],
          },
        },
      ]

      const result = convertToAISDKTools(toolDefs)

      expect(result).toHaveProperty('calculate')
      expect(result.calculate.description).toBe('Perform a calculation')
      expect(result.calculate.parameters).toBeDefined()

      const parseResult = result.calculate.parameters.safeParse({ expression: '2+2' })
      expect(parseResult.success).toBe(true)
      if (parseResult.success) {
        expect(parseResult.data).toEqual({ expression: '2+2' })
      }
    })

    test('enforces required parameters', () => {
      const toolDefs: ToolDefinition[] = [
        {
          name: 'required_test',
          description: 'Test required params',
          parameters: {
            type: 'object',
            properties: {
              required_field: { type: 'string', description: 'Required' },
              optional_field: { type: 'string', description: 'Optional' },
            },
            required: ['required_field'],
          },
        },
      ]

      const result = convertToAISDKTools(toolDefs)

      const withRequired = result.required_test.parameters.safeParse({ required_field: 'value' })
      expect(withRequired.success).toBe(true)

      const withoutRequired = result.required_test.parameters.safeParse({ optional_field: 'value' })
      expect(withoutRequired.success).toBe(false)

      const withBoth = result.required_test.parameters.safeParse({
        required_field: 'req',
        optional_field: 'opt',
      })
      expect(withBoth.success).toBe(true)
    })

    test('handles multiple parameter types with validation', () => {
      const toolDefs: ToolDefinition[] = [
        {
          name: 'complex_tool',
          description: 'A tool with various parameter types',
          parameters: {
            type: 'object',
            properties: {
              stringParam: { type: 'string', description: 'A string' },
              numberParam: { type: 'number', description: 'A number' },
              boolParam: { type: 'boolean', description: 'A boolean' },
              enumParam: {
                type: 'string',
                description: 'An enum',
                enum: ['option1', 'option2', 'option3'],
              },
            },
            required: ['stringParam'],
          },
        },
      ]

      const result = convertToAISDKTools(toolDefs)

      expect(result.complex_tool.description).toBe('A tool with various parameter types')

      const validInput = result.complex_tool.parameters.safeParse({
        stringParam: 'test',
        numberParam: 42,
        boolParam: true,
        enumParam: 'option1',
      })
      expect(validInput.success).toBe(true)

      const invalidString = result.complex_tool.parameters.safeParse({
        stringParam: 123,
      })
      expect(invalidString.success).toBe(false)

      const invalidNumber = result.complex_tool.parameters.safeParse({
        stringParam: 'test',
        numberParam: 'not a number',
      })
      expect(invalidNumber.success).toBe(false)

      const invalidEnum = result.complex_tool.parameters.safeParse({
        stringParam: 'test',
        enumParam: 'invalid_option',
      })
      expect(invalidEnum.success).toBe(false)

      const validEnum = result.complex_tool.parameters.safeParse({
        stringParam: 'test',
        enumParam: 'option2',
      })
      expect(validEnum.success).toBe(true)
    })

    test('handles array parameters with validation', () => {
      const toolDefs: ToolDefinition[] = [
        {
          name: 'array_tool',
          description: 'A tool with array parameter',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                description: 'List of items',
                items: { type: 'string', description: 'Item' },
              },
            },
          },
        },
      ]

      const result = convertToAISDKTools(toolDefs)

      expect(result.array_tool.description).toBe('A tool with array parameter')

      const validArray = result.array_tool.parameters.safeParse({
        items: ['one', 'two', 'three'],
      })
      expect(validArray.success).toBe(true)

      const invalidArrayItems = result.array_tool.parameters.safeParse({
        items: [1, 2, 3],
      })
      expect(invalidArrayItems.success).toBe(false)

      const notAnArray = result.array_tool.parameters.safeParse({
        items: 'not an array',
      })
      expect(notAnArray.success).toBe(false)
    })

    test('handles nested object parameters with validation', () => {
      const toolDefs: ToolDefinition[] = [
        {
          name: 'nested_tool',
          description: 'A tool with nested object',
          parameters: {
            type: 'object',
            properties: {
              config: {
                type: 'object',
                description: 'Configuration',
                properties: {
                  enabled: { type: 'boolean', description: 'Is enabled' },
                  value: { type: 'number', description: 'Value' },
                },
              },
            },
          },
        },
      ]

      const result = convertToAISDKTools(toolDefs)

      expect(result.nested_tool.description).toBe('A tool with nested object')

      const validNested = result.nested_tool.parameters.safeParse({
        config: { enabled: true, value: 100 },
      })
      expect(validNested.success).toBe(true)

      const invalidNestedType = result.nested_tool.parameters.safeParse({
        config: { enabled: 'yes', value: 100 },
      })
      expect(invalidNestedType.success).toBe(false)

      const invalidNestedNumber = result.nested_tool.parameters.safeParse({
        config: { enabled: true, value: 'not a number' },
      })
      expect(invalidNestedNumber.success).toBe(false)
    })

    test('handles empty tool definitions', () => {
      const result = convertToAISDKTools([])
      expect(result).toEqual({})
    })

    test('converts multiple tools correctly', () => {
      const toolDefs: ToolDefinition[] = [
        {
          name: 'tool_a',
          description: 'First tool',
          parameters: {
            type: 'object',
            properties: { a: { type: 'string' } },
          },
        },
        {
          name: 'tool_b',
          description: 'Second tool',
          parameters: {
            type: 'object',
            properties: { b: { type: 'number' } },
          },
        },
      ]

      const result = convertToAISDKTools(toolDefs)

      expect(Object.keys(result)).toEqual(['tool_a', 'tool_b'])
      expect(result.tool_a.description).toBe('First tool')
      expect(result.tool_b.description).toBe('Second tool')

      expect(result.tool_a.parameters.safeParse({ a: 'test' }).success).toBe(true)
      expect(result.tool_b.parameters.safeParse({ b: 42 }).success).toBe(true)
      expect(result.tool_a.parameters.safeParse({ a: 123 }).success).toBe(false)
      expect(result.tool_b.parameters.safeParse({ b: 'text' }).success).toBe(false)
    })
  })

  describe('convertToAISDKMessages', () => {
    test('converts user messages', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'user', content: 'How are you?' },
      ]

      const result = convertToAISDKMessages(messages)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ role: 'user', content: 'Hello' })
      expect(result[1]).toEqual({ role: 'user', content: 'How are you?' })
    })

    test('converts assistant messages without tool calls', () => {
      const messages: ConversationMessage[] = [
        { role: 'assistant', content: 'Hi there!' },
      ]

      const result = convertToAISDKMessages(messages)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ role: 'assistant', content: 'Hi there!' })
    })

    test('converts assistant messages with tool calls', () => {
      const messages: ConversationMessage[] = [
        {
          role: 'assistant',
          content: 'Let me check',
          toolCalls: [
            {
              id: 'call-123',
              name: 'get_weather',
              arguments: { location: 'NYC' },
            },
          ],
        },
      ]

      const result = convertToAISDKMessages(messages)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe('assistant')
      expect(Array.isArray(result[0].content)).toBe(true)

      const content = result[0].content as Array<{ type: string; text?: string; toolCallId?: string }>
      expect(content).toHaveLength(2)
      expect(content[0]).toEqual({ type: 'text', text: 'Let me check' })
      expect(content[1].type).toBe('tool-call')
      expect(content[1].toolCallId).toBe('call-123')
    })

    test('converts tool result messages', () => {
      const messages: ConversationMessage[] = [
        {
          role: 'tool',
          content: 'Sunny, 72°F',
          toolCallId: 'call-123',
          toolName: 'get_weather',
        },
      ]

      const result = convertToAISDKMessages(messages)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe('user')
      expect(Array.isArray(result[0].content)).toBe(true)

      const content = result[0].content as Array<{ type: string; toolCallId: string; result: string }>
      expect(content[0].type).toBe('tool-result')
      expect(content[0].toolCallId).toBe('call-123')
      expect(content[0].result).toBe('Sunny, 72°F')
    })

    test('converts full conversation flow', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: "What's the weather in NYC?" },
        {
          role: 'assistant',
          content: 'Let me check',
          toolCalls: [{ id: 'tc-1', name: 'get_weather', arguments: { location: 'NYC' } }],
        },
        { role: 'tool', content: 'Sunny, 72°F', toolCallId: 'tc-1', toolName: 'get_weather' },
        { role: 'assistant', content: 'The weather in NYC is sunny with 72°F.' },
      ]

      const result = convertToAISDKMessages(messages)

      expect(result).toHaveLength(4)
      expect(result[0].role).toBe('user')
      expect(result[1].role).toBe('assistant')
      expect(result[2].role).toBe('user')
      expect(result[3].role).toBe('assistant')
    })

    test('handles assistant with tool calls but no text', () => {
      const messages: ConversationMessage[] = [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'silent_tool', arguments: {} }],
        },
      ]

      const result = convertToAISDKMessages(messages)
      const content = result[0].content as Array<{ type: string }>

      expect(content).toHaveLength(1)
      expect(content[0].type).toBe('tool-call')
    })

    test('handles empty messages array', () => {
      const result = convertToAISDKMessages([])
      expect(result).toEqual([])
    })
  })
})
