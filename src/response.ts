import * as http from 'node:http'
import { sign as signCookie } from 'cookie-signature'
import { serialize as serializeCookie } from 'cookie'

const encodeUrlPkg = require('encodeurl')
const escapeHtmlPkg = require('escape-html')
const etagBuilder = require('etag')
const mime = require('mime-types')
const onFinishedPkg = require('on-finished')
const statusesPkg = require('statuses')
const typeis = require('type-is')
const varyPkg = require('vary')
const contentDispositionPkg = require('content-disposition')

const resProto: Record<string, any> = Object.create(http.ServerResponse.prototype)

resProto.status = function (code: number): any {
  if (typeof code !== 'number') {
    throw new TypeError('status code must be a number')
  }
  this.statusCode = code
  return this
}

resProto.set = function (field: any, value?: string): any {
  if (typeof field === 'object') {
    for (const key of Object.keys(field)) {
      this.set(key, field[key])
    }
    return this
  }

  const lc = field.toLowerCase()
  if (lc === 'content-type') {
    if (!this.get('Content-Type')) {
      this.setHeader(field, value!)
    }
  } else {
    this.setHeader(field, value!)
  }

  return this
}

resProto.header = resProto.set

resProto.get = function (field: string): string | undefined {
  const val = this.getHeader(field)
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return val.join(', ')
  return undefined
}

resProto.append = function (field: string, value: any): any {
  const prev = this.get(field)
  if (prev) {
    const next = Array.isArray(value) ? value : [value]
    value = [prev, ...next].join(', ')
  }
  return this.set(field, value)
}

resProto.type = function (type: string): any {
  const resolved = mime.contentType(type) || type
  return this.set('Content-Type', resolved)
}

resProto.send = function (body?: any): any {
  let chunk: any = body
  let encoding: BufferEncoding | undefined

  if (chunk === null) chunk = ''
  if (chunk === undefined) chunk = ''

  if (typeof chunk === 'string') {
    if (!this.get('Content-Type')) {
      this.type('html')
    }
  } else if (typeof chunk === 'object' && !Buffer.isBuffer(chunk)) {
    if (chunk instanceof Error) {
      if (!this.get('Content-Type')) {
        this.type('json')
      }
      chunk = JSON.stringify(chunk, Object.getOwnPropertyNames(chunk))
    } else {
      if (!this.get('Content-Type')) {
        this.type('json')
      }
      chunk = JSON.stringify(chunk)
    }
    if (typeof chunk !== 'string') chunk = ''
  }

  if (Buffer.isBuffer(chunk)) {
    encoding = 'binary'
    if (!this.get('Content-Type')) {
      this.type('bin')
    }
  }

  if (typeof chunk === 'number') {
    if (arguments.length === 1) {
      if (!this.get('Content-Type')) {
        this.type('txt')
      }
      const msg = statusesPkg.message[chunk]
      chunk = msg || String(chunk)
    } else {
      chunk = String(chunk)
    }
  }

  const etagFn = this.app?.settings?.['etag fn']
  if (etagFn && !this.get('ETag') && (this.statusCode >= 200 && this.statusCode < 300) && chunk !== '') {
    const etag = etagFn(chunk, encoding)
    if (etag) this.set('ETag', etag)
  }

  if (chunk !== undefined && chunk !== null && chunk !== '') {
    if (typeof chunk === 'string') {
      this.set('Content-Length', String(Buffer.byteLength(chunk)))
    } else if (Buffer.isBuffer(chunk)) {
      this.set('Content-Length', String(chunk.length))
    }
  }

  if (this.statusCode === 304 || this.statusCode === 204 || this.statusCode === 205) {
    this.removeHeader('Content-Type')
    this.removeHeader('Content-Length')
    this.removeHeader('Transfer-Encoding')
    chunk = ''
  }

  if (this.method === 'HEAD') {
    this.statusCode = this.statusCode || 200
    this.end()
  } else {
    this.end(chunk, encoding)
  }

  return this
}

resProto.json = function (body: any): any {
  if (!this.get('Content-Type')) {
    this.type('json')
  }
  return this.send(JSON.stringify(body))
}

resProto.jsonp = function (body: any): any {
  const app = this.app
  const callbackName = app?.settings?.['jsonp callback name'] || 'callback'
  const query = this.req?.query || {}
  const url = query[callbackName]

  if (!url) return this.json(body)

  if (!this.get('Content-Type')) {
    this.set('X-Content-Type-Options', 'nosniff')
    this.type('js')
  }

  const bodyStr = JSON.stringify(body)
  const escapedUrl = String(url).replace(/[^0-9a-zA-Z_$]/g, '')
  const chunk = `/**/ typeof ${escapedUrl} === 'function' && ${escapedUrl}(${bodyStr});`
  return this.send(chunk)
}

