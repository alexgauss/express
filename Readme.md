[![Express Logo](https://i.cloudup.com/zfY6lL7eFa-3000x3000.png)](https://expressjs.com/)

**Fast, type-safe, minimalist web framework for Node.js.**

TypeScript-native. Radix-trie router. Async-first pipeline. Fluent API builder.
Built-in validation. Auto-generated OpenAPI docs. Zero external routing deps.

```typescript
import express from 'express'

const app = express()

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(3000)
```

## Table of Contents

- [Why This Version?](#why-this-version)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Radix-Trie Router](#radix-trie-router)
  - [Async-First Pipeline](#async-first-pipeline)
- [Application API](#application-api)
  - [express()](#express)
  - [app.use()](#appuse)
  - [app.get() / app.post() / app.put() / app.delete()](#appget--apppost--appput--appdelete)
  - [app.route() (Fluent Builder)](#approute-fluent-builder)
  - [app.all()](#appall)
  - [app.param()](#appparam)
  - [app.set() / app.get() / app.enable() / app.disable()](#appset--appget--appenable--appdisable)
  - [app.listen()](#applisten)
  - [app.render() / app.engine()](#apprender--appengine)
- [Fluent Route Builder](#fluent-route-builder)
  - [.describe()](#describe)
  - [.validate()](#validate)
  - [.middleware()](#middleware)
  - [Terminal Verbs (.get, .post, etc.)](#terminal-verbs)
- [Request Validation](#request-validation)
  - [Standard Schema Interface](#standard-schema-interface)
  - [Using Valibot](#using-valibot)
  - [Validation Targets](#validation-targets)
- [Typed HTTP Errors](#typed-http-errors)
  - [Error Classes](#error-classes)
  - [Usage in Routes](#usage-in-routes)
- [Response Helpers](#response-helpers)
- [OpenAPI & Swagger UI](#openapi--swagger-ui)
  - [Setup](#setup)
  - [Customization](#customization)
  - [How It Works](#how-it-works)
- [Logging](#logging)
  - [express.logger()](#expresslogger)
  - [express.requestId()](#expressrequestid)
  - [Log Formats](#log-formats)
- [Request API](#request-api)
  - [req.params](#reqparams)
  - [req.query](#reqquery)
  - [req.body](#reqbody)
  - [req.path / req.hostname / req.ip / req.protocol](#reqpath--reqhostname--reqip--reqprotocol)
  - [req.get() / req.accepts() / req.is()](#reqget--reqaccepts--reqis)
  - [req.xhr / req.range()](#reqxhr--reqrange)
- [Response API](#response-api)
  - [res.status()](#resstatus)
  - [res.send()](#ressend)
  - [res.json() / res.jsonp()](#resjson--resjsonp)
  - [res.redirect()](#resredirect)
  - [res.cookie() / res.clearCookie()](#rescookie--resclearcookie)
  - [res.set() / res.get() / res.append()](#resset--resget--resappend)
  - [res.type() / res.format()](#restype--resformat)
  - [res.sendFile() / res.download()](#ressendfile--resdownload)
  - [res.render()](#resrender)
- [Error Handling](#error-handling)
  - [Error Middleware](#error-middleware)
  - [Async Errors](#async-errors)
- [Static Files](#static-files)
- [Body Parsing](#body-parsing)
- [Router](#router)
- [Async Examples](#async-examples)
  - [Async Database CRUD](#async-database-crud)
  - [Async Error Handling Patterns](#async-error-handling-patterns)
  - [Async Middleware with External APIs](#async-middleware-with-external-apis)
  - [Async Request Validation](#async-request-validation)
  - [Concurrent Operations](#concurrent-operations)
  - [Stream Processing](#stream-processing)
- [TypeScript Usage](#typescript-usage)
  - [Exported Types](#exported-types)
- [Migration from Express 5.x](#migration-from-express-5x)
- [Running Tests](#running-tests)
- [License](#license)

---

## Why This Version?

Express has been rewritten from the ground up in TypeScript with no compromises:

| Feature | v5 (classic) | v6+ (this) |
|---|---|---|
| Language | JavaScript | **TypeScript** (strict) |
| Router | External `router` package | **Built-in radix trie** |
| Path matching | `path-to-regexp` / RegExp | **Native segment trie** |
| Route lookup speed | O(n) linear scan | **O(k)** (URL path length) |
| Middleware dispatch | Callback sentinel + sync counter | **Async/Promise pipeline** |
| `async` handlers | `is-promise` detection overhead | **Native** (no overhead) |
| Validation | Manual if-checks | **Standard Schema middleware** |
| API docs | External tools | **Auto-generated OpenAPI 3.1** |
| Logging | External middleware (morgan) | **Built-in structured logger** |
| HTTP errors | Plain `Error` | **Typed hierarchy** |
| Response helpers | Manual status + send | **Semantic methods (res.ok(), etc.)** |

## Installation

```bash
npm install express
```

Node.js 18 or higher required.

## Quick Start

```typescript
import express from 'express'

const app = express()

app.get('/hello', (req, res) => {
  res.send('Hello World')
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
```

**With the fluent builder:**

```typescript
import express from 'express'
import * as v from 'valibot'

const app = express()

app.route('/users/:id')
  .describe({ summary: 'Get user by ID', tags: ['users'] })
  .validate({ params: v.object({ id: v.string() }) })
  .get(async (req, res) => {
    const user = await db.findUser(req.params.id)
    if (!user) throw new NotFoundError('User')
    res.ok(user)
  })

app.set('openapi', {
  info: { title: 'My API', version: '1.0.0' }
})

app.listen(3000)
```

## Core Concepts

### Radix-Trie Router

Traditional Express stores all routes in a flat array and scans them linearly — O(n) per request.
This version uses a **compressed radix trie** where each URL segment is a node in the tree.

```
Linear scan (v5):                  Radix trie (v6):
stack = [                          root ""
  "/users"         GET,               ├── "api/"
  "/users/:id"     GET,               │   ├── "users"
  "/users/:id/post" GET,              │   │   ├── ":id" → params.id
  "/api/users"     GET,               │   │   │   └── "/posts" → params.postId
  "/api/products"  GET,               │   │   └── [GET handler]
]                                    │   └── "products" [GET handler]
                                     └── "static/*" (wildcard)
```

Lookup walks the tree segment by segment, achieving O(k) where k = path length.
Static segments take priority over parameterized segments at the same level.
Ancestor middleware is automatically collected during traversal.

### Async-First Pipeline

Express 5 uses a callback sentinel system with a `sync` counter hack to prevent stack
overflow after 100 synchronous layers. This version uses a native Promise pipeline:

```typescript
// Internal dispatch (simplified)
async function next(err?: any): Promise<void> {
  const layer = layers[idx++]
  if (!layer) return
  await callHandler(layer.handler, [req, res, next])
}
```

Benefits:
- **No sync counter** — async/await naturally yields to the event loop
- **Automatic error catching** — `async` function rejections are caught by the pipeline
- **No `is-promise` overhead** — handlers returning Promises work natively
- **`next('route')` and `next('router')`** sentinels are preserved for compatibility

---

## Application API

### express()

Creates the application. The returned `app` is a callable function suitable for `http.createServer(app)`.

```typescript
import express from 'express'
const app = express()
```

**Static exports:**

| Export | Description |
|---|---|
| `express.Router` | Router class constructor |
| `express.Route` | Route class constructor |
| `express.logger()` | Structured request logging middleware |
| `express.requestId()` | Request ID generation middleware |
| `express.validate()` | Schema validation middleware |
| `express.json()` | JSON body parser |
| `express.urlencoded()` | URL-encoded body parser |
| `express.raw()` | Raw body parser |
| `express.text()` | Text body parser |
| `express.static()` | Static file serving |

### app.use()

Mounts middleware or sub-apps.

```typescript
// Global middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

// Path-scoped middleware
app.use('/api', authenticate)

// Sub-app mounting
const admin = express()
admin.get('/', (req, res) => res.send('Admin'))
app.use('/admin', admin)

// Multiple handlers
app.use('/user', authenticate, loadProfile)
```

### app.get() / app.post() / app.put() / app.delete()

Registers route handlers for specific HTTP methods.

```typescript
app.get('/users', (req, res) => res.json(users))
app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id })
})
app.post('/users', express.json(), (req, res) => {
  res.status(201).json(req.body)
})

// Multiple route params: /users/:userId/posts/:postId
app.get('/users/:userId/posts/:postId', (req, res) => {
  res.send(`User ${req.params.userId}, Post ${req.params.postId}`)
})

// app.get() with one argument reads a setting
app.set('title', 'My App')
const title = app.get('title')
```

### app.route() (Fluent Builder)

Returns a `RouteBuilder` for chaining describe, validate, middleware, and verb methods.

```typescript
app.route('/users')
  .describe({ summary: 'List users', tags: ['users'] })
  .get(listHandler)

app.route('/users/:id')
  .describe({ summary: 'Get user', tags: ['users'] })
  .validate({ params: idSchema })
  .middleware(authenticate)
  .get(async (req, res) => {
    const user = await db.findUser(req.params.id)
    if (!user) throw new NotFoundError('User')
    res.ok(user)
  })
```

### app.all()

Registers handlers for all HTTP methods.

```typescript
app.all('/api/*', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  next()
})
```

### app.param()

Registers parameter callbacks executed before route handlers.

```typescript
app.param('id', async (req, res, next, value, name) => {
  req.user = await db.findUser(value)
  if (!req.user) return next(new NotFoundError('User'))
  next()
})

app.get('/users/:id', (req, res) => res.json(req.user))
```

### app.set() / app.get() / app.enable() / app.disable()

Settings system. `app.get()` with one argument reads a setting; with two, writes.

```typescript
app.set('title', 'My App')
app.set('etag', 'strong')            // 'strong' | 'weak' | false
app.set('trust proxy', true)         // enable X-Forwarded-* headers
app.set('query parser', 'extended')  // 'simple' | 'extended' | custom fn
app.set('env', 'production')
app.set('view engine', 'ejs')
app.set('views', './views')
app.set('jsonp callback name', 'cb')
app.set('view cache', true)

// Side-effect settings trigger compilation:
// 'etag' → compiles ETag function
// 'query parser' → compiles query parser
// 'trust proxy' → compiles proxy trust function

app.enable('trust proxy')
console.log(app.enabled('trust proxy')) // true

app.disable('x-powered-by')
console.log(app.disabled('x-powered-by')) // true
```

### app.listen()

Creates an HTTP server and starts listening.

```typescript
app.listen(3000)
app.listen(3000, '0.0.0.0')
app.listen(3000, () => console.log('Ready'))
// Unix socket: app.listen('/tmp/app.sock')
```

### app.render() / app.engine()

View template rendering.

```typescript
app.engine('ejs', require('ejs').renderFile)
app.set('view engine', 'ejs')

// In a route handler
app.get('/hello', (req, res) => {
  res.render('hello', { name: 'World' })
})

// Programmatic
app.render('email', { name: 'Alice' }, (err, html) => {
  console.log(html)
})
```

---

## Fluent Route Builder

The `RouteBuilder` returned by `app.route()` provides a chainable pipeline.

### .describe()

Attaches OpenAPI metadata to the route. Only routes with `.describe()` appear in the generated spec.

```typescript
app.route('/users/:id')
  .describe({
    summary: 'Get user by ID',
    description: 'Returns a single user with all profile fields',
    tags: ['users'],
    deprecated: false,
    responses: {
      200: { description: 'User found', schema: UserSchema },
      404: { description: 'User not found' }
    }
  })
  .get(handler)
```

### .validate()

Accepts a `ValidationSchemas` object with Standard Schema v1 compatible schemas.

```typescript
app.route('/users')
  .validate({
    query: v.object({ page: v.optional(v.number()), limit: v.optional(v.number()) }),
    headers: v.object({ authorization: v.string() })
  })
  .get(handler)
```

### .middleware()

Adds middleware specific to this route (runs after validation, before handler).

```typescript
app.route('/admin/users')
  .middleware(authenticate, requireAdmin)
  .get(adminHandler)
```

### Terminal Verbs

Each builder can be finalized **once**. Calling any terminal verb locks the builder.

```typescript
.get(handler)
.post(handler)
.put(handler)
.delete(handler)
.patch(handler)
.options(handler)
.head(handler)
.all(handler)  // all HTTP methods
```

---

## Request Validation

Validate request data using any Standard Schema v1 compatible library.

```typescript
import * as v from 'valibot'
import { validate } from 'express'

const UserSchema = v.object({
  name: v.pipe(v.string(), v.minLength(2)),
  email: v.pipe(v.string(), v.email())
})

app.post('/users',
  validate({ body: UserSchema }),
  (req, res) => {
    // req.body is validated and typed
    res.created(req.body)
  }
)
```

### Standard Schema Interface

Vendor-neutral schema validation interface. Works with Valibot, Zod, ArkType, and any library implementing the spec.

```typescript
interface StandardSchemaV1 {
  '~standard': {
    version: 1
    vendor: string
    validate: (input: unknown) =>
      | { issues: StandardIssue[] }
      | { value: unknown }
  }
}
```

### Using Valibot

Valibot is the recommended validation library — tree-shakeable, zero dependencies, 700B+ bundle.

```bash
npm install valibot
```

```typescript
import * as v from 'valibot'

const schema = v.object({
  name: v.pipe(v.string(), v.minLength(2)),
  age: v.pipe(v.number(), v.minValue(0), v.maxValue(150)),
  email: v.optional(v.pipe(v.string(), v.email())),
  role: v.optional(v.picklist(['admin', 'user', 'guest']))
})

app.post('/users',
  validate({ body: schema }),
  async (req, res) => {
    const user = await db.createUser(req.body)
    res.created(user)
  }
)
```

### Validation Targets

| Target | Schema Key | Sets Property | Validated Copy |
|---|---|---|---|
| Request body | `body` | `req.body` | `req.validated.body` |
| Query string | `query` | `req.query` | `req.validated.query` |
| Route params | `params` | `req.params` | `req.validated.params` |
| Headers | `headers` | — | `req.validated.headers` |

On failure, responds with HTTP 400 and JSON error body with field-level issues.

---

## Typed HTTP Errors

A hierarchy of typed error classes for structured error handling.

### Error Classes

```typescript
import {
  HttpError,
  BadRequestError,      // 400
  UnauthorizedError,    // 401
  ForbiddenError,       // 403
  NotFoundError,        // 404
  ConflictError,        // 409
  ValidationError,      // 400 (with issues array)
  TooManyRequestsError, // 429 (with retryAfter)
  InternalServerError   // 500
} from 'express'
```

### Usage in Routes

```typescript
app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id)
  if (!user) throw new NotFoundError('User', req.params.id)
  res.ok(user)
})

app.post('/register', async (req, res) => {
  const existing = await db.findByEmail(req.body.email)
  if (existing) throw new ConflictError('Email already registered')
  const user = await db.createUser(req.body)
  res.created(user)
})

app.use('/admin', (req, res, next) => {
  if (!req.isAuthenticated) throw new UnauthorizedError()
  next()
})
```

All errors expose `.statusCode` and `.expose` (true for 4xx, false for 5xx).

---

## Response Helpers

Semantic response methods that set status and body in one call.

```typescript
res.ok(body)               // 200 — { ... }
res.created(body)          // 201 — { ... }
res.noContent()            // 204 — (no body)
res.badRequest(errors?)    // 400 — { error, details? }
res.unauthorized(msg?)     // 401 — { error }
res.forbidden(msg?)        // 403 — { error }
res.notFound(msg?)         // 404 — { error }
res.conflict(msg?)         // 409 — { error }
res.tooManyRequests(retry?) // 429 — { error } (sets Retry-After)
res.error(status, msg?)    // custom — { error }
```

```typescript
app.get('/items', (req, res) => res.ok(items))
app.post('/items', (req, res) => res.created(newItem))
app.delete('/items/:id', (req, res) => res.noContent())
app.get('/admin', (req, res) => res.forbidden('Admins only'))
```

---

## OpenAPI & Swagger UI

Auto-generate OpenAPI 3.1 documentation from fluent route definitions. No manual schema files.

### Setup

```typescript
app.route('/users')
  .describe({
    summary: 'List users',
    description: 'Returns all registered users',
    tags: ['users'],
    responses: {
      200: { description: 'Users found', schema: UserSchema }
    }
  })
  .get(listHandler)

app.route('/users/:id')
  .describe({
    summary: 'Get user by ID',
    tags: ['users'],
    responses: {
      200: { description: 'User found', schema: UserSchema },
      404: { description: 'User not found' }
    }
  })
  .validate({ params: idSchema })
  .get(getHandler)

// Enable spec generation and Swagger UI
app.set('openapi', {
  info: { title: 'My API', version: '1.0.0' },
  servers: [{ url: 'http://localhost:3000' }]
})
// → GET /openapi.json serves the generated spec
// → GET /docs serves Swagger UI
```

### Customization

```typescript
app.set('openapi', {
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'Production API',
    contact: { name: 'Support', email: 'api@example.com' },
    license: { name: 'MIT' }
  },
  servers: [
    { url: 'https://api.example.com', description: 'Production' },
    { url: 'http://localhost:3000', description: 'Development' }
  ],
  security: [{ bearerAuth: [] }],
  serveUI: false   // disable Swagger UI, keep /openapi.json
})
```

### How It Works

- Only routes defined with the fluent `.route().describe()` builder are included
- Bare `app.get('/path', fn)` routes are not collected (zero overhead)
- Path parameters normalize from `:id` to `{id}` (OpenAPI format)
- Valibot schemas are introspected at runtime and converted to JSON Schema
- The spec is generated once when `app.set('openapi', ...)` is called

---

## Logging

Built-in structured request logging with multiple output formats.

### express.logger()

```typescript
import express from 'express'
const app = express()

// Development mode (colorized, concise)
app.use(express.logger())

// JSON structured logging (production)
app.use(express.logger({
  format: 'json',
  level: 'info'
}))

// Apache combined log format
app.use(express.logger({
  format: 'combined',
  stream: require('fs').createWriteStream('access.log', { flags: 'a' })
}))

// Skip health check endpoints
app.use(express.logger({
  format: 'json',
  skip: (req) => req.url === '/health'
}))
```

**Options:**

```typescript
interface LoggerOptions {
  level?: 'debug' | 'info' | 'warn' | 'error'  // default: 'info'
  format?: 'dev' | 'json' | 'combined' | 'short' // default: 'dev'
  stream?: NodeJS.WritableStream                 // default: process.stdout
  skip?: (req, res) => boolean                   // skip certain requests
  requestId?: (req) => string | undefined         // custom ID extractor
  meta?: Record<string, any>                     // additional fields
}
```

**Log entry structure (JSON format):**

```json
{
  "level": "info",
  "method": "GET",
  "url": "/users/42",
  "status": 200,
  "duration": 12,
  "timestamp": "2026-05-12T10:30:00.000Z",
  "requestId": "k3m2f-0001-a1b2",
  "ip": "::1",
  "userAgent": "curl/8.0",
  "contentLength": 256
}
```

### express.requestId()

Generates or propagates request IDs.

```typescript
// Auto-generate request IDs
app.use(express.requestId())

// Use incoming X-Request-Id header, or generate
app.use(express.requestId({
  header: 'X-Request-Id',
  generate: () => crypto.randomUUID()
}))
```

The request ID is available as `req.requestId` and added to log entries.

### Log Formats

| Format | Description | Example |
|---|---|---|
| `dev` | Colorized, concise (default) | `GET /users 200 12ms` |
| `json` | Structured JSON | Full JSON object (see above) |
| `combined` | Apache combined | `::1 - - [10/May/2026:12:00:00] "GET /users HTTP/1.1" 200 12 "-" "curl/8.0"` |
| `short` | Minimal | `GET /users 200 12ms` |

---

## Request API

### req.params

Route parameters from the URL pattern.

```typescript
// Route: /users/:userId/posts/:postId
// URL:   /users/42/posts/99
req.params.userId  // '42'
req.params.postId  // '99'
```

### req.query

Parsed query string. Parser configurable via `app.set('query parser', ...)`.

```typescript
// URL: /search?q=express&page=1
req.query.q     // 'express'
req.query.page  // '1'
```

### req.body

Parsed request body (requires body-parser middleware).

```typescript
app.use(express.json())
app.post('/data', (req, res) => {
  console.log(req.body) // parsed JSON
})
```

### req.path / req.hostname / req.ip / req.protocol

```typescript
// URL: https://api.example.com/users/42?sort=asc
req.path       // '/users/42'
req.hostname   // 'example.com'
req.ip         // '::1' (or proxy-aware with trust proxy)
req.protocol   // 'https'
req.secure     // true
```

When `trust proxy` is enabled, `req.protocol` uses `X-Forwarded-Proto`,
`req.hostname` uses `X-Forwarded-Host`, and `req.ip` uses `X-Forwarded-For`.

### req.get() / req.accepts() / req.is()

```typescript
req.get('Content-Type')       // 'application/json' (case-insensitive)
req.get('Referrer')           // Handles Referer/Referrer aliasing

// Content negotiation
switch (req.accepts('json', 'html', 'text')) {
  case 'json':  return res.json(data)
  case 'html':  return res.render('page')
  default:      return res.send(data)
}

// Content-Type check
if (req.is('application/json')) {
  // handle JSON body
}
```

### req.xhr / req.range()

```typescript
if (req.xhr) {
  res.json({ partial: true })
}

const range = req.range(1000)
if (range?.type === 'bytes') {
  // partial content response
}
```

---

## Response API

### res.status()

```typescript
res.status(404).send('Not Found')
res.status(500).json({ error: 'Error' })
```

### res.send()

Auto-detects Content-Type, calculates Content-Length, generates ETag.

```typescript
res.send('Hello')              // text/html
res.send({ user: 'Alice' })    // application/json
res.send(Buffer.from('x'))     // application/octet-stream
res.send(404)                  // text/plain "Not Found"
```

### res.json() / res.jsonp()

```typescript
res.json({ user: 'Alice' })

// JSONP with ?callback=fn
res.jsonp({ value: 42 })
```

### res.redirect()

```typescript
res.redirect('/new-location')    // 302
res.redirect(301, '/permanent')  // 301
res.redirect('back')             // Referer header
```

### res.cookie() / res.clearCookie()

```typescript
res.cookie('name', 'value', { maxAge: 900000, httpOnly: true })
res.cookie('prefs', { theme: 'dark' })  // JSON cookie
res.clearCookie('name')

// Signed cookies (requires cookie secret setting)
app.set('cookie secret', 'my-secret')
res.cookie('token', 'abc123', { signed: true })
```

### res.set() / res.get() / res.append()

```typescript
res.set('Content-Type', 'text/plain')
res.set({ 'X-Custom': 'value', 'X-API-Version': '2' })
res.get('Content-Type')                         // 'text/plain'
res.append('Link', '<http://example.com>')
res.append('Vary', 'Accept-Encoding')
```

### res.type() / res.format()

```typescript
res.type('json')    // Content-Type: application/json
res.type('html')    // Content-Type: text/html

// Content negotiation
res.format({
  'text/plain': () => res.send('Hello'),
  'text/html': () => res.render('hello'),
  'application/json': () => res.json({ message: 'Hello' }),
  default: () => res.status(406).send('Not Acceptable')
})
```

### res.sendFile() / res.download()

```typescript
res.sendFile('/path/to/file.pdf', (err) => {
  if (err) console.error(err)
})

res.download('/path/to/report.pdf', 'report.pdf')
```

### res.render()

```typescript
res.render('index', { title: 'Express' })
res.render('email', { name: 'User' }, (err, html) => {
  // raw HTML without sending
})
```

---

## Error Handling

### Error Middleware

Define error handlers with four arguments:

```typescript
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal Server Error' })
})
```

Typed error handling with `HttpError` subclasses:

```typescript
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
      ...(err instanceof ValidationError ? { issues: err.issues } : {})
    })
  }
  console.error('Unhandled:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})
```

### Async Errors

Async handler rejections are automatically caught:

```typescript
app.get('/data', async (req, res) => {
  const data = await db.query()   // rejection → error middleware
  res.json(data)
})

app.get('/throw', async (req, res) => {
  throw new NotFoundError('Resource')  // caught by error middleware
})
```

---

## Static Files

```typescript
app.use(express.static('public'))
app.use('/assets', express.static('assets', {
  maxAge: '1d',
  dotfiles: 'allow'
}))
```

## Body Parsing

```typescript
app.use(express.json())                       // JSON bodies
app.use(express.json({ limit: '10mb' }))      // with size limit
app.use(express.urlencoded({ extended: true })) // URL-encoded
app.use(express.raw())                        // Binary bodies
app.use(express.text())                       // Text bodies
```

## Router

```typescript
const router = express.Router()

router.use(authenticate)
router.get('/users', (req, res) => res.json(users))
router.post('/users', (req, res) => res.status(201).json(req.body))

app.use('/api', router)
```

---

## Async Examples

### Async Database CRUD

```typescript
import express from 'express'

interface User {
  id: number
  name: string
  email: string
}

const app = express()
app.use(express.json())

const db = {
  async findUsers(): Promise<User[]> { /* ... */ },
  async findUser(id: number): Promise<User | null> { /* ... */ },
  async createUser(data: Partial<User>): Promise<User> { /* ... */ }
}

app.get('/users', async (req, res) => {
  const users = await db.findUsers()
  res.ok(users)
})

app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(Number(req.params.id))
  if (!user) throw new NotFoundError('User', req.params.id)
  res.ok(user)
})

app.post('/users', async (req, res) => {
  const user = await db.createUser(req.body)
  res.created(user)
})

app.listen(3000)
```

### Async Error Handling Patterns

```typescript
import express from 'express'
const app = express()

// Pattern 1: try/catch per handler
app.get('/safe/:id', async (req, res) => {
  try {
    const data = await riskyOp(req.params.id)
    res.ok(data)
  } catch (err: any) {
    res.badRequest(err.message)
  }
})

// Pattern 2: async wrapper helper
function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) =>
    fn(req, res, next).catch(next)
}

app.get('/wrapped/:id', asyncHandler(async (req, res) => {
  const data = await riskyOp(req.params.id)
  res.ok(data)
}))

// Pattern 3: global error handler catches async rejections
app.use((err: Error, req: any, res: any, next: any) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode
    })
  }
  console.error(err)
  res.status(500).json({ error: 'Internal Server Error' })
})

async function riskyOp(id: string) {
  const num = Number(id)
  if (isNaN(num)) throw new BadRequestError('Invalid ID')
  return { id: num, status: 'ok' }
}

app.listen(3000)
```

### Async Middleware with External APIs

```typescript
import express from 'express'
const app = express()

// Async middleware: enrich request with geo data
async function geoMiddleware(req: any, res: any, next: any) {
  try {
    const response = await fetch(`https://freegeoip.app/json/${req.ip}`)
    const geo = await response.json()
    req.geo = geo
  } catch {
    req.geo = { country: 'Unknown', city: 'Unknown' }
  }
  next()
}

// Async middleware: log with external service
async function logMiddleware(req: any, res: any, next: any) {
  const start = Date.now()
  const origEnd = res.end.bind(res)

  res.end = function (...args: any[]) {
    fetch('https://logging.example.com/log', {
      method: 'POST',
      body: JSON.stringify({
        method: req.method,
        url: req.url,
        duration: Date.now() - start
      })
    }).catch(() => {})  // fire and forget

    origEnd(...args)
  }

  next()
}

app.use(geoMiddleware, logMiddleware)

app.get('/hello', (req, res) => {
  res.ok({ geo: (req as any).geo })
})

app.listen(3000)
```

### Async Request Validation

```typescript
import express from 'express'
import * as v from 'valibot'

const app = express()
app.use(express.json())

// Async validator: check email domain exists
async function validateEmailDomain(email: string): Promise<string | null> {
  const domain = email.split('@')[1]
  try {
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`)
    const data = await response.json()
    if (!data.Answer || data.Answer.length === 0) {
      return `Domain ${domain} does not accept email`
    }
  } catch {
    return 'Could not validate email domain'
  }
  return null
}

const RegisterSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  name: v.pipe(v.string(), v.minLength(2)),
  age: v.pipe(v.number(), v.minValue(18))
})

app.post('/register',
  express.json(),
  async (req, res, next) => {
    // Async validation after schema check
    const domainError = await validateEmailDomain(req.body.email)
    if (domainError) return res.badRequest([{ field: 'email', message: domainError }])
    next()
  },
  async (req, res) => {
    const user = await db.createUser(req.body)
    res.created(user)
  }
)

app.listen(3000)
```

### Concurrent Operations

```typescript
import express from 'express'
const app = express()
app.use(express.json())

// Concurrent reads with Promise.all
app.get('/dashboard', async (req, res) => {
  const [users, posts, analytics] = await Promise.all([
    db.findUsers(),
    db.findPosts(),
    db.getAnalytics()
  ])

  res.ok({ users, posts, analytics })
})

// Concurrent writes with Promise.allSettled
app.post('/batch/users', async (req, res) => {
  const results = await Promise.allSettled(
    req.body.users.map((u: any) => db.createUser(u))
  )

  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected')

  // Fire-and-forget analytics
  trackEvent('batch_create', { succeeded, failed }).catch(() => {})

  res.ok({ succeeded, failed: failed.length })
})

// Cache-aside pattern
app.get('/users/:id', async (req, res) => {
  const cached = await cache.get(`user:${req.params.id}`)
  if (cached) return res.ok(cached)

  const user = await db.findUser(Number(req.params.id))
  if (!user) throw new NotFoundError('User')

  cache.set(`user:${req.params.id}`, user, 300).catch(() => {})
  res.ok(user)
})

app.listen(3000)
```

### Stream Processing

```typescript
import express from 'express'
import { Readable } from 'node:stream'

const app = express()

// Async generator → HTTP stream
app.get('/stream/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  async function* generateEvents() {
    for (let i = 1; i <= 10; i++) {
      await new Promise(r => setTimeout(r, 1000))
      yield `data: ${JSON.stringify({ id: i, time: Date.now() })}\n\n`
    }
    yield 'data: [DONE]\n\n'
  }

  const stream = Readable.from(generateEvents())
  stream.pipe(res)
})

// Webhook delivery with retries
async function deliverWebhook(url: string, payload: any, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      })
      if (res.ok) return true
    } catch {
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
  return false
}

app.post('/webhooks/trigger', async (req, res) => {
  const { event, data, subscribers } = req.body

  const results = await Promise.allSettled(
    subscribers.map((url: string) => deliverWebhook(url, { event, data }))
  )

  res.ok({
    event,
    delivered: results.filter(r => r.status === 'fulfilled' && r.value).length,
    failed: results.filter(r => r.status === 'rejected' || !r.value).length
  })
})

app.listen(3000)
```

---

## TypeScript Usage

The entire framework is written in TypeScript and ships with complete type definitions.

```typescript
import express, { Request, Response, Application, Handler } from 'express'

const app: Application = express()

// Typed handlers
app.get('/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello World' })
})

// Typed router
const router = express.Router()

interface User {
  id: number
  name: string
}

router.get('/users', (req: Request, res: Response) => {
  const users: User[] = [{ id: 1, name: 'Alice' }]
  res.json(users)
})
```

### Exported Types

| Type | Description |
|---|---|
| `Request` | Extended `http.IncomingMessage` |
| `Response` | Extended `http.ServerResponse` |
| `Application` | App interface with all settings methods |
| `Router` | Router interface |
| `Route` | Route interface |
| `Handler` | `(req, res, next) => any` |
| `ErrorHandler` | `(err, req, res, next) => any` |
| `NextFunction` | `(err?: any) => void` |
| `ParamHandler` | `(req, res, next, value, name) => any` |
| `HttpError` | Base error class |
| `NotFoundError` | 404 error |
| `BadRequestError` | 400 error |
| `ValidationError` | 400 error with issues |
| `UnauthorizedError` | 401 error |
| `ForbiddenError` | 403 error |
| `ConflictError` | 409 error |
| `TooManyRequestsError` | 429 error |
| `RouteDescription` | OpenAPI metadata type |
| `ValidationSchemas` | Standard Schema target type |
| `StandardSchemaV1` | Standard Schema v1 interface |

---

## Migration from Express 5.x

### Breaking Changes

- **No external `router` package** — Router is built-in. Use `express.Router` instead of `require('router')`
- **No `path-to-regexp`** — The radix trie handles path matching. RegExp routes (`/\/user\/(\d+)/`) are not supported
- **Async dispatch** — The sync counter (100-call protection) is removed. Async dispatch prevents stack overflows naturally
- **Timing changes** — Tests relying on `setImmediate` ordering after middleware may need adjustment

### New Features (backward-compatible)

- `app.route(path)` returns a `RouteBuilder` with `.describe()`, `.validate()`, `.middleware()` chaining
- `res.ok()`, `res.created()`, `res.notFound()` — semantic helpers
- `HttpError`, `NotFoundError`, `BadRequestError` — typed errors
- `validate({ body, query, params })` — Standard Schema validation
- OpenAPI 3.1 auto-generation via `app.set('openapi', { info })`
- Swagger UI at `/docs`
- `express.logger()` — structured request logging
- `express.requestId()` — request ID middleware

### Preserved Behavior

- All `req.*` and `res.*` methods work identically
- `next('route')` and `next('router')` sentinels preserved
- `app.param()` and `router.param()` work as before
- Sub-app mounting with `app.use('/path', subApp)` works identically
- Settings system (`app.set`, `app.get`, `app.enable`, `app.disable`) unchanged
- View engine integration and `res.render` / `app.render` unchanged
- All middleware (body-parser, serve-static) works identically

## Running Tests

```bash
npm install
npm run build    # Compile TypeScript to dist/
npm test         # Run test suite (Mocha + Supertest)
```

```bash
# Run specific test suites
npx mocha test/trie.js       # Radix trie unit tests
npx mocha test/app.basic.js  # Application integration
npx mocha test/errors.js     # HTTP error classes
npx mocha test/res.helpers.js # Response helpers
npx mocha test/validate.js   # Validation middleware
npx mocha test/builder.js    # Fluent RouteBuilder
npx mocha test/openapi.js    # OpenAPI generation
```

## License

[MIT](LICENSE)
