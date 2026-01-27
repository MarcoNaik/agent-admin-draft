import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { ApiClient, ApiError } from '../utils/api'

describe('ApiClient', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('token handling', () => {
    test('uses token override when provided in constructor', async () => {
      let capturedHeaders: Record<string, string> = {}

      global.fetch = async (url: any, options: any) => {
        capturedHeaders = options?.headers || {}
        return new Response(JSON.stringify({ user: {}, organization: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const api = new ApiClient(undefined, 'test-token-123')
      await api.getMe()

      expect(capturedHeaders['Authorization']).toBe('Bearer test-token-123')
    })

    test('token override takes precedence over saved credentials', async () => {
      let capturedHeaders: Record<string, string> = {}

      global.fetch = async (url: any, options: any) => {
        capturedHeaders = options?.headers || {}
        return new Response(JSON.stringify({ user: {}, organization: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const api = new ApiClient(undefined, 'override-token')
      await api.getMe()

      expect(capturedHeaders['Authorization']).toBe('Bearer override-token')
    })

    test('makes request without auth header when no token available', async () => {
      let capturedHeaders: Record<string, string> = {}

      global.fetch = async (url: any, options: any) => {
        capturedHeaders = options?.headers || {}
        return new Response(JSON.stringify({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const api = new ApiClient()

      try {
        await api.getMe()
      } catch (e) {
        // Expected to fail
      }

      expect(capturedHeaders['Authorization']).toBeUndefined()
    })
  })

  describe('API requests', () => {
    test('getMe calls correct endpoint', async () => {
      let capturedUrl = ''

      global.fetch = async (url: any, options: any) => {
        capturedUrl = url.toString()
        return new Response(JSON.stringify({
          user: { id: 'u1', email: 'test@test.com', name: 'Test', organizationId: 'o1', role: 'admin' },
          organization: { id: 'o1', name: 'Test Org', slug: 'test-org', plan: 'free' }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const api = new ApiClient('https://api.test.com', 'token')
      const result = await api.getMe()

      expect(capturedUrl).toBe('https://api.test.com/v1/auth/me')
      expect(result.user.email).toBe('test@test.com')
      expect(result.organization.slug).toBe('test-org')
    })

    test('listAgents calls correct endpoint', async () => {
      let capturedUrl = ''

      global.fetch = async (url: any, options: any) => {
        capturedUrl = url.toString()
        return new Response(JSON.stringify({
          agents: [{ id: 'a1', name: 'Agent 1', slug: 'agent-1' }]
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const api = new ApiClient('https://api.test.com', 'token')
      const result = await api.listAgents()

      expect(capturedUrl).toBe('https://api.test.com/v1/agents')
      expect(result.agents).toHaveLength(1)
    })

    test('createAgent sends correct data', async () => {
      let capturedBody = ''

      global.fetch = async (url: any, options: any) => {
        capturedBody = options?.body || ''
        return new Response(JSON.stringify({
          agent: { id: 'a1', name: 'New Agent', slug: 'new-agent', status: 'active' }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const api = new ApiClient('https://api.test.com', 'token')
      await api.createAgent({ name: 'New Agent', slug: 'new-agent', description: 'Test' })

      const body = JSON.parse(capturedBody)
      expect(body.name).toBe('New Agent')
      expect(body.slug).toBe('new-agent')
      expect(body.description).toBe('Test')
    })
  })

  describe('error handling', () => {
    test('throws ApiError on 401 response', async () => {
      global.fetch = async () => {
        return new Response(JSON.stringify({
          error: { message: 'Unauthorized', code: 'UNAUTHORIZED' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const api = new ApiClient(undefined, 'invalid-token')

      await expect(api.getMe()).rejects.toThrow(ApiError)
    })

    test('ApiError contains status code', async () => {
      global.fetch = async () => {
        return new Response(JSON.stringify({
          error: { message: 'Not Found', code: 'NOT_FOUND' }
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const api = new ApiClient(undefined, 'token')

      try {
        await api.getMe()
        expect(true).toBe(false) // Should not reach
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError)
        expect((e as ApiError).status).toBe(404)
        expect((e as ApiError).code).toBe('NOT_FOUND')
      }
    })

    test('ApiError contains error message', async () => {
      global.fetch = async () => {
        return new Response(JSON.stringify({
          error: { message: 'Custom error message', code: 'CUSTOM_ERROR' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const api = new ApiClient(undefined, 'token')

      try {
        await api.getMe()
      } catch (e) {
        expect((e as ApiError).message).toBe('Custom error message')
      }
    })
  })

  describe('base URL handling', () => {
    test('uses provided base URL', async () => {
      let capturedUrl = ''

      global.fetch = async (url: any) => {
        capturedUrl = url.toString()
        return new Response(JSON.stringify({ user: {}, organization: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const api = new ApiClient('https://custom.api.com', 'token')
      await api.getMe()

      expect(capturedUrl).toStartWith('https://custom.api.com')
    })

    test('uses default API URL when not provided', async () => {
      let capturedUrl = ''

      global.fetch = async (url: any) => {
        capturedUrl = url.toString()
        return new Response(JSON.stringify({ user: {}, organization: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const api = new ApiClient(undefined, 'token')
      await api.getMe()

      expect(capturedUrl).toStartWith('https://api.struere.dev')
    })
  })
})

describe('ApiError', () => {
  test('is instance of Error', () => {
    const error = new ApiError('Test error', 'TEST_CODE', 400)
    expect(error).toBeInstanceOf(Error)
  })

  test('has correct name', () => {
    const error = new ApiError('Test error', 'TEST_CODE', 400)
    expect(error.name).toBe('ApiError')
  })

  test('stores code and status', () => {
    const error = new ApiError('Test error', 'TEST_CODE', 500)
    expect(error.code).toBe('TEST_CODE')
    expect(error.status).toBe(500)
    expect(error.message).toBe('Test error')
  })
})
