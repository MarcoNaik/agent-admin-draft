import type { ContextFunction, ContextRequest, ContextResult } from '../types'

export function defineContext(fn: ContextFunction): ContextFunction {
  return async (request: ContextRequest): Promise<ContextResult> => {
    try {
      const result = await fn(request)
      return result ?? {}
    } catch (error) {
      console.error('Context function error:', error)
      return {}
    }
  }
}
