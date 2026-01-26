import type { ConversationMessage, StateBackend } from '../types.js'
import { MemoryStateBackend } from './MemoryStateBackend.js'

export interface Conversation {
  id: string
  messages: ConversationMessage[]
  metadata: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export class ConversationStore {
  private backend: StateBackend

  constructor(backend?: StateBackend) {
    this.backend = backend || new MemoryStateBackend({ prefix: 'conversation' })
  }

  private getConversationKey(conversationId: string): string {
    return `conv:${conversationId}`
  }

  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    return this.backend.get<Conversation>(this.getConversationKey(conversationId))
  }

  async createConversation(conversationId: string, metadata: Record<string, unknown> = {}): Promise<Conversation> {
    const conversation: Conversation = {
      id: conversationId,
      messages: [],
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    await this.backend.set(this.getConversationKey(conversationId), conversation)
    return conversation
  }

  async getOrCreateConversation(conversationId: string, metadata: Record<string, unknown> = {}): Promise<Conversation> {
    const existing = await this.getConversation(conversationId)
    if (existing) return existing
    return this.createConversation(conversationId, metadata)
  }

  async addMessage(conversationId: string, message: ConversationMessage): Promise<Conversation> {
    const conversation = await this.getOrCreateConversation(conversationId)
    conversation.messages.push(message)
    conversation.updatedAt = Date.now()
    await this.backend.set(this.getConversationKey(conversationId), conversation)
    return conversation
  }

  async addMessages(conversationId: string, messages: ConversationMessage[]): Promise<Conversation> {
    const conversation = await this.getOrCreateConversation(conversationId)
    conversation.messages.push(...messages)
    conversation.updatedAt = Date.now()
    await this.backend.set(this.getConversationKey(conversationId), conversation)
    return conversation
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const conversation = await this.getConversation(conversationId)
    return conversation?.messages || []
  }

  async updateMetadata(conversationId: string, metadata: Record<string, unknown>): Promise<Conversation | undefined> {
    const conversation = await this.getConversation(conversationId)
    if (!conversation) return undefined

    conversation.metadata = { ...conversation.metadata, ...metadata }
    conversation.updatedAt = Date.now()
    await this.backend.set(this.getConversationKey(conversationId), conversation)
    return conversation
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.backend.delete(this.getConversationKey(conversationId))
  }

  async clearAllConversations(): Promise<void> {
    await this.backend.clear()
  }
}
