import type { Handler, Request, Response, Next } from '../types'
import { ValidationError } from '../errors/index'

export interface ValidationSchemas {
  body?: StandardSchemaV1
  query?: StandardSchemaV1
  params?: StandardSchemaV1
  headers?: StandardSchemaV1
}

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  '~standard': StandardSchemaV1Props<Input, Output>
}

export interface StandardIssue {
  message?: string
  path?: Array<{ key: string | number; value: any }>
}

interface StandardSchemaV1Props<Input, Output> {
  version: 1
  vendor: string
  validate: (input: unknown) =>
    | { issues: readonly StandardIssue[] }
    | { issues?: undefined; value: Output }
}

export function validate(schemas: ValidationSchemas): Handler {
  return (req: Request, res: Response, next: Next) => {
    const issues: StandardIssue[] = []

    for (const [kind, schema] of Object.entries(schemas) as Array<[string, StandardSchemaV1 | undefined]>) {
      if (!schema) continue

      const input = kind === 'body'
        ? req.body
        : kind === 'query'
          ? req.query
          : kind === 'params'
            ? req.params
            : kind === 'headers'
              ? req.headers
              : undefined

      if (input === undefined) continue

      const result = schema['~standard'].validate(input)

      if ('issues' in result && result.issues) {
        for (const issue of result.issues) {
          issues.push({
            message: issue.message,
            path: issue.path
          })
        }
        continue
      }

      if (kind === 'body' && 'value' in result) {
        ;(req as any).validated = (req as any).validated || {}
        ;(req as any).validated.body = result.value
        ;(req as any).body = result.value
      } else if (kind === 'query' && 'value' in result) {
        ;(req as any).validated = (req as any).validated || {}
        ;(req as any).validated.query = result.value
        ;(req as any).query = result.value
      } else if (kind === 'params' && 'value' in result) {
        ;(req as any).validated = (req as any).validated || {}
        ;(req as any).validated.params = result.value
        ;(req as any).params = result.value
      }
    }

    if (issues.length > 0) {
      const body = JSON.stringify({
        error: 'Validation failed',
        statusCode: 400,
        issues: issues.map(i => ({
          message: i.message || 'Invalid value',
          path: i.path ? i.path.map(p => p.key) : undefined
        }))
      })
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Length', String(Buffer.byteLength(body)))
      res.end(body)
      return
    }

    next()
  }
}

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~standard' in value &&
    typeof (value as any)['~standard'] === 'object'
  )
}
