import type * as http from 'node:http'
import type * as net from 'node:net'
import type { ParsedQs } from 'qs'

export type Handler = (
  req: Request,
  res: Response,
  next: Next
) => any

export type ErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: Next
) => any

export type Next = (err?: any) => void

export type ParamHandler = (
  req: Request,
  res: Response,
  next: Next,
  value: string,
  name: string
) => any

export type App = {
  (req: http.IncomingMessage, res: http.ServerResponse, next?: Next): void
} & Application

export interface Application {
  settings: Record<string, any>
  engines: Record<string, Function>
  cache: Record<string, View>
  locals: Record<string, any>
  mountpath: string
  request: Request
  response: Response
  _router?: any

  init(): void
  defaultConfiguration(): void
  lazyrouter(): any
  handle(req: http.IncomingMessage, res: http.ServerResponse, callback?: Function): void
  use(path: string | Handler | ErrorHandler, ...handlers: (Handler | ErrorHandler)[]): this
  route(path: string): Route
  param(name: string | string[], fn: ParamHandler): this
  listen(port: number, hostname?: string, backlog?: number, callback?: () => void): http.Server
  listen(port: number, hostname?: string, callback?: () => void): http.Server
  listen(port: number, callback?: () => void): http.Server
  listen(path: string, backlog?: number, callback?: () => void): http.Server
  listen(path: string, callback?: () => void): http.Server
  listen(handle: net.ListenOptions, callback?: () => void): http.Server
  set(name: string, value: any): this
  get(name: string): any
  enable(name: string): this
  disable(name: string): this
  enabled(name: string): boolean
  disabled(name: string): boolean
  engine(ext: string, fn: Function): this
  render(name: string, options?: object, callback?: (err: any, html: string) => void): void
  path(): string
  mount(cb: Function): void
  [key: string]: any
}

export interface Router {
  stack: any[]
  params: Record<string, ParamHandler[]>
  caseSensitive: boolean
  mergeParams: boolean
  strict: boolean

  handle(req: Request, res: Response, done: Next): void
  use(path: string | Handler | ErrorHandler, ...handlers: (Handler | ErrorHandler)[]): this
  route(path: string): Route
  param(name: string, fn: ParamHandler): this
  [key: string]: any
}

export interface Route {
  path: string
  stack: any[]
  methods: Record<string, boolean>

  dispatch(req: Request, res: Response, done: Next): void
  all(...handlers: Handler[]): this
  _handlesMethod(method: string): boolean
  _methods(): string[]
  [method: string]: any
}

export interface Layer {
  handle: Handler | ErrorHandler
  name: string
  params?: Record<string, string>
  path?: string
  keys: string[]
  route?: Route
  match(path: string): boolean
  handleRequest(req: http.IncomingMessage, res: http.ServerResponse, next: Next): void
  handleError(err: any, req: http.IncomingMessage, res: http.ServerResponse, next: Next): void
}

export interface Request extends http.IncomingMessage {
  params: Record<string, string>
  query: any
  body: any
  route?: Route
  cookies: Record<string, string>
  signedCookies: Record<string, string>
  app: Application
  res: Response
  next?: Next
  baseUrl: string
  originalUrl: string
  url: string
  _parsedUrl?: any
  _parsedOriginalUrl?: any
  parsedQuery?: any

  get(field: string): string | undefined
  header(field: string): string | undefined
  accepts(...args: any[]): string | string[] | false
  acceptsEncodings(...args: any[]): string | string[] | false
  acceptsCharsets(...args: any[]): string | string[] | false
  acceptsLanguages(...args: any[]): string | string[] | false
  range(size: number, options?: any): any
  is(type: string): string | false
  [key: string]: any
}

export interface Response extends http.ServerResponse {
  app: Application
  req: Request
  locals: Record<string, any>
  _headers: Record<string, any>
  _responseBody?: any

  status(code: number): Response
  set(field: string | Record<string, string>, value?: string): Response
  header(field: string | Record<string, string>, value?: string): Response
  get(field: string): string | undefined
  append(field: string, value: string | string[]): Response
  send(body?: any): Response
  json(body: any): Response
  jsonp(body: any): Response
  sendStatus(code: number): Response
  sendFile(path: string, options?: any, callback?: (err: any) => void): void
  download(path: string, filename?: string, options?: any, callback?: (err: any) => void): void
  type(type: string): Response
  format(obj: Record<string, Function>): void
  attachment(filename?: string): Response
  location(url: string): Response
  redirect(url: string): void
  redirect(status: number, url: string): void
  cookie(name: string, value: string | object, options?: any): Response
  clearCookie(name: string, options?: any): Response
  vary(field: string): Response
  links(links: Record<string, string>): Response
  render(view: string, options?: object, callback?: (err: any, html: string) => void): void
  [key: string]: any
}

export interface View {
  defaultEngine: string
  ext: string
  name: string
  path: string
  engine: Function
  root: string | string[]

  render(options: object, callback: (err: any, html: string) => void): void
}

export interface MiddlewareEntry {
  path: string
  handlers: Handler[]
}

export interface TrieNode {
  prefix: string
  children: Map<string, TrieNode>
  paramChild: TrieNode | null
  paramName: string | null
  wildcardChild: TrieNode | null
  handlers: Map<string, Handler[]>
  allHandlers: Handler[]
  middleware: MiddlewareEntry[]
}

export interface MatchResult {
  params: Record<string, string>
  middleware: MiddlewareEntry[]
  handlers: Handler[]
  node: TrieNode
}

export type PathSegment =
  | { kind: 'static'; value: string }
  | { kind: 'param'; name: string }
  | { kind: 'wildcard'; name?: string }

export type QueryParser = (str: string) => ParsedQs | Record<string, any>
