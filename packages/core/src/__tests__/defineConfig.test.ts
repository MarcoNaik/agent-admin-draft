import { describe, test, expect } from 'bun:test'
import { defineConfig } from '../defineConfig'

describe('defineConfig', () => {
  test('returns default configuration when no options provided', () => {
    const config = defineConfig()

    expect(config.port).toBe(3000)
    expect(config.host).toBe('localhost')
    expect(config.cors).toEqual({
      origins: ['http://localhost:3000'],
      credentials: true,
    })
    expect(config.logging).toEqual({
      level: 'info',
      format: 'pretty',
    })
    expect(config.auth).toEqual({
      type: 'none',
    })
  })

  test('overrides port and host', () => {
    const config = defineConfig({
      port: 8080,
      host: '0.0.0.0',
    })

    expect(config.port).toBe(8080)
    expect(config.host).toBe('0.0.0.0')
  })

  test('merges cors configuration', () => {
    const config = defineConfig({
      cors: {
        origins: ['https://example.com'],
        credentials: false,
      },
    })

    expect(config.cors).toEqual({
      origins: ['https://example.com'],
      credentials: false,
    })
  })

  test('partially merges cors configuration', () => {
    const config = defineConfig({
      cors: {
        origins: ['https://api.example.com'],
      },
    })

    expect(config.cors?.origins).toEqual(['https://api.example.com'])
    expect(config.cors?.credentials).toBe(true)
  })

  test('merges logging configuration', () => {
    const config = defineConfig({
      logging: {
        level: 'debug',
        format: 'json',
      },
    })

    expect(config.logging).toEqual({
      level: 'debug',
      format: 'json',
    })
  })

  test('partially merges logging configuration', () => {
    const config = defineConfig({
      logging: {
        level: 'error',
      },
    })

    expect(config.logging?.level).toBe('error')
    expect(config.logging?.format).toBe('pretty')
  })

  test('merges auth configuration', () => {
    const config = defineConfig({
      auth: {
        type: 'api-key',
      },
    })

    expect(config.auth?.type).toBe('api-key')
  })

  test('supports custom auth validator', () => {
    const validator = async (token: string) => token === 'valid'

    const config = defineConfig({
      auth: {
        type: 'custom',
        validate: validator,
      },
    })

    expect(config.auth?.type).toBe('custom')
    expect(config.auth?.validate).toBe(validator)
  })

  test('preserves all custom values together', () => {
    const config = defineConfig({
      port: 4000,
      host: '127.0.0.1',
      cors: {
        origins: ['https://app.example.com', 'https://admin.example.com'],
        credentials: true,
      },
      logging: {
        level: 'warn',
        format: 'json',
      },
      auth: {
        type: 'jwt',
      },
    })

    expect(config.port).toBe(4000)
    expect(config.host).toBe('127.0.0.1')
    expect(config.cors?.origins).toHaveLength(2)
    expect(config.logging?.level).toBe('warn')
    expect(config.auth?.type).toBe('jwt')
  })
})