resProto.sendStatus = function (code: number): any {
  const body = statusesPkg.message[code] || String(code)
  this.statusCode = code
  this.type('txt')
  return this.send(body)
}

resProto.sendFile = function (path: string, options?: any, callback?: any): void {
  const sendPkg = require('send')
  const req = this.req
  let done = callback

  if (!req) {
    if (done) done(new Error('"req" has not been set'))
    return
  }

  if (typeof options === 'function') {
    done = options
    options = {}
  }

  if (!options) options = {}

  const stream = sendPkg(req, path, options)
  let completed = false

  const onfinish = (err?: any) => {
    if (completed) return
    completed = true
    stream.destroy()
    if (done) done(err)
  }

  stream.on('error', (err: any) => {
    if (completed) return
    completed = true
    if (done) return done(err)
    if (!this.headersSent) {
      this.statusCode = err.status || 500
      this.send(statusesPkg.message[this.statusCode] || 'Error')
    }
  })

  stream.on('end', () => {
    this.end()
  })

  stream.pipe(this)

  onFinishedPkg(this, onfinish)
}

resProto.download = function (path: string, filename?: any, options?: any, callback?: any): void {
  let fn = callback
  let name = filename
  let opts = options

  if (typeof filename === 'function') {
    fn = filename
    name = undefined
  }

  if (typeof options === 'function') {
    fn = options
    opts = undefined
  }

  name = name || path.split('/').pop() || path.split('\\').pop() || 'download'
  const disposition = contentDispositionPkg(name)
  this.set('Content-Disposition', disposition)
  this.sendFile(path, opts, fn)
}

resProto.attachment = function (filename?: string): any {
  if (filename) {
    this.type(filename)
  }
  this.set('Content-Disposition', contentDispositionPkg(filename || 'attachment'))
  return this
}

resProto.location = function (url: string): any {
  if (url === 'back') {
    url = this.req?.get('Referrer') || this.req?.get('Referer') || '/'
  }
  this.set('Location', encodeUrlPkg(url))
  return this
}

resProto.redirect = function (...args: any[]): void {
  let status = 302
  let url: string

  if (typeof args[0] === 'number') {
    status = args[0]
    url = args[1]
  } else {
    url = args[0]
  }

  const body = `Redirecting to ${escapeHtmlPkg(url)}`
  this.status(status)
  this.set('Location', url)
  this.set('Content-Type', 'text/html; charset=utf-8')
  this.set('Content-Length', String(Buffer.byteLength(body)))
  this.end(body)
}

resProto.cookie = function (name: string, value: any, options?: any): any {
  const opts = options || {}
  const secret = this.app?.settings?.['cookie secret']
  const signed = opts.signed || false

  if (signed && secret) {
    opts.signed = true
    value = 's:' + signCookie(String(value), secret)
  }

  let val = typeof value === 'object' && !(value instanceof String)
    ? 'j:' + JSON.stringify(value)
    : String(value)

  if (opts.maxAge != null) {
    opts.expires = new Date(Date.now() + opts.maxAge)
    delete opts.maxAge
  }

  const header = serializeCookie(name, val, opts)
  const prev = this.get('Set-Cookie')
  if (prev) {
    this.set('Set-Cookie', String(prev) + ', ' + header)
  } else {
    this.set('Set-Cookie', header)
  }

  return this
}

resProto.clearCookie = function (name: string, options?: any): any {
  return this.cookie(name, '', { ...options, expires: new Date(0), path: options?.path || '/' })
}

resProto.vary = function (field: string): any {
  varyPkg(this, field)
  return this
}

resProto.links = function (links: Record<string, string>): any {
  const link = Object.keys(links).map((rel) => {
    return `<${links[rel]}>; rel="${rel}"`
  }).join(', ')
  return this.set('Link', link)
}

resProto.format = function (obj: Record<string, any>): void {
  const req = this.req
  if (!req) return

  const keys = Object.keys(obj)
  const defaultFn = obj.default
  if (defaultFn) {
    const idx = keys.indexOf('default')
    if (idx >= 0) keys.splice(idx, 1)
  }

  const preferred = req.accepts(keys)
  if (preferred && typeof preferred === 'string') {
    this.type(preferred)
    obj[preferred](req, this)
  } else if (defaultFn) {
    defaultFn(req, this)
  } else {
    this.status(406).send('Not Acceptable')
  }
}

resProto.render = function (view: string, options?: any, callback?: any): void {
  const app = this.app
  let opts = options || {}
  let done = callback
  const self = this

  if (typeof options === 'function') {
    done = options
    opts = {}
  }

  const locals = { ...this.locals, ...opts }

  app.render(view, locals, (err: any, html: string) => {
    if (done) {
      done(err, html)
    } else if (err) {
      this.req?.next?.(err)
    } else {
      self.send(html)
    }
  })
}

export { resProto }
