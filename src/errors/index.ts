export class HttpError extends Error {
  statusCode: number
  expose: boolean
  details?: any

  constructor(statusCode: number, message?: string, details?: any) {
    super(message || statusCodeToString(statusCode))
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.expose = statusCode < 500
    this.details = details
  }
}

export class BadRequestError extends HttpError {
  constructor(message?: string, details?: any) {
    super(400, message || 'Bad request', details)
    this.name = 'BadRequestError'
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message?: string) {
    super(401, message || 'Unauthorized')
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends HttpError {
  constructor(message?: string) {
    super(403, message || 'Forbidden')
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends HttpError {
  constructor(resource?: string, id?: string) {
    const msg = resource
      ? `${resource}${id ? ` "${id}"` : ''} not found`
      : 'Not found'
    super(404, msg)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends HttpError {
  constructor(message?: string, details?: any) {
    super(409, message || 'Conflict', details)
    this.name = 'ConflictError'
  }
}

export class ValidationError extends HttpError {
  issues: any[]

  constructor(issues: any[], message?: string) {
    super(400, message || 'Validation failed', issues)
    this.name = 'ValidationError'
    this.issues = issues
  }
}

export class TooManyRequestsError extends HttpError {
  retryAfter: number

  constructor(retryAfter: number = 60) {
    super(429, `Rate limit exceeded, retry after ${retryAfter}s`)
    this.name = 'TooManyRequestsError'
    this.retryAfter = retryAfter
  }
}

export class InternalServerError extends HttpError {
  constructor(message?: string) {
    super(500, message || 'Internal server error')
    this.name = 'InternalServerError'
    this.expose = false
  }
}

function statusCodeToString(code: number): string {
  const map: Record<number, string> = {
    400: 'Bad request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not found',
    409: 'Conflict',
    429: 'Too many requests',
    500: 'Internal server error'
  }
  return map[code] || `HTTP ${code}`
}
