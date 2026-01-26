import type { StateBackend } from '../types.js'

interface CacheEntry<T> {
  value: T
  expiresAt?: number
}

export class MemoryStateBackend implements StateBackend {
  private store = new Map<string, CacheEntry<unknown>>()
  private prefix: string
  private defaultTtl?: number

  constructor(options: { prefix?: string; ttl?: number } = {}) {
    this.prefix = options.prefix || ''
    this.defaultTtl = options.ttl
  }

  private getKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    if (!entry.expiresAt) return false
    return Date.now() > entry.expiresAt
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const fullKey = this.getKey(key)
    const entry = this.store.get(fullKey)

    if (!entry) return undefined

    if (this.isExpired(entry)) {
      this.store.delete(fullKey)
      return undefined
    }

    return entry.value as T
  }

  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.getKey(key)
    const effectiveTtl = ttl ?? this.defaultTtl

    const entry: CacheEntry<T> = {
      value,
      expiresAt: effectiveTtl ? Date.now() + effectiveTtl * 1000 : undefined
    }

    this.store.set(fullKey, entry)
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key)
    this.store.delete(fullKey)
  }

  async clear(): Promise<void> {
    if (this.prefix) {
      const keysToDelete: string[] = []
      for (const key of this.store.keys()) {
        if (key.startsWith(`${this.prefix}:`)) {
          keysToDelete.push(key)
        }
      }
      for (const key of keysToDelete) {
        this.store.delete(key)
      }
    } else {
      this.store.clear()
    }
  }

  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.store.delete(key)
    }
  }
}
