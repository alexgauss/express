declare module 'accepts' {
  import type { IncomingMessage } from 'node:http'
  interface Accepts {
    types(...args: any[]): any
    encodings(...args: any[]): any
    charsets(...args: any[]): any
    languages(...args: any[]): any
    charset(...args: any[]): any
    encoding(...args: any[]): any
    language(...args: any[]): any
    type(...args: any[]): any
  }
  function accepts(req: IncomingMessage): Accepts
  export = accepts
}

declare module 'parseurl' {
  import type { IncomingMessage } from 'node:http'
  interface ParsedUrl {
    protocol: string
    slashes: boolean
    auth: string | null
    host: string
    port: string
    hostname: string
    hash: string
    search: string
    query: string | null
    pathname: string
    path: string
    href: string
  }
  function parseurl(req: IncomingMessage): ParsedUrl | undefined
  export = parseurl
}

declare module 'fresh' {
  function fresh(reqHeaders: Record<string, string | string[] | undefined>, resHeaders: Record<string, any>): boolean
  export = fresh
}

declare module 'finalhandler' {
  import type { IncomingMessage, ServerResponse } from 'node:http'
  interface FinalhandlerOptions {
    env?: string
    onerror?: (err: any) => void
  }
  function finalhandler(req: IncomingMessage, res: ServerResponse, options?: FinalhandlerOptions): (err?: any) => void
  export = finalhandler
}

declare module 'proxy-addr' {
  import type { IncomingMessage } from 'node:http'
  function proxyaddr(req: IncomingMessage, trust: any): string
  namespace proxyaddr {
    function compile(val: any): any
  }
  export = proxyaddr
}

declare module 'content-type' {
  interface ParsedContentType {
    type: string
    parameters: Record<string, string>
  }
  function parse(type: string): ParsedContentType
  function format(obj: { type: string; parameters?: Record<string, string> }): string
}

declare module 'encodeurl' {
  function encodeurl(url: string): string
  export = encodeurl
}

declare module 'escape-html' {
  function escapeHtml(str: string): string
  export = escapeHtml
}

declare module 'statuses' {
  const statuses: Record<number, string> & { message: Record<number, string> }
  export = statuses
}

declare module 'content-disposition' {
  function contentDisposition(filename?: string): string
  export = contentDisposition
}

declare module 'on-finished' {
  import type { IncomingMessage, ServerResponse } from 'node:http'
  function onFinished(msg: IncomingMessage | ServerResponse, listener: (err?: any) => void): void
  export = onFinished
}

declare module 'vary' {
  import type { ServerResponse } from 'node:http'
  function vary(res: ServerResponse, field: string): void
  export = vary
}

declare module 'qs' {
  interface ParsedQs { [key: string]: any }
  function parse(str: string, options?: any): ParsedQs
}

declare module 'merge-descriptors' {
  function merge(dest: any, src: any, redefine?: boolean): void
  export = merge
}

declare module 'etag' {
  function etag(entity: string | Buffer, options?: { weak?: boolean }): string
  export = etag
}

declare module 'send' {
  import type { IncomingMessage } from 'node:http'
  import { Readable } from 'node:stream'
  function send(req: IncomingMessage, path: string, options?: any): Readable
  export = send
}

declare module 'range-parser' {
  function rangeParser(size: number, str: string, options?: any): any
  export = rangeParser
}

declare module 'type-is' {
  import type { IncomingMessage } from 'node:http'
  function typeis(req: IncomingMessage, types: string[]): string | false
  export = typeis
}

declare module 'cookie-signature' {
  function sign(val: string, secret: string): string
  function unsign(val: string, secret: string): string | false
}

declare module 'cookie' {
  function serialize(name: string, val: string, options?: any): string
  function parse(str: string, options?: any): Record<string, string>
}

declare module 'body-parser' {
  import type { Handler } from './types'
  function json(options?: any): Handler
  function raw(options?: any): Handler
  function text(options?: any): Handler
  function urlencoded(options?: any): Handler
}

declare module 'serve-static' {
  import type { Handler } from './types'
  function serveStatic(root: string, options?: any): Handler
  export = serveStatic
}
