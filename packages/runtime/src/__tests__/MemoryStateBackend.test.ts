import { describe, test, expect, beforeEach } from 'bun:test'
import { MemoryStateBackend } from '../state/MemoryStateBackend.js'

describe('MemoryStateBackend', () => {
  let backend: MemoryStateBackend

  beforeEach(() => {
    backend = new MemoryStateBackend()
  })

  describe('basic operations', () => {
    test('get returns undefined for non-existent key', async () => {
      const result = await backend.get('non-existent')
      expect(result).toBeUndefined()
    })

    test('set and get stores and retrieves value', async () => {
      await backend.set('key1', 'value1')
      const result = await backend.get('key1')
      expect(result).toBe('value1')
    })

    test('stores complex objects', async () => {
      const obj = { name: 'test', count: 42, nested: { value: true } }
      await backend.set('complex', obj)
      const result = await backend.get('complex')
      expect(result).toEqual(obj)
    })

    test('stores arrays', async () => {
      const arr = [1, 2, 3, 'four', { five: 5 }]
      await backend.set('array', arr)
      const result = await backend.get('array')
      expect(result).toEqual(arr)
    })

    test('delete removes value', async () => {
      await backend.set('to-delete', 'value')
      await backend.delete('to-delete')
      const result = await backend.get('to-delete')
      expect(result).toBeUndefined()
    })

    test('delete non-existent key does not throw', async () => {
      await expect(backend.delete('non-existent')).resolves.toBeUndefined()
    })

    test('overwrites existing value', async () => {
      await backend.set('key', 'first')
      await backend.set('key', 'second')
      const result = await backend.get('key')
      expect(result).toBe('second')
    })
  })

  describe('prefix', () => {
    test('applies prefix to keys', async () => {
      const prefixedBackend = new MemoryStateBackend({ prefix: 'myapp' })
      await prefixedBackend.set('key1', 'value1')
      const result = await prefixedBackend.get('key1')
      expect(result).toBe('value1')
    })

    test('different prefixes isolate data', async () => {
      const backend1 = new MemoryStateBackend({ prefix: 'app1' })
      const backend2 = new MemoryStateBackend({ prefix: 'app2' })

      await backend1.set('shared-key', 'value1')
      await backend2.set('shared-key', 'value2')

      expect(await backend1.get('shared-key')).toBe('value1')
      expect(await backend2.get('shared-key')).toBe('value2')
    })

    test('clear only removes prefixed keys', async () => {
      const prefixedBackend = new MemoryStateBackend({ prefix: 'prefix1' })
      const unprefixedBackend = new MemoryStateBackend()

      await prefixedBackend.set('key1', 'prefixed-value')
      await unprefixedBackend.set('key2', 'unprefixed-value')

      await prefixedBackend.clear()

      expect(await prefixedBackend.get('key1')).toBeUndefined()
      expect(await unprefixedBackend.get('key2')).toBe('unprefixed-value')
    })
  })

  describe('TTL', () => {
    test('value expires after TTL', async () => {
      const ttlBackend = new MemoryStateBackend({ ttl: 0.1 })
      await ttlBackend.set('expires', 'value')

      expect(await ttlBackend.get('expires')).toBe('value')

      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(await ttlBackend.get('expires')).toBeUndefined()
    })

    test('per-key TTL overrides default', async () => {
      const ttlBackend = new MemoryStateBackend({ ttl: 10 })
      await ttlBackend.set('short-lived', 'value', 0.1)

      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(await ttlBackend.get('short-lived')).toBeUndefined()
    })

    test('value without TTL does not expire', async () => {
      await backend.set('permanent', 'value')

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(await backend.get('permanent')).toBe('value')
    })

    test('cleanup removes expired entries', async () => {
      const ttlBackend = new MemoryStateBackend({ ttl: 0.05 })
      await ttlBackend.set('key1', 'value1')
      await ttlBackend.set('key2', 'value2')

      await new Promise((resolve) => setTimeout(resolve, 100))

      ttlBackend.cleanup()

      expect(await ttlBackend.get('key1')).toBeUndefined()
      expect(await ttlBackend.get('key2')).toBeUndefined()
    })
  })

  describe('clear', () => {
    test('removes all entries without prefix', async () => {
      await backend.set('key1', 'value1')
      await backend.set('key2', 'value2')
      await backend.set('key3', 'value3')

      await backend.clear()

      expect(await backend.get('key1')).toBeUndefined()
      expect(await backend.get('key2')).toBeUndefined()
      expect(await backend.get('key3')).toBeUndefined()
    })
  })

  describe('type safety', () => {
    test('generic type parameter works', async () => {
      interface User {
        id: number
        name: string
      }

      await backend.set<User>('user', { id: 1, name: 'Alice' })
      const user = await backend.get<User>('user')

      expect(user?.id).toBe(1)
      expect(user?.name).toBe('Alice')
    })
  })
})
