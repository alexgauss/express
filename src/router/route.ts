import type { Handler, Next, Request, Response, Route as RouteInterface } from '../types'
import { createPipeline, RouteExitError } from '../middleware/pipeline'

const METHODS: string[] = require('node:http').METHODS.map((m: string) => m.toLowerCase())

export class Route implements RouteInterface {
  path: string
  stack: any[]
  methods: Record<string, boolean>

  constructor(path: string) {
    this.path = path
    this.stack = []
    this.methods = {}
  }

  all(...handlers: Handler[]): this {
    for (const handler of handlers.flat(Infinity) as Handler[]) {
      this.stack.push({ method: undefined, handler })
    }
    this.methods._all = true
    return this
  }

  dispatch(req: Request, res: Response, done: Next): void {
    const pipeline = createPipeline(
      this.stack.map((layer: any) => ({ handler: layer.handler }))
    )

    pipeline(req, res)
      .then(() => done())
      .catch((err: any) => {
        if (err instanceof RouteExitError) {
          done(null)
        } else {
          done(err)
        }
      })
  }

  _handlesMethod(method: string): boolean {
    if (this.methods._all) return true
    const m = method.toLowerCase()
    if (this.methods[m]) return true
    if (m === 'head' && this.methods.get) return true
    return false
  }

  _methods(): string[] {
    const result = Object.keys(this.methods)
      .filter(k => k !== '_all')
      .map(k => k.toUpperCase())
    if (this.methods.get && !result.includes('HEAD')) {
      result.push('HEAD')
    }
    return result.sort()
  }
}

const RouteProto = Route.prototype as any
for (const method of METHODS) {
  RouteProto[method] = function (...handlers: Handler[]) {
    for (const handler of handlers.flat(Infinity) as Handler[]) {
      this.stack.push({ method, handler })
    }
    this.methods[method] = true
    return this
  }
}
