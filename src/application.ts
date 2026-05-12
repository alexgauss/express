import * as http from 'node:http'
import * as path from 'node:path'
import { EventEmitter } from 'node:events'
const merge = require('merge-descriptors')
import { Router } from './router/index'
import { RouteBuilder } from './router/builder'
import { View } from './view'
import { reqProto } from './request'
import { resProto } from './response'
import { compileETag } from './utils'
import { OpenAPIRegistry } from './openapi/index'
import { serveOpenAPI, serveSwaggerUI } from './openapi/ui'

const finalhandler = require('finalhandler')

export function createApplication(): any {
  const app: any = function (req: http.IncomingMessage, res: http.ServerResponse, next?: any) {
    app.handle(req, res, next)
  }

  merge(app, EventEmitter.prototype, false)

  const proto = createProto()
  for (const key of Object.keys(proto)) {
    app[key] = proto[key]
  }

  app.settings = {}
  app.engines = {}
  app.cache = {}
  app.locals = {}
  app.mountpath = '/'
  app.request = Object.create(reqProto)
  app.response = Object.create(resProto)

  app.init()

  return app
}

function createProto(): Record<string, any> {
  const proto: Record<string, any> = {}

  proto.init = function () {
    this.cache = {}
    this.engines = {}
    this.settings = {}
    this.defaultConfiguration()
  }

  proto.defaultConfiguration = function () {
    const env = process.env.NODE_ENV || 'development'
    this.set('env', env)
    this.set('query parser', 'simple')
    this.set('subdomain offset', 2)
    this.set('trust proxy', false)
    this.set('etag', env === 'production' ? 'strong' : 'weak')
    this.set('view', View)
    this.set('views', path.resolve(process.cwd(), 'views'))
    this.set('jsonp callback name', 'callback')
    this.set('view cache', env === 'production')
    this.locals.settings = this.settings
  }

  proto.lazyrouter = function () {
    if (!this._router) {
      this._router = new Router({
        caseSensitive: this.enabled('case sensitive routing'),
        strict: this.enabled('strict routing')
      })
    }
    return this._router
  }

  proto.handle = function (req: http.IncomingMessage, res: http.ServerResponse, callback?: any) {
    const done = callback || finalhandler(req, res, {
      env: this.get('env'),
      onerror: undefined
    })

    ;(req as any).app = this
    ;(res as any).app = this
    ;(req as any).res = res
    ;(res as any).req = req
    ;(req as any).params = {}
    ;(res as any).locals = {}

    Object.setPrototypeOf(req, this.request)
    Object.setPrototypeOf(res, this.response)

    if (this.get('x-powered-by') !== false) {
      res.setHeader('X-Powered-By', 'Express')
    }

    const router = this._router
    if (!router) {
      done()
      return
    }

    router.handle(req as any, res as any, done)
  }

  proto.use = function (path: any, ...handlers: any[]) {
    let usePath = '/'
    let useHandlers: any[] = []

    if (typeof path === 'string') {
      usePath = path
      useHandlers = handlers
    } else {
      useHandlers = [path, ...handlers]
    }

    const router = this.lazyrouter()

    for (const handler of useHandlers.flat(Infinity)) {
      if (handler.handle && handler.set) {
        const subApp = handler
        const subPath = usePath
        router.use(subPath, (req: any, res: any, next: any) => {
          const prevReqProto = Object.getPrototypeOf(req)
          const prevResProto = Object.getPrototypeOf(res)
          Object.setPrototypeOf(req, subApp.request || this.request)
          Object.setPrototypeOf(res, subApp.response || this.response)
          subApp.handle(req, res, (err?: any) => {
            Object.setPrototypeOf(req, prevReqProto)
            Object.setPrototypeOf(res, prevResProto)
            next(err)
          })
        })
      } else {
        router.use(usePath, handler)
      }
    }

    return this
  }

  proto.route = function (path: string) {
    return new RouteBuilder(path, this.lazyrouter())
  }

  proto.param = function (name: any, fn: any) {
    this.lazyrouter().param(name, fn)
    return this
  }

  proto.listen = function (...args: any[]) {
    const server = http.createServer((req: any, res: any) => this.handle(req, res))
    return server.listen(...args)
  }

  proto.set = function (name: string, value: any) {
    if (arguments.length === 1 && typeof name === 'string') {
      return this.settings[name]
    }

    this.settings[name] = value

    switch (name) {
      case 'etag':
        this.settings['etag fn'] = compileETag(value)
        break
      case 'query parser':
        this.settings['query parser fn'] = compileQueryParser(value)
        break
      case 'trust proxy':
        if (value !== false) {
          this.settings['trust proxy fn'] = require('proxy-addr').compile(value)
        } else {
          this.settings['trust proxy fn'] = false
        }
        break
      case 'openapi':
        {
          const opts = value || {}
          const info = opts.info || { title: 'API', version: '1.0.0' }
          const spec = OpenAPIRegistry.generateSpec({
            info,
            servers: opts.servers || [{ url: '/' }],
            security: opts.security
          })
          const router = this.lazyrouter()
          router.get('/openapi.json', serveOpenAPI(spec))
          if (opts.serveUI !== false) {
            router.get('/docs', serveSwaggerUI('/openapi.json'))
          }
        }
        break
    }

    return this
  }

  proto.get = function (name: string) {
    if (arguments.length === 1 && name === '') return undefined
    if (name in this.settings) return this.settings[name]
    return undefined
  }

  proto.enable = function (name: string) {
    return this.set(name, true)
  }

  proto.disable = function (name: string) {
    return this.set(name, false)
  }

  proto.enabled = function (name: string) {
    return !!this.get(name)
  }

  proto.disabled = function (name: string) {
    return !this.get(name)
  }

  proto.engine = function (ext: string, fn: any) {
    const extension = ext[0] !== '.' ? '.' + ext : ext
    this.engines[extension] = fn
    return this
  }

  proto.render = function (name: string, options?: any, callback?: any) {
    const done = callback || ((err: any, html: string) => {
      if (err) throw err
    })

    if (!options) options = {}
    const opts = { _locals: this.locals, ...options }

    const ViewClass = this.get('view')
    const view = new ViewClass(name, {
      defaultEngine: this.get('view engine'),
      root: this.get('views'),
      engines: this.engines
    })

    if (!view.path) {
      const err = new Error(`Failed to lookup view "${name}" in views directory "${this.get('views')}"`)
      done(err, '')
      return
    }

    this.cache[name] = view
    view.render(opts, done)
  }

  proto.path = function () {
    return this.mountpath
  }

  const methodsList: string[] = require('node:http').METHODS.map((m: string) => m.toLowerCase())

  const settingsGet = proto.get

  for (const method of methodsList) {
    if (method === 'get') {
      proto.get = function (path: string, ...handlers: any[]) {
        if (arguments.length === 1) {
          return settingsGet.call(this, path)
        }
        const router = this.lazyrouter()
        const flatHandlers = handlers.flat(Infinity)
        router.get(path, ...flatHandlers)
        return this
      }
    } else {
      proto[method] = function (path: string, ...handlers: any[]) {
        const router = this.lazyrouter()
        const flatHandlers = handlers.flat(Infinity)
        router[method](path, ...flatHandlers)
        return this
      }
    }
  }

  proto.all = function (path: string, ...handlers: any[]) {
    const router = this.lazyrouter()
    const flatHandlers = handlers.flat(Infinity)
    router.all(path, ...flatHandlers)
    return this
  }

  return proto
}

function compileQueryParser(val: any): any {
  if (typeof val === 'function') return val
  if (val === 'simple' || val === true) {
    return (str: string) => {
      const { URLSearchParams } = require('node:url') as typeof import('node:url')
      const params = new URLSearchParams(str)
      const result: Record<string, any> = {}
      for (const [key, value] of params.entries()) {
        result[key] = value
      }
      return result
    }
  }
  if (val === 'extended' || val === false) {
    return require('qs').parse
  }
  return require('qs').parse
}
