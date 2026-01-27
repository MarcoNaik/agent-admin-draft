export class PlatformError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'PlatformError'
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      }
    }
  }
}

export class AuthenticationError extends PlatformError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_REQUIRED', message, 401)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends PlatformError {
  constructor(message: string = 'Insufficient permissions') {
    super('INSUFFICIENT_PERMISSIONS', message, 403)
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends PlatformError {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404
    )
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends PlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details)
    this.name = 'ValidationError'
  }
}

export class ConflictError extends PlatformError {
  constructor(message: string) {
    super('CONFLICT', message, 409)
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends PlatformError {
  constructor(retryAfter?: number) {
    super('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', 429, { retryAfter })
    this.name = 'RateLimitError'
  }
}

export class QuotaExceededError extends PlatformError {
  constructor(resource: string) {
    super('QUOTA_EXCEEDED', `${resource} quota exceeded`, 402)
    this.name = 'QuotaExceededError'
  }
}

export class ExecutionError extends PlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('EXECUTION_ERROR', message, 500, details)
    this.name = 'ExecutionError'
  }
}

export class SyncError extends PlatformError {
  constructor(message: string) {
    super('SYNC_ERROR', message, 400)
    this.name = 'SyncError'
  }
}
