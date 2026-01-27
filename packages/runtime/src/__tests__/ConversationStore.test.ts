import { describe, test, expect, beforeEach } from 'bun:test'
import { ConversationStore } from '../state/ConversationStore.js'
import { MemoryStateBackend } from '../state/MemoryStateBackend.js'
import type { ConversationMessage } from '../types.js'

describe('ConversationStore', () => {
  let store: ConversationStore
  let backend: MemoryStateBackend

  beforeEach(() => {
    backend = new MemoryStateBackend()
    store = new ConversationStore(backend)
  })

  describe('createConversation', () => {
    test('creates conversation with id and empty messages', async () => {
      const conv = await store.createConversation('conv-123')

      expect(conv.id).toBe('conv-123')
      expect(conv.messages).toEqual([])
      expect(conv.metadata).toEqual({})
      expect(conv.createdAt).toBeGreaterThan(0)
      expect(conv.updatedAt).toBeGreaterThan(0)
    })

    test('creates conversation with metadata', async () => {
      const metadata = { userId: 'user-456', channel: 'web' }
      const conv = await store.createConversation('conv-123', metadata)

      expect(conv.metadata).toEqual(metadata)
    })
  })

  describe('getConversation', () => {
    test('returns undefined for non-existent conversation', async () => {
      const result = await store.getConversation('non-existent')
      expect(result).toBeUndefined()
    })

    test('retrieves existing conversation', async () => {
      await store.createConversation('conv-123')
      const conv = await store.getConversation('conv-123')

      expect(conv).toBeDefined()
      expect(conv!.id).toBe('conv-123')
    })
  })

  describe('getOrCreateConversation', () => {
    test('creates conversation if not exists', async () => {
      const conv = await store.getOrCreateConversation('new-conv')

      expect(conv.id).toBe('new-conv')
      expect(conv.messages).toEqual([])
    })

    test('returns existing conversation', async () => {
      const created = await store.createConversation('existing', { initial: true })
      const retrieved = await store.getOrCreateConversation('existing', { initial: false })

      expect(retrieved.id).toBe(created.id)
      expect(retrieved.metadata).toEqual({ initial: true })
    })
  })

  describe('addMessage', () => {
    test('adds single message to new conversation', async () => {
      const message: ConversationMessage = {
        role: 'user',
        content: 'Hello',
      }

      const conv = await store.addMessage('conv-123', message)

      expect(conv.messages).toHaveLength(1)
      expect(conv.messages[0]).toEqual(message)
    })

    test('adds message to existing conversation', async () => {
      await store.createConversation('conv-123')
      await store.addMessage('conv-123', { role: 'user', content: 'First' })
      const conv = await store.addMessage('conv-123', { role: 'assistant', content: 'Second' })

      expect(conv.messages).toHaveLength(2)
      expect(conv.messages[0].content).toBe('First')
      expect(conv.messages[1].content).toBe('Second')
    })

    test('updates updatedAt timestamp', async () => {
      const initial = await store.createConversation('conv-123')
      await new Promise((r) => setTimeout(r, 50))
      const updated = await store.addMessage('conv-123', { role: 'user', content: 'msg' })

      expect(updated.updatedAt).toBeGreaterThanOrEqual(initial.updatedAt)
    })
  })

  describe('addMessages', () => {
    test('adds multiple messages at once', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ]

      const conv = await store.addMessages('conv-123', messages)

      expect(conv.messages).toHaveLength(3)
      expect(conv.messages[0].role).toBe('user')
      expect(conv.messages[1].role).toBe('assistant')
      expect(conv.messages[2].content).toBe('How are you?')
    })

    test('appends to existing messages', async () => {
      await store.addMessage('conv-123', { role: 'user', content: 'Initial' })
      await store.addMessages('conv-123', [
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Follow up' },
      ])

      const conv = await store.getConversation('conv-123')
      expect(conv!.messages).toHaveLength(3)
    })
  })

  describe('getMessages', () => {
    test('returns empty array for non-existent conversation', async () => {
      const messages = await store.getMessages('non-existent')
      expect(messages).toEqual([])
    })

    test('returns messages from conversation', async () => {
      await store.addMessages('conv-123', [
        { role: 'user', content: 'A' },
        { role: 'assistant', content: 'B' },
      ])

      const messages = await store.getMessages('conv-123')

      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe('A')
      expect(messages[1].content).toBe('B')
    })
  })

  describe('updateMetadata', () => {
    test('returns undefined for non-existent conversation', async () => {
      const result = await store.updateMetadata('non-existent', { key: 'value' })
      expect(result).toBeUndefined()
    })

    test('merges metadata', async () => {
      await store.createConversation('conv-123', { initial: true, count: 0 })
      const updated = await store.updateMetadata('conv-123', { count: 1, extra: 'data' })

      expect(updated!.metadata).toEqual({
        initial: true,
        count: 1,
        extra: 'data',
      })
    })

    test('updates updatedAt timestamp', async () => {
      const initial = await store.createConversation('conv-123')
      await new Promise((r) => setTimeout(r, 50))
      const updated = await store.updateMetadata('conv-123', { key: 'value' })

      expect(updated!.updatedAt).toBeGreaterThanOrEqual(initial.updatedAt)
    })
  })

  describe('deleteConversation', () => {
    test('removes conversation', async () => {
      await store.createConversation('conv-123')
      await store.deleteConversation('conv-123')

      const result = await store.getConversation('conv-123')
      expect(result).toBeUndefined()
    })

    test('deleting non-existent conversation does not throw', async () => {
      await expect(store.deleteConversation('non-existent')).resolves.toBeUndefined()
    })
  })

  describe('clearAllConversations', () => {
    test('removes all conversations', async () => {
      await store.createConversation('conv-1')
      await store.createConversation('conv-2')
      await store.createConversation('conv-3')

      await store.clearAllConversations()

      expect(await store.getConversation('conv-1')).toBeUndefined()
      expect(await store.getConversation('conv-2')).toBeUndefined()
      expect(await store.getConversation('conv-3')).toBeUndefined()
    })
  })

  describe('tool messages', () => {
    test('stores messages with tool calls', async () => {
      const assistantMsg: ConversationMessage = {
        role: 'assistant',
        content: 'Let me check that',
        toolCalls: [
          { id: 'tc-1', name: 'get_weather', arguments: { location: 'NYC' } },
        ],
      }

      const toolMsg: ConversationMessage = {
        role: 'tool',
        content: 'Sunny, 72°F',
        toolCallId: 'tc-1',
        toolName: 'get_weather',
      }

      await store.addMessages('conv-123', [assistantMsg, toolMsg])

      const messages = await store.getMessages('conv-123')
      expect(messages[0].toolCalls).toHaveLength(1)
      expect(messages[1].toolCallId).toBe('tc-1')
    })
  })

  describe('default backend', () => {
    test('uses MemoryStateBackend when none provided', async () => {
      const defaultStore = new ConversationStore()
      await defaultStore.createConversation('test-conv')
      const conv = await defaultStore.getConversation('test-conv')

      expect(conv).toBeDefined()
      expect(conv!.id).toBe('test-conv')
    })
  })
})
