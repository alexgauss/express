import type { Handler, Request as ExpressRequest, Response as ExpressResponse, Next } from '../types'
import type { Router } from './index'
import { validate, type ValidationSchemas } from '../middleware/validate'
import { OpenAPIRegistry } from '../openapi/index'

export interface RouteDescription {
  summary?: string
  description?: string
  tags?: string[]
  deprecated?: boolean
  security?: Array<Record<string, string[]>>
  operationId?: string
  responses?: Record<string | number, {
    description: string
    schema?: any
  }>
}

const HTTP_VERBS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const
type HttpVerb = typeof HTTP_VERBS[number]

export class RouteBuilder {
  private schemas?: ValidationSchemas
  private description?: RouteDescription
  private routeMiddleware: Handler[] = []
  private finalized = false

  constructor(
    private path: string,
    private router: Router
  ) {}

  validate(schemas: ValidationSchemas): this {
    if (this.finalized) throw new Error('RouteBuilder already finalized')
    this.schemas = schemas
    return this
  }

  describe(desc: RouteDescription): this {
    if (this.finalized) throw new Error('RouteBuilder already finalized')
    this.description = desc
    return this
  }

  middleware(...handlers: Handler[]): this {
    if (this.finalized) throw new Error('RouteBuilder already finalized')
    for (const h of handlers.flat(Infinity) as Handler[]) {
      this.routeMiddleware.push(h)
    }
    return this
  }

  all(...handlers: Handler[]): this {
    return this.registerRoute('all', ...handlers)
  }

  get(...handlers: Handler[]): this {
    return this.registerRoute('get', ...handlers)
  }

  post(...handlers: Handler[]): this {
    return this.registerRoute('post', ...handlers)
  }

  put(...handlers: Handler[]): this {
    return this.registerRoute('put', ...handlers)
  }

  delete(...handlers: Handler[]): this {
    return this.registerRoute('delete', ...handlers)
  }

  patch(...handlers: Handler[]): this {
    return this.registerRoute('patch', ...handlers)
  }

  options(...handlers: Handler[]): this {
    return this.registerRoute('options', ...handlers)
  }

  head(...handlers: Handler[]): this {
    return this.registerRoute('head', ...handlers)
  }

  private registerRoute(method: string, ...handlers: Handler[]): this {
    if (this.finalized) throw new Error('RouteBuilder already finalized')
    this.finalized = true

    const allHandlers: Handler[] = []
    const flatHandlers = handlers.flat(Infinity) as Handler[]

    if (this.schemas) {
      allHandlers.push(validate(this.schemas))
    }

    allHandlers.push(...this.routeMiddleware)
    allHandlers.push(...flatHandlers)

    if (method === 'all') {
      this.router.all(this.path, ...allHandlers)
    } else {
      ;(this.router as any)[method](this.path, ...allHandlers)
    }

    if (this.description) {
      const paramSchemas: { path?: any; query?: any; headers?: any } = {}
      if (this.schemas?.params) paramSchemas.path = this.schemas.params
      if (this.schemas?.query) paramSchemas.query = this.schemas.query
      if (this.schemas?.headers) paramSchemas.headers = this.schemas.headers

      OpenAPIRegistry.register({
        method: method === 'all' ? undefined : method.toUpperCase(),
        path: this.path,
        summary: this.description.summary,
        description: this.description.description,
        tags: this.description.tags,
        deprecated: this.description.deprecated,
        security: this.description.security,
        operationId: this.description.operationId,
        parameters: Object.keys(paramSchemas).length > 0 ? paramSchemas : undefined,
        requestBody: this.schemas?.body,
        responses: this.description.responses
      })
    }

    return this
  }
}
