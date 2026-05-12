import type { Handler, Request, Response, Next } from '../types'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  method: string
  url: string
  status: number
  duration: number
  timestamp: string
  requestId?: string
  ip?: string
  userAgent?: string
  contentLength?: number
  error?: string
  [key: string]: any
}

export interface LoggerOptions {
  level?: LogLevel
  format?: 'json' | 'dev' | 'combined' | 'short'
  stream?: NodeJS.WritableStream
  skip?: (req: Request, res: Response) => boolean
  requestId?: (req: Request) => string | undefined
  meta?: Record<string, any>
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

function shouldLog(entryLevel: LogLevel, configLevel: LogLevel): boolean {
  return LOG_LEVELS[entryLevel] >= LOG_LEVELS[configLevel]
}

let requestCounter = 0
const resetHour = Date.now()

function generateRequestId(): string {
  const timestamp = Date.now().toString(36)
  const counter = (++requestCounter).toString(36).padStart(4, '0')
  const random = Math.random().toString(36).slice(2, 6)
  return `${timestamp}-${counter}-${random}`
}

function colorize(status: number): string {
  if (status >= 500) return `\x1b[31m${status}\x1b[0m`
  if (status >= 400) return `\x1b[33m${status}\x1b[0m`
  if (status >= 300) return `\x1b[36m${status}\x1b[0m`
  if (status >= 200) return `\x1b[32m${status}\x1b[0m`
  return String(status)
}

function colorizeMethod(method: string): string {
  const colors: Record<string, string> = {
    GET: '\x1b[34m',
    POST: '\x1b[32m',
    PUT: '\x1b[33m',
    DELETE: '\x1b[31m',
    PATCH: '\x1b[35m',
    HEAD: '\x1b[36m',
    OPTIONS: '\x1b[37m'
  }
  const color = colors[method.toUpperCase()] || '\x1b[37m'
  return `${color}${method}\x1b[0m`
}

function formatDev(entry: LogEntry): string {
  const method = colorizeMethod(entry.method)
  const status = colorize(entry.status)
  const duration = entry.duration > 1000
    ? `\x1b[31m${entry.duration}ms\x1b[0m`
    : entry.duration > 200
      ? `\x1b[33m${entry.duration}ms\x1b[0m`
      : `\x1b[32m${entry.duration}ms\x1b[0m`

  let msg = `  ${method} ${entry.url} ${status} ${duration}`

  if (entry.requestId) {
    msg += ` [${entry.requestId}]`
  }
  if (entry.contentLength) {
    msg += ` - ${entry.contentLength}b`
  }
  if (entry.error) {
    msg += `\n    \x1b[31mError: ${entry.error}\x1b[0m`
  }

  return msg
}

function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry)
}

function formatCombined(entry: LogEntry): string {
  const ip = entry.ip || '-'
  const user = '-'
  const time = entry.timestamp
  const method = entry.method
  const url = entry.url
  const status = entry.status
  const size = entry.contentLength || '-'
  const referrer = '-'
  const agent = entry.userAgent || '-'
  return `${ip} ${user} - [${time}] "${method} ${url} HTTP/1.1" ${status} ${size} "${referrer}" "${agent}"`
}

function formatShort(entry: LogEntry): string {
  const method = entry.method
  const url = entry.url
  const status = entry.status
  const duration = entry.duration
  return `${method} ${url} ${status} ${duration}ms`
}

function getLogLevel(status: number, error?: string): LogLevel {
  if (error) return 'error'
  if (status >= 500) return 'error'
  if (status >= 400) return 'warn'
  return 'info'
}

export function logger(options: LoggerOptions = {}): Handler {
  const config: Required<LoggerOptions> = {
    level: options.level || 'info',
    format: options.format || 'dev',
    stream: options.stream || process.stdout,
    skip: options.skip || (() => false),
    requestId: options.requestId || generateRequestIdFn,
    meta: options.meta || {}
  }

  return (req: Request, res: Response, next: Next) => {
    if (config.skip(req, res)) {
      next()
      return
    }

    const start = Date.now()
    const rid = config.requestId(req) || generateRequestId()
    ;(req as any).requestId = rid

    const originalEnd = res.end.bind(res)
    let finished = false

    res.end = function (this: Response, ...args: any[]): any {
      if (finished) return originalEnd(...args)
      finished = true

      const duration = Date.now() - start
      const level = getLogLevel(res.statusCode, (req as any).error)

      if (shouldLog(level, config.level)) {
        const entry: LogEntry = {
          level,
          timestamp: new Date().toISOString(),
          method: req.method || 'GET',
          url: req.originalUrl || req.url || '/',
          status: res.statusCode || 200,
          duration,
          requestId: rid,
          ip: (req as any).ip,
          userAgent: req.headers?.['user-agent'] as string | undefined,
          contentLength: typeof (res as any).get === 'function'
            ? parseInt(String((res as any).get('Content-Length') || '0'), 10) || undefined
            : undefined,
          ...config.meta
        }

        if ((req as any).error) {
          entry.error = (req as any).error
        }

        let output: string
        switch (config.format) {
          case 'json':
            output = formatJson(entry)
            break
          case 'combined':
            output = formatCombined(entry)
            break
          case 'short':
            output = formatShort(entry)
            break
          case 'dev':
          default:
            output = formatDev(entry)
            break
        }

        config.stream.write(output + '\n')
      }

      return originalEnd(...args)
    }

    next()
  }
}

function generateRequestIdFn(): string {
  return generateRequestId()
}

export function requestId(options?: {
  header?: string
  generate?: () => string
}): Handler {
  const header = options?.header || 'X-Request-Id'
  const generate = options?.generate || generateRequestId

  return (req: Request, res: Response, next: Next) => {
    const id = req.headers?.[header.toLowerCase()] as string | undefined || generate()
    ;(req as any).requestId = id
    res.setHeader(header, id)
    next()
  }
}
