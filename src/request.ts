import * as http from 'node:http'
import type { Request, Application } from './types'

const acceptsPkg = require('accepts')
const parseurlPkg = require('parseurl')
const freshPkg = require('fresh')
const typeis = require('type-is')

const reqProto: Record<string, any> = Object.create(http.IncomingMessage.prototype)

function defineGetter(name: string, fn: (this: any) => any): void {
  Object.defineProperty(reqProto, name, {
    configurable: true,
    enumerable: true,
    get: fn
  })
}

defineGetter('app', function (this: any) {
  return this.app
})

defineGetter('query', function (this: any) {
  if (this.parsedQuery !== undefined) return this.parsedQuery
  const url = parseurlPkg(this)
  const str = url?.query || ''
  const app: Application = this.app
  const queryParser: any = app?.settings?.['query parser fn']
  const parsed = queryParser ? queryParser(str) : require('qs').parse(str)
  this.parsedQuery = parsed
  return parsed
})

defineGetter('path', function (this: any) {
  const url = parseurlPkg(this)
  return url?.pathname || '/'
})

defineGetter('xhr', function (this: any) {
  const val = this.get('X-Requested-With') || ''
  return val.toLowerCase() === 'xmlhttprequest'
})

defineGetter('protocol', function (this: any) {
  const app: Application = this.app
  const trust = app?.settings?.['trust proxy fn']
  if (trust) {
    const proto = this.get('X-Forwarded-Proto') || ''
    if (proto) return proto.split(/\s*,\s*/)[0]
  }
  return (this.socket?.encrypted) ? 'https' : 'http'
})

defineGetter('secure', function (this: any) {
  return this.protocol === 'https'
})

defineGetter('ip', function (this: any) {
  const app: Application = this.app
  const trust = app?.settings?.['trust proxy fn']
  if (trust) {
    const proxyAddr = require('proxy-addr')
    return proxyAddr(this, trust)
  }
  return this.socket?.remoteAddress || ''
})

defineGetter('subdomains', function (this: any) {
  const app: Application = this.app
  const offset = app?.settings?.['subdomain offset'] || 2
  const hostname = this.hostname
  if (!hostname) return []
  const parts = hostname.split('.').reverse()
  return parts.slice(offset)
})

defineGetter('hostname', function (this: any) {
  const app: Application = this.app
  const trust = app?.settings?.['trust proxy fn']
  let host = this.get('X-Forwarded-Host')
  if (host && trust) {
    host = host.split(/\s*,\s*/)[0]
  } else {
    host = this.get('Host')
  }
  if (!host) return ''
  const portOffset = host.lastIndexOf(':')
  if (portOffset >= 0 && host.indexOf(':', portOffset + 1) === -1) {
    host = host.substring(0, portOffset)
  }
  return host.toLowerCase()
})

defineGetter('host', function (this: any) {
  return this.hostname
})

defineGetter('fresh', function (this: any) {
  const method = this.method
  if (method !== 'GET' && method !== 'HEAD') return false
  const res = this.res
  const status = res?.statusCode
  if ((status && status >= 200 && status < 300) || status === 304) {
    return freshPkg(this.headers, res?._headers || {})
  }
  return false
})

defineGetter('stale', function (this: any) {
  return !this.fresh
})

reqProto.get = function (this: any, field: string): string | undefined {
  const lc = field.toLowerCase()
  switch (lc) {
    case 'referer':
    case 'referrer':
      return this.headers?.referrer || this.headers?.referer || undefined
    default:
      return this.headers?.[lc] as string | undefined
  }
}

reqProto.header = reqProto.get

reqProto.accepts = function (this: any, ...args: any[]): string | string[] | false {
  const accept = acceptsPkg(this)
  return accept.types.apply(accept, args)
}

reqProto.acceptsEncodings = function (this: any, ...args: any[]): string | string[] | false {
  const accept = acceptsPkg(this)
  return accept.encodings.apply(accept, args)
}

reqProto.acceptsCharsets = function (this: any, ...args: any[]): string | string[] | false {
  const accept = acceptsPkg(this)
  return accept.charsets.apply(accept, args)
}

reqProto.acceptsLanguages = function (this: any, ...args: any[]): string | string[] | false {
  const accept = acceptsPkg(this)
  return accept.languages.apply(accept, args)
}

reqProto.range = function (this: any, size: number, options?: any): any {
  const rangeParser = require('range-parser')
  const range = this.get('Range')
  if (!range) return
  return rangeParser(size, range, options)
}

reqProto.is = function (this: any, types: string | string[]): string | false {
  const arr = Array.isArray(types) ? types : [types]
  return typeis(this, arr)
}

export { reqProto }
