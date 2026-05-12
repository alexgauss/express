import type {
  Handler, ErrorHandler, Next, Request, Response,
  Route as RouteInterface,
  ParamHandler
} from '../types'
import { RadixTrie } from './trie'
import { Route } from './route'
import { createPipeline, buildHandlerChain, RouterExitError } from '../middleware/pipeline'

const METHODS: string[] = require('node:http').METHODS.map((m: string) => m.toLowerCase())

export class Router {
  [key: string]: any
  stack: any[]
  params: Record<string, ParamHandler[]>

  constructor(options: Partial<{
    caseSensitive: boolean
    mergeParams: boolean
    strict: boolean
  }> = {}) {
    this.stack = []
    this.params = {}
    this.caseSensitive = options.caseSensitive ?? false
    this.mergeParams = options.mergeParams ?? false
    this.strict = options.strict ?? false
    this._trie = new RadixTrie()

    for (const method of METHODS) {
      this[method] = (path: string, ...handlers: Handler[]) => {
        const flatHandlers = handlers.flat(Infinity) as Handler[]
        const route = new Route(path)
        for (const handler of flatHandlers) {
          (route as any)[method](handler)
        }
        this._trie.insert(path, method, flatHandlers)
        this.stack.push(route)
        return this
      }
    }
  }

  handle(req: Request, res: Response, done: Next): void {
    let method = req.method?.toLowerCase() || 'get'
    const url = (req.url || '/').split('?')[0]

    if (method === 'head' && !this._trie.hasRoute(url, 'head')) {
      method = 'get'
    }

    const result = this._trie.lookup(url, method)

    if (!result) {
      done()
      return
    }

    req.params = {
      ...(this.mergeParams && req.params ? req.params : {}),
      ...result.params
    }

    const paramNames = Object.keys(result.params)
    const paramCallbacks: Array<{ name: string; fns: ParamHandler[] }> = []

    for (const name of paramNames) {
      const cbs = this.params[name]
      if (cbs && cbs.length > 0) {
        paramCallbacks.push({ name, fns: cbs })
      }
    }

    const middlewarePath = req.baseUrl || ''
    const chain = buildHandlerChain(result.middleware, result.handlers, middlewarePath)

    const runPipeline = () => {
      const pipeline = createPipeline(chain)
      return pipeline(req, res)
    }

    const finalize = () => done()

    if (paramCallbacks.length === 0) {
      runPipeline()
        .then(finalize)
        .catch((err: any) => {
          if (err instanceof RouterExitError) {
            finalize()
          } else {
            this._handleError(err, req, res, chain, done)
          }
        })
    } else {
      this._runParamCallbacks(req, res, paramCallbacks)
        .then(() => runPipeline())
        .then(finalize)
        .catch((err: any) => {
          if (err instanceof RouterExitError) {
            finalize()
          } else {
            this._handleError(err, req, res, chain, done)
          }
        })
    }
  }

  private async _runParamCallbacks(
    req: Request,
    res: Response,
    paramCallbacks: Array<{ name: string; fns: ParamHandler[] }>
  ): Promise<void> {
    for (const { name, fns } of paramCallbacks) {
      const value = req.params[name]
      for (const fn of fns) {
        await new Promise<void>((resolve, reject) => {
          try {
            const result = fn(req, res, (err?: any) => {
              if (err) reject(err)
              else resolve()
            }, value, name)
            if (result instanceof Promise) {
              result.then(resolve, reject)
            }
          } catch (err) {
            reject(err)
          }
        })
      }
    }
  }

  private _handleError(
    err: any,
    req: Request,
    res: Response,
    chain: Array<{ handler: Handler | ErrorHandler; path?: string }>,
    done: Next
  ): void {
    const errorIndex = chain.findIndex(l => l.handler.length === 4)

    if (errorIndex === -1) {
      done(err)
      return
    }

    const errorChain = chain.slice(errorIndex)
    const pipeline = createPipeline(errorChain)
    pipeline(req, res)
      .then(() => {
        if (!res.headersSent) {
          done(err)
        } else {
          done()
        }
      })
      .catch(() => done(err))
  }

  use(path: string | Handler | ErrorHandler, ...handlers: (Handler | ErrorHandler)[]): this {
    let usePath = '/'
    let useHandlers: (Handler | ErrorHandler)[] = []

    if (typeof path === 'string') {
      usePath = path
      useHandlers = handlers
    } else {
      useHandlers = [path, ...handlers]
    }

    const flatHandlers = useHandlers.flat(Infinity) as (Handler | ErrorHandler)[]

    this._trie.insertMiddleware(usePath, flatHandlers)
    return this
  }

  route(path: string): RouteInterface {
    const route = new Route(path)
    this._trie.insert(path, 'ALL', [])
    this.stack.push(route)
    return route
  }

  param(name: string, fn: ParamHandler): this {
    if (!this.params[name]) {
      this.params[name] = []
    }
    this.params[name].push(fn)
    return this
  }

  all(path: string, ...handlers: Handler[]): this {
    const flatHandlers = handlers.flat(Infinity) as Handler[]
    const route = new Route(path)
    route.all(...flatHandlers)
    this._trie.insert(path, 'ALL', flatHandlers)
    this.stack.push(route)
    return this
  }
}
