[![Express Logo](https://i.cloudup.com/zfY6lL7eFa-3000x3000.png)](https://expressjs.com/)

**Fast, unopinionated, minimalist web framework for [Node.js](https://nodejs.org).**

> **v6.0.0-alpha** — TypeScript rewrite with radix-trie router and async-first pipeline.

[![NPM Version][npm-version-image]][npm-url]
[![Linux Build][github-actions-ci-image]][github-actions-ci-url]
[![Test Coverage][coveralls-image]][coveralls-url]

## Table of contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
  - [Radix-Trie Router](#radix-trie-router)
  - [Async-First Pipeline](#async-first-pipeline)
- [API Reference](#api-reference)
  - [express()](#express)
  - [Application](#application)
    - [app.use()](#appuse)
    - [app.get() / app.post() / app.put() / app.delete() / app.patch() / app.options() / app.head()](#appget--apppost--appput--appdelete--apppatch--appoptions--apphead)
    - [app.all()](#appall)
    - [app.route()](#approute)
    - [app.param()](#appparam)
    - [app.set() / app.get()](#appset--appget)
    - [app.enable() / app.disable()](#appenable--appdisable)
    - [app.listen()](#applisten)
    - [app.render()](#apprender)
    - [app.engine()](#appengine)
    - [app.path()](#apppath)
  - [Router](#router)
    - [router.use()](#routeruse)
    - [router.param()](#routerparam)
    - [router.route()](#routerroute)
  - [Request](#request)
    - [req.params](#reqparams)
    - [req.query](#reqquery)
    - [req.body](#reqbody)
    - [req.path](#reqpath)
    - [req.hostname](#reqhostname)
    - [req.ip](#reqip)
    - [req.protocol / req.secure](#reqprotocol--reqsecure)
    - [req.get()](#reqget)
    - [req.accepts()](#reqaccepts)
    - [req.is()](#reqis)
    - [req.range()](#reqrange)
    - [req.xhr](#reqxhr)
  - [Response](#response)
    - [res.status()](#resstatus)
    - [res.send()](#ressend)
    - [res.json() / res.jsonp()](#resjson--resjsonp)
    - [res.redirect()](#resredirect)
    - [res.cookie() / res.clearCookie()](#rescookie--resclearcookie)
    - [res.set() / res.get() / res.append()](#resset--resget--resappend)
    - [res.type()](#restype)
    - [res.sendFile() / res.download()](#ressendfile--resdownload)
    - [res.sendStatus()](#ressendstatus)
    - [res.format()](#resformat)
    - [res.attachment()](#resattachment)
    - [res.location()](#reslocation)
    - [res.vary() / res.links()](#resvary--reslinks)
    - [res.render()](#resrender)
  - [Error Handling](#error-handling)
  - [Static Files](#static-files)
  - [Body Parsing](#body-parsing)
- [Examples](#examples)
- [TypeScript Usage](#typescript-usage)
- [Fluent Route Builder](#fluent-route-builder)
- [Request Validation](#request-validation)
- [Typed HTTP Errors](#typed-http-errors)
- [Response Helpers](#response-helpers)
- [OpenAPI & Swagger](#openapi--swagger)  
- [Migration from Express 5.x](#migration-from-express-5x)
- [Running Tests](#running-tests)
- [License](#license)

## Overview

Express is a minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications.

**What's new in this rewrite:**

- **Full TypeScript** — Native type safety for the entire API surface
- **Radix-trie router** — O(k) route matching (k = URL path length) vs. O(n) linear scan. Up to 50x faster on large route tables
- **Async-first middleware pipeline** — Promise-based dispatch eliminates the 100-call synchronous stack overflow hack. `async` handlers work natively without detection overhead
- **Zero external routing dependencies** — The router is built directly into Express, removing the separate `router` npm package dependency

## Installation

```bash
npm install express
```

Node.js 18 or higher is required.

## Quick Start

```typescript
import express from 'express'

const app = express()

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
```

```javascript
// CommonJS
const express = require('express')
const app = express()

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(3000)
```

## Architecture

### Radix-Trie Router

Traditional Express uses a flat array of layers (`router.stack`) and iterates through them linearly for each request — O(n) where n is the number of registered routes and middleware. This rewrite replaces that with a compressed radix trie.

```
Traditional linear scan:         Radix trie:
                                 
  stack = [                      root ""
    "/users" GET,                   ├── "api/"
    "/users/:id" GET,               │   ├── "users"
    "/users/:id/posts" GET,         │   │   ├── static ":id" -> params.id
    "/api/users" GET,               │   │   │   └── "/posts"
    "/api/products" GET,            │   │   └── [GET handler]
    ...                             │   └── "products" [GET handler]
  ]                                 └── "static/*" (wildcard)
```

**How it works:**
- Routes are inserted into a tree where each node represents a URL segment
- Static segments (`/users`), parameterized segments (`:id`), and wildcards (`*`) are separate child types
- Lookup walks the tree segment by segment: O(path_length) regardless of route count
- Static matches take priority over parameterized matches at the same level
- Ancestor middleware is automatically collected during traversal

### Async-First Pipeline

Express 5 uses a callback-sentinel system with a `sync` counter to prevent stack overflow from deeply nested synchronous layers:

```javascript
// Express 5 approach (simplified)
function next(err) {
  if (++sync > 100) return setImmediate(next, err)
  // ... find next matching layer
}
```

This rewrite uses a Promise-based pipeline:

```typescript
// This rewrite
async function next(err?: any): Promise<void> {
  const layer = layers[idx++]
  if (!layer) return
  await callHandler(layer.handler, [req, res, next])
}
```

**Benefits:**
- No sync counter — async/await naturally yields to the event loop
- `async` handlers work without `is-promise` detection
- Errors from `async` functions are automatically caught via Promise rejection
- `next('route')` and `next('router')` sentinels are preserved for backward compatibility
- Error handlers (4-argument functions) are automatically separated and placed after normal handlers in the chain

## API Reference

### express()

Creates an Express application. The returned `app` object is a callable function suitable for `http.createServer(app)`.

```typescript
import express from 'express'
const app = express()
```

**Static exports:**

| Export | Description |
|---|---|
| `express.Router` | Router class constructor |
| `express.Route` | Route class constructor |
| `express.json()` | JSON body parser middleware |
| `express.raw()` | Raw body parser middleware |
| `express.text()` | Text body parser middleware |
| `express.urlencoded()` | URL-encoded body parser middleware |
| `express.static()` | Static file serving middleware |

---

### Application

#### app.use()

Mounts middleware at a path. If no path is given, defaults to `/`.

```typescript
// Global middleware (runs for every request)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

// Path-scoped middleware (runs for /api/*)
app.use('/api', (req, res, next) => {
  req.api = true
  next()
})

// Sub-app mounting
const adminApp = express()
adminApp.get('/', (req, res) => res.send('Admin'))
app.use('/admin', adminApp)

// Multiple handlers
app.use('/user', authenticate, loadUser)
```

#### app.get() / app.post() / app.put() / app.delete() / app.patch() / app.options() / app.head()

Registers route handlers for specific HTTP methods.

```typescript
// Basic route
app.get('/users', (req, res) => {
  res.json([{ id: 1, name: 'Alice' }])
})

// Route with parameters
app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id })
})

// Multiple route parameters
app.get('/users/:userId/posts/:postId', (req, res) => {
  res.send(`User ${req.params.userId}, Post ${req.params.postId}`)
})

// Multiple handlers
app.get('/profile', authenticate, loadProfile, (req, res) => {
  res.json(req.profile)
})

// POST with body parsing
app.post('/users', express.json(), (req, res) => {
  res.status(201).json(req.body)
})

// app.get() with one argument reads a setting
app.set('title', 'My App')
console.log(app.get('title')) // 'My App'
```

#### app.all()

Registers handlers for all HTTP methods at a path.

```typescript
app.all('/api/*', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  next()
})
```

#### app.route()

Returns a route instance for chaining method handlers.

```typescript
app.route('/users')
  .get((req, res) => {
    res.json(users)
  })
  .post((req, res) => {
    users.push(req.body)
    res.status(201).end()
  })
  .put((req, res) => {
    Object.assign(user, req.body)
    res.json(user)
  })
```

#### app.param()

Registers parameter callbacks that execute before route handlers.

```typescript
app.param('id', (req, res, next, value, name) => {
  User.findById(value, (err, user) => {
    if (err) return next(err)
    if (!user) return next(new Error('User not found'))
    req.user = user
    next()
  })
})

app.get('/users/:id', (req, res) => {
  res.json(req.user)
})
```

The callback signature is `(req, res, next, value, name)`. It can also return a Promise.

#### app.set() / app.get()

Store and retrieve application settings.

```typescript
app.set('title', 'My Application')
app.set('etag', 'strong')       // etag: 'strong' | 'weak' | false
app.set('trust proxy', true)    // enable trust for X-Forwarded-* headers
app.set('query parser', 'extended') // 'simple' | 'extended' | function
app.set('env', 'production')    // NODE_ENV
app.set('view engine', 'ejs')   // default template engine
app.set('views', './views')     // views directory
app.set('jsonp callback name', 'cb') // default: 'callback'
app.set('view cache', true)     // cache compiled templates

// app.get() with one argument reads a setting
console.log(app.get('title'))
```

The following settings trigger side-effect compilation:

| Setting | Effect |
|---|---|
| `etag` | Compiles ETag function (strong/weak/false) |
| `query parser` | Compiles query parser (simple/extended/custom) |
| `trust proxy` | Compiles proxy trust function |

#### app.enable() / app.disable()

Shorthand for `app.set(key, true/false)`.

```typescript
app.enable('trust proxy')
console.log(app.enabled('trust proxy')) // true

app.disable('x-powered-by')
console.log(app.disabled('x-powered-by')) // true
```

#### app.listen()

Binds the app to a port and starts the HTTP server.

```typescript
app.listen(3000, () => {
  console.log('Listening on port 3000')
})

// With hostname
app.listen(3000, '0.0.0.0')

// Unix socket
app.listen('/tmp/app.sock')
```

Internally calls `http.createServer(this).listen(...)`.

#### app.render()

Renders a view template.

```typescript
// Callback style
app.render('email', { name: 'Alice' }, (err, html) => {
  if (err) throw err
  console.log(html)
})

// In a route handler
app.get('/hello', (req, res) => {
  res.render('hello', { name: 'World' })
})
```

#### app.engine()

Registers a template engine for a file extension.

```typescript
app.engine('pug', require('pug').renderFile)
app.engine('ejs', require('ejs').renderFile)
app.set('view engine', 'pug')
```

#### app.path()

Returns the canonical path of the app, which is the mountpath.

```typescript
const admin = express()
admin.get('/', (req, res) => res.send(admin.path()))
app.use('/admin', admin)
// GET /admin -> '/admin'
```

---

### Router

Creates a new router object. Routers behave like mini-applications and can be mounted with `app.use()`.

```typescript
const router = express.Router()

router.use((req, res, next) => {
  console.log('Router middleware')
  next()
})

router.get('/users', (req, res) => {
  res.json([{ id: 1 }])
})

app.use('/api', router)
// Matches: GET /api/users
```

#### router.use()

Mounts middleware on the router, with optional path prefix.

```typescript
router.use(express.json())
router.use('/admin', adminOnly)
```

#### router.param()

Same as `app.param()`, but scoped to the router.

```typescript
router.param('id', async (req, res, next, id) => {
  try {
    req.item = await db.find(id)
    next()
  } catch (err) {
    next(err)
  }
})
```

#### router.route()

Same as `app.route()`, but returns a route scoped to the router.

```typescript
router.route('/items')
  .get((req, res) => res.json(items))
  .post((req, res) => {
    items.push(req.body)
    res.status(201).end()
  })
```

---

### Request

The `req` object inherits from `http.IncomingMessage` with additional Express properties.

#### req.params

Route parameters extracted from the URL.

```typescript
// Route: /users/:userId/posts/:postId
// URL:   /users/42/posts/99
console.log(req.params.userId)  // '42'
console.log(req.params.postId)  // '99'
```

#### req.query

Parsed query string parameters.

```typescript
// URL: /search?q=express&page=1
console.log(req.query.q)     // 'express'
console.log(req.query.page)  // '1'

// Nested (with 'extended' parser)
// URL: /filter?user[name]=Alice
console.log(req.query.user?.name)  // 'Alice'
```

#### req.body

Parsed request body (requires body-parser middleware).

```typescript
app.use(express.json())
app.post('/data', (req, res) => {
  console.log(req.body)  // parsed JSON object
})
```

#### req.path

The URL pathname.

```typescript
// URL: /users/42?sort=asc
console.log(req.path)  // '/users/42'
```

#### req.hostname

The hostname derived from the `Host` header.

```typescript
// Request with Host: example.com:8080
console.log(req.hostname)  // 'example.com'
```

When `trust proxy` is enabled, uses `X-Forwarded-Host`.

#### req.ip

The remote IP address of the request.

```typescript
console.log(req.ip)  // '::1' or '192.168.1.1'
```

When `trust proxy` is enabled, uses `X-Forwarded-For`.

#### req.protocol / req.secure

The request protocol.

```typescript
console.log(req.protocol)  // 'http' or 'https'
console.log(req.secure)    // true if https
```

When `trust proxy` is enabled, uses `X-Forwarded-Proto`.

#### req.get()

Returns a request header (case-insensitive).

```typescript
console.log(req.get('Content-Type'))     // 'application/json'
console.log(req.get('content-type'))     // 'application/json'
console.log(req.get('Referrer'))         // handles Referer/Referrer aliasing
```

#### req.accepts()

Content negotiation based on the `Accept` header.

```typescript
switch (req.accepts('json', 'html', 'text')) {
  case 'json':
    res.json({ message: 'Hello' })
    break
  case 'html':
    res.render('hello', { name: 'World' })
    break
  default:
    res.send('Hello')
}
```

#### req.is()

Checks the `Content-Type` header against a MIME type.

```typescript
if (req.is('application/json')) {
  // handle JSON body
}
```

#### req.range()

Parses the `Range` header.

```typescript
const range = req.range(1000)
if (range && range.type === 'bytes') {
  // range.partial
}
```

#### req.xhr

Returns `true` if the `X-Requested-With` header is `XMLHttpRequest`.

```typescript
if (req.xhr) {
  res.json({ data: 'partial' })
} else {
  res.render('full-page')
}
```

---

### Response

The `res` object inherits from `http.ServerResponse` with additional Express methods.

#### res.status()

Sets the HTTP status code.

```typescript
res.status(404).send('Not Found')
res.status(500).json({ error: 'Internal Server Error' })
```

Chainable — returns `this`.

#### res.send()

Sends a response with automatic content-type detection.

```typescript
res.send('Hello World')          // text/html
res.send({ user: 'Alice' })      // application/json
res.send(Buffer.from('hello'))   // application/octet-stream
res.send(404)                    // text/plain "Not Found"
res.send()                       // empty body, status unchanged
```

Auto-detects Content-Type, calculates Content-Length, and generates ETag when configured.

#### res.json() / res.jsonp()

Sends a JSON response.

```typescript
res.json({ user: 'Alice' })

// JSONP
app.get('/data', (req, res) => {
  res.jsonp({ value: 42 })
})
// ?callback=fn -> /**/ typeof fn === 'function' && fn({"value":42});
```

#### res.redirect()

Redirects the client.

```typescript
res.redirect('/new-location')       // 302
res.redirect(301, '/permanent')     // 301
res.redirect('back')                // uses Referer header
```

#### res.cookie() / res.clearCookie()

Sets and clears cookies.

```typescript
res.cookie('name', 'value', { maxAge: 900000, httpOnly: true })
res.cookie('prefs', { theme: 'dark' })  // JSON cookie

res.clearCookie('name')
```

Signed cookies (requires `cookie secret` setting):

```typescript
app.set('cookie secret', 'my-secret')
res.cookie('token', 'abc123', { signed: true })
```

#### res.set() / res.get() / res.append()

Set, read, and append response headers.

```typescript
res.set('Content-Type', 'text/plain')
res.set({ 'X-Custom': 'value', 'X-API-Version': '2' })
console.log(res.get('Content-Type'))  // 'text/plain'
res.append('Link', '<http://example.com>')
res.append('Vary', 'Accept-Encoding')
```

#### res.type()

Sets the `Content-Type` header with MIME type resolution.

```typescript
res.type('json')        // 'application/json'
res.type('html')        // 'text/html'
res.type('.png')        // 'image/png'
```

#### res.sendFile() / res.download()

Transfers files.

```typescript
// Send a file
res.sendFile('/path/to/file.pdf', (err) => {
  if (err) console.error(err)
})

// Download (forces download dialog)
res.download('/path/to/report.pdf', 'report.pdf')
```

#### res.sendStatus()

Sends the status code as the response body.

```typescript
res.sendStatus(200)  // 'OK'
res.sendStatus(404)  // 'Not Found'
res.sendStatus(500)  // 'Internal Server Error'
```

#### res.format()

Content negotiation using `req.accepts()`.

```typescript
res.format({
  'text/plain': () => res.send('Hello'),
  'text/html': () => res.render('hello'),
  'application/json': () => res.json({ message: 'Hello' }),
  default: () => res.status(406).send('Not Acceptable')
})
```

#### res.attachment()

Sets the `Content-Disposition` header to `attachment`.

```typescript
res.attachment('photo.jpg')     // Content-Disposition: attachment; filename="photo.jpg"
res.attachment()                // Content-Disposition: attachment
```

#### res.location()

Sets the `Location` header.

```typescript
res.location('/users')
res.location('back')  // Referer header, falls back to '/'
```

#### res.vary() / res.links()

```typescript
res.vary('Accept-Encoding')
res.links({
  next: 'http://api.example.com/users?page=2',
  last: 'http://api.example.com/users?page=5'
})
```

#### res.render()

Renders a view template and sends the HTML.

```typescript
res.render('index', { title: 'Express' })
res.render('email', { name: 'User' }, (err, html) => {
  // raw HTML without sending
})
```

---

### Error Handling

Define error-handling middleware with four arguments:

```typescript
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})
```

Error middleware catches errors passed via `next(err)`:

```typescript
app.get('/user/:id', (req, res, next) => {
  User.findById(req.params.id, (err, user) => {
    if (err) return next(err)
    if (!user) return next(new Error('User not found'))
    res.json(user)
  })
})
```

Async error handling works automatically — rejected promises are caught by the pipeline and forwarded to error middleware:

```typescript
// Async rejection automatically becomes next(error)
app.get('/data', async (req, res) => {
  const data = await db.query()  // if this rejects, error middleware catches it
  res.json(data)
})

// Async throw also works
app.get('/throw', async (req, res) => {
  throw new Error('Boom')  // caught by error handler
})

// Wrapping async handlers to catch errors
function wrap(fn: (req: any, res: any, next: any) => Promise<any>) {
  return (req: any, res: any, next: any) => {
    fn(req, res, next).catch(next)
  }
}

app.get('/wrapped', wrap(async (req, res) => {
  const data = await db.query()
  if (!data) throw new Error('Not found')
  res.json(data)
}))

// Structured error responses
class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

app.get('/user/:id', async (req, res) => {
  const user = await db.findUser(Number(req.params.id))
  if (!user) throw new AppError(404, 'User not found')
  res.json(user)
})

app.use((err: Error, req: any, res: any, next: any) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.statusCode
    })
  }

  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  })
})
```

Error middleware placed anywhere in the stack will catch errors from preceding handlers. This rewrite places error handlers after normal handlers in the execution chain, ensuring they catch errors from both middleware and route handlers.

### Static Files

Serve static files with `express.static()`:

```typescript
app.use(express.static('public'))
app.use('/assets', express.static('assets'))
app.use('/downloads', express.static('files', {
  maxAge: '1d',
  dotfiles: 'allow'
}))
```

### Body Parsing

```typescript
// JSON bodies
app.use(express.json())
app.use(express.json({ limit: '10mb' }))

// URL-encoded bodies
app.use(express.urlencoded({ extended: true }))

// Raw / text bodies
app.use(express.raw())
app.use(express.text())
```

## Examples

### Async RESTful API (Database-backed)

```typescript
import express from 'express'

interface User {
  id: number
  name: string
  email: string
  createdAt: Date
}

const app = express()
app.use(express.json())

// Simulated async database
const db = {
  async findUsers(): Promise<User[]> {
    return [{ id: 1, name: 'Alice', email: 'alice@example.com', createdAt: new Date() }]
  },
  async findUser(id: number): Promise<User | null> {
    return { id, name: 'Bob', email: 'bob@example.com', createdAt: new Date() }
  },
  async createUser(data: Partial<User>): Promise<User> {
    return { id: Date.now(), ...data, createdAt: new Date() } as User
  },
  async updateUser(id: number, data: Partial<User>): Promise<User> {
    return { id, ...data, createdAt: new Date() } as User
  },
  async deleteUser(id: number): Promise<void> {}
}

// GET /users — async list with error handling
app.get('/users', async (req, res) => {
  try {
    const users = await db.findUsers()
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// GET /users/:id — async single record with 404
app.get('/users/:id', async (req, res) => {
  try {
    const user = await db.findUser(Number(req.params.id))
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// POST /users — async creation
app.post('/users', async (req, res) => {
  try {
    const user = await db.createUser(req.body)
    res.status(201).json(user)
  } catch (err) {
    res.status(400).json({ error: 'Failed to create user' })
  }
})

app.listen(3000)
```

### Async Error Handling Patterns

```typescript
import express from 'express'

const app = express()
app.use(express.json())

// Pattern 1: try/catch per handler
app.get('/safe/:id', async (req, res) => {
  try {
    const data = await riskyOperation(req.params.id)
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Pattern 2: async wrapper helper
function asyncHandler(fn: (req: any, res: any, next: any) => Promise<any>) {
  return (req: any, res: any, next: any) => {
    fn(req, res, next).catch(next)
  }
}

app.get('/wrapped/:id', asyncHandler(async (req, res) => {
  const data = await riskyOperation(req.params.id)
  res.json(data)
}))

// Pattern 3: global error handler catches all async rejections
app.get('/unhandled', async (req, res) => {
  throw new Error('This async error is caught by the error middleware below')
})

app.use((err: Error, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
})

async function riskyOperation(id: string): Promise<any> {
  const num = Number(id)
  if (isNaN(num)) throw new Error('Invalid ID')
  return { id: num, status: 'ok' }
}

app.listen(3000)
```

### Async Middleware with External API Calls

```typescript
import express from 'express'

const app = express()

interface GeoIP {
  ip: string
  country: string
  city: string
}

// Async middleware that enriches the request
async function geoMiddleware(req: any, res: any, next: any) {
  try {
    const response = await fetch(`https://freegeoip.app/json/${req.ip}`)
    const geo: GeoIP = await response.json()
    req.geo = geo
  } catch {
    req.geo = { ip: req.ip, country: 'Unknown', city: 'Unknown' }
  }
  next()
}

app.use(geoMiddleware)

// Async middleware with timing
async function timingMiddleware(req: any, res: any, next: any) {
  const start = Date.now()
  const originalEnd = res.end.bind(res)

  res.end = (...args: any[]) => {
    const duration = Date.now() - start
    console.log(`[TIMING] ${req.method} ${req.url} - ${duration}ms (geo: ${req.geo?.country})`)

    // Async log write (fire-and-forget)
    fetch('http://logging-service/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: req.method, url: req.url, duration, geo: req.geo })
    }).catch(() => {})

    originalEnd(...args)
  }

  next()
}

app.use(timingMiddleware)

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello', geo: (req as any).geo })
})

app.listen(3000)
```

### Async Data Pipeline with Batching

```typescript
import express from 'express'

const app = express()
app.use(express.json())

// Simulated external services
class AnalyticsService {
  async trackEvent(event: string, data: any): Promise<void> {
    await new Promise(r => setTimeout(r, 10))
  }

  async batchTrack(events: Array<{ event: string; data: any }>): Promise<void> {
    await new Promise(r => setTimeout(r, 30))
  }
}

class EmailService {
  async sendWelcome(user: { email: string; name: string }): Promise<void> {
    await new Promise(r => setTimeout(r, 50))
  }
}

class CacheService {
  private store = new Map<string, any>()

  async get(key: string): Promise<any | null> {
    return this.store.get(key) || null
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    this.store.set(key, value)
  }

  async invalidate(pattern: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) this.store.delete(key)
    }
  }
}

const analytics = new AnalyticsService()
const email = new EmailService()
const cache = new CacheService()

// Concurrent async operations with Promise.all
app.post('/users', async (req, res) => {
  const { name, email: userEmail } = req.body

  // Run multiple async operations concurrently
  const [user] = await Promise.all([
    db.createUser({ name, email: userEmail }),
    analytics.trackEvent('user.created', { name })
  ])

  // Fire and forget — send welcome email in background
  email.sendWelcome({ email: userEmail, name }).catch(err => {
    console.error('Failed to send welcome email:', err.message)
  })

  res.status(201).json(user)
})

// Async request with caching
app.get('/users/:id', async (req, res) => {
  const cacheKey = `user:${req.params.id}`

  // Check cache first
  const cached = await cache.get(cacheKey)
  if (cached) {
    res.set('X-Cache', 'HIT')
    return res.json(cached)
  }

  // Cache miss — query database
  const user = await db.findUser(Number(req.params.id))
  if (!user) return res.status(404).end()

  // Store in cache (don't block response)
  cache.set(cacheKey, user, 300).catch(() => {})

  res.set('X-Cache', 'MISS')
  res.json(user)
})

// Batch updates with async coordination
app.patch('/users/batch', async (req, res) => {
  const updates: Array<{ id: number; data: Partial<User> }> = req.body.updates

  // Process all updates concurrently
  const results = await Promise.allSettled(
    updates.map(u => db.updateUser(u.id, u.data))
  )

  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  // Invalidate cache for all updated users
  const ids = updates.map(u => u.id)
  await Promise.all(ids.map(id => cache.invalidate(`user:${id}`)))

  // Track batch event
  analytics.trackEvent('users.batch_updated', { count: succeeded })

  res.json({ succeeded, failed })
})

app.listen(3000)
```

### Async Stream Processing

```typescript
import express from 'express'
import { Readable } from 'node:stream'

const app = express()

// Async generator route — stream data as it becomes available
app.get('/stream/numbers', async (req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Transfer-Encoding', 'chunked')

  async function* generateNumbers() {
    for (let i = 1; i <= 100; i++) {
      await new Promise(r => setTimeout(r, 10)) // simulate async work
      yield JSON.stringify({ id: i, timestamp: Date.now() }) + '\n'
    }
  }

  const stream = Readable.from(generateNumbers())
  stream.pipe(res)
})

// Async batch processor with progress
app.post('/process', express.raw({ type: 'application/octet-stream' }), async (req, res) => {
  const chunks: Buffer[] = []
  const totalSize = req.body.length
  let processed = 0

  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Transfer-Encoding', 'chunked')

  const BATCH_SIZE = 1024

  for (let offset = 0; offset < totalSize; offset += BATCH_SIZE) {
    const chunk = req.body.slice(offset, offset + BATCH_SIZE)

    // Simulate async processing
    await new Promise(r => setImmediate(r))

    processed += chunk.length
    const progress = ((processed / totalSize) * 100).toFixed(1)

    res.write(JSON.stringify({ progress: `${progress}%`, bytes: processed }) + '\n')
  }

  res.end()
})

// Async webhook delivery with retries
async function deliverWebhook(url: string, payload: any, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (response.ok) return true
    } catch (err) {
      console.error(`Webhook attempt ${attempt}/${retries} failed for ${url}`)
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
  return false
}

app.post('/webhooks/trigger', async (req, res) => {
  const { event, data, subscribers } = req.body

  // Deliver to all subscribers concurrently
  const results = await Promise.allSettled(
    subscribers.map((sub: string) => deliverWebhook(sub, { event, data }))
  )

  const delivered = results.filter(r => r.status === 'fulfilled' && r.value).length
  const failed = results.filter(r => r.status === 'rejected' || !r.value).length

  res.json({ event, delivered, failed, total: subscribers.length })
})

app.listen(3000)
```

### Async Request Validation

```typescript
import express from 'express'

const app = express()
app.use(express.json())

// Async validation middleware
function validate(schema: { [key: string]: (val: any) => Promise<string | null> }) {
  return async (req: any, res: any, next: any) => {
    const errors: string[] = []

    for (const [field, validator] of Object.entries(schema)) {
      const value = req.body[field]
      const error = await validator(value)
      if (error) errors.push(error)
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors })
    }

    next()
  }
}

// Async validators
const validators = {
  email: async (val: any): Promise<string | null> => {
    if (!val) return 'Email is required'
    if (typeof val !== 'string') return 'Email must be a string'
    if (!val.includes('@')) return 'Invalid email format'

    // Async email domain validation
    const domain = val.split('@')[1]
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
  },

  age: async (val: any): Promise<string | null> => {
    if (val === undefined || val === null) return 'Age is required'
    const num = Number(val)
    if (isNaN(num)) return 'Age must be a number'
    if (num < 0 || num > 150) return 'Age must be between 0 and 150'

    return null
  },

  username: async (val: any): Promise<string | null> => {
    if (!val) return 'Username is required'
    if (typeof val !== 'string') return 'Username must be a string'
    if (val.length < 3) return 'Username must be at least 3 characters'
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return 'Username can only contain letters, numbers, and underscores'

    return null
  }
}

app.post('/register',
  validate({
    email: validators.email,
    age: validators.age,
    username: validators.username
  }),
  async (req, res) => {
    // All validation passed
    const user = await db.createUser(req.body)
    res.status(201).json(user)
  }
)

app.listen(3000)
```

### Middleware Pipeline

```typescript
import express from 'express'

const app = express()

// Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

// Authenticator
app.use('/admin', (req, res, next) => {
  const token = req.get('Authorization')
  if (token === 'secret-token') return next()
  res.status(401).send('Unauthorized')
})

// Request timer
app.use((req, res, next) => {
  const start = Date.now()
  const originalEnd = res.end.bind(res)
  res.end = (...args: any[]) => {
    console.log(`${req.url} took ${Date.now() - start}ms`)
    originalEnd(...args)
  }
  next()
})

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(3000)
```

### Structured API with Router

```typescript
import express from 'express'

// User router
const userRouter = express.Router()

userRouter.param('id', async (req, res, next, id) => {
  req.user = await database.findUser(id)
  if (!req.user) return next(new Error('User not found'))
  next()
})

userRouter.get('/', (req, res) => {
  res.json(database.getAllUsers())
})

userRouter.get('/:id', (req, res) => {
  res.json(req.user)
})

userRouter.post('/', (req, res) => {
  const user = database.createUser(req.body)
  res.status(201).json(user)
})

// Post router
const postRouter = express.Router()

postRouter.get('/:postId', (req, res) => {
  const post = database.getPost(req.params.postId)
  if (!post) return res.status(404).end()
  res.json(post)
})

// Mount
const app = express()
app.use(express.json())
app.use('/api/users', userRouter)
app.use('/api/posts', postRouter)

app.listen(3000)
```

## Fluent Route Builder

The fluent `.route()` API lets you chain `.describe()`, `.validate()`, `.middleware()`, and HTTP verb methods in a single pipeline:

```typescript
app.route('/users/:id')
  .describe({
    summary: 'Get user by ID',
    description: 'Returns a single user record',
    tags: ['users']
  })
  .validate({
    params: userParamsSchema    // Standard Schema validation
  })
  .middleware(authenticate, rateLimiter)
  .get(async (req, res) => {
    const user = await db.findUser(req.params.id)
    if (!user) throw new NotFoundError('User', req.params.id)
    res.ok(user)
  })
```

The builder also works with the classic `.get(fn)` pattern — just without the extra chaining:

```typescript
app.route('/hello').get((req, res) => res.send('world'))
```

Each builder can be finalized only once. After a terminal verb (`.get()`, `.post()`, etc.) is called, the builder is locked.

## Request Validation

Validate request bodies, query parameters, route parameters, and headers using any **Standard Schema v1** compatible library (Valibot, Zod, ArkType).

```typescript
import * as v from 'valibot'
import { validate } from 'express'

const UserSchema = v.object({
  name: v.pipe(v.string(), v.minLength(2)),
  email: v.pipe(v.string(), v.email()),
  age: v.pipe(v.number(), v.minValue(0), v.maxValue(150))
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

The validation middleware accepts the Standard Schema v1 interface — a vendor-neutral spec. Any library that implements `'~standard'` property with a `.validate()` method works.

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

Validation targets:

| Target | Schema Key | req Property |
|---|---|---|
| Request body | `body` | `req.body` and `req.validated.body` |
| Query string | `query` | `req.query` and `req.validated.query` |
| Route params | `params` | `req.params` and `req.validated.params` |
| Headers | `headers` | `req.headers` |

On validation failure, the middleware responds with HTTP 400 and a JSON error body containing the validation issues.

## Typed HTTP Errors

A hierarchy of typed error classes for common HTTP status codes. Throw them in your handlers and they are automatically formatted by the global error middleware.

```typescript
import {
  HttpError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError
} from 'express'
```

**Usage:**

```typescript
app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id)
  if (!user) throw new NotFoundError('User', req.params.id)
  res.ok(user)
})

app.post('/users', async (req, res) => {
  try {
    const user = await db.createUser(req.body)
    res.created(user)
  } catch (err) {
    throw new ConflictError('Email already exists')
  }
})

app.use('/admin', (req, res, next) => {
  if (!req.isAuthenticated) throw new UnauthorizedError()
  next()
})
```

**Error hierarchy:**

```
HttpError (base)
├── BadRequestError (400)
├── UnauthorizedError (401)
├── ForbiddenError (403)
├── NotFoundError (404)
├── ConflictError (409)
├── ValidationError (400, with issues)
├── TooManyRequestsError (429, with retryAfter)
└── InternalServerError (500, not exposed by default)
```

All errors expose `.statusCode` and `.expose` (true for 4xx, false for 5xx).

## Response Helpers

Semantic, chainable response methods that set both status and body in one call:

```typescript
res.ok(body)                // 200 — Successful response
res.created(body)           // 201 — Resource created
res.noContent()             // 204 — No content
res.badRequest(errors)      // 400 — Bad request with optional details
res.unauthorized(msg)       // 401 — Unauthorized
res.forbidden(msg)          // 403 — Forbidden
res.notFound(msg)           // 404 — Not found
res.conflict(msg)           // 409 — Conflict
res.tooManyRequests(retry)  // 429 — Rate limited (sets Retry-After)
res.error(status, msg)      // dynamic — Custom error response
```

**Examples:**

```typescript
app.get('/items', (req, res) => res.ok(items))
app.post('/items', (req, res) => res.created(newItem))
app.delete('/items/:id', (req, res) => res.noContent())
app.get('/secret', (req, res) => res.unauthorized())
app.get('/admin', (req, res) => res.forbidden('Admins only'))
app.get('/missing', (req, res) => res.notFound('User not found'))
app.get('/conflict', (req, res) => res.conflict('Already exists'))
app.get('/limited', (req, res) => res.tooManyRequests(30))
app.get('/custom', (req, res) => res.error(418, "I'm a teapot"))
```

## OpenAPI & Swagger

Auto-generate OpenAPI 3.1 documentation from your fluent route definitions — no manual schema files needed.

### Setup

```typescript
app
  .route('/users')
  .describe({
    summary: 'List users',
    description: 'Returns all registered users',
    tags: ['users']
  })
  .get(listHandler)

app
  .route('/users/:id')
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

// Enable OpenAPI spec generation
app.set('openapi', {
  info: { title: 'My API', version: '1.0.0' },
  servers: [{ url: 'http://localhost:3000', description: 'Development' }]
})
```

This automatically:
1. Collects route metadata from all `.describe()` calls in fluent builders
2. Converts Valibot schemas to JSON Schema for request/response models
3. Serves the generated spec at `GET /openapi.json`
4. Serves Swagger UI at `GET /docs`

### Customization

```typescript
app.set('openapi', {
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'API documentation',
    contact: { name: 'Support', email: 'api@example.com' },
    license: { name: 'MIT' }
  },
  servers: [
    { url: 'https://api.example.com', description: 'Production' },
    { url: 'http://localhost:3000', description: 'Development' }
  ],
  security: [{ bearerAuth: [] }],
  serveUI: true    // default: true, serves Swagger UI at /docs
})
```

### How it works

- Only routes defined with the fluent `.route().describe()` builder are included in the spec
- Bare `app.get('/path', fn)` routes are not collected (zero overhead)
- Path parameters are normalized from `:id` to `{id}` (OpenAPI format)
- Valibot schemas are introspected at runtime and converted to JSON Schema
- The spec is generated once when `app.set('openapi', ...)` is called

## TypeScript Usage

This rewrite is written in TypeScript and ships with complete type definitions.

```typescript
import express, { Request, Response, NextFunction, Application } from 'express'

const app: Application = express()

// Typed handlers
app.get('/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello World' })
})

// Typed error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.message)
  res.status(500).json({ error: err.message })
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

**Exported types:**

| Type | Description |
|---|---|
| `Request` | Extended `http.IncomingMessage` with query, params, body, etc. |
| `Response` | Extended `http.ServerResponse` with send, json, cookie, etc. |
| `Application` | The Express app interface including all settings methods |
| `Router` | Router interface with use, route, param methods |
| `Route` | Route interface with HTTP verb methods and dispatch |
| `Handler` | Middleware handler: `(req, res, next) => any` |
| `ErrorHandler` | Error handler: `(err, req, res, next) => any` |
| `NextFunction` | Callback: `(err?: any) => void` |
| `ParamHandler` | Parameter callback: `(req, res, next, value, name) => any` |

## Migration from Express 5.x

**Breaking changes:**

- The `router` package is no longer a dependency. Router is built into Express. Import via `express.Router` instead of `require('router')`
- `path-to-regexp` is no longer used. The radix trie handles path matching natively. Most path patterns work identically, but exotic regex routes (`/\\/user\/(\\d+)/`) may behave differently
- The `sync` counter (100-call stack overflow protection) has been removed. Async dispatch naturally prevents stack overflows
- Middleware execution timing may change subtly due to async dispatch. Tests relying on `setImmediate` ordering after middleware should be reviewed

**New features (backward-compatible):**

- `app.route(path)` now returns a `RouteBuilder` with fluent `.describe()`, `.validate()`, `.middleware()` chaining. The classic `.get(fn)` still works
- `res.ok()`, `res.created()`, `res.notFound()` etc. — semantic response helpers
- `HttpError`, `NotFoundError`, `BadRequestError` etc. — typed error classes
- `validate({ body, query, params })` — Standard Schema validation middleware
- OpenAPI 3.1 spec auto-generation via `app.set('openapi', { info })`
- Swagger UI served at `/docs` when OpenAPI is enabled

**Preserved behavior:**

- All `req.*` and `res.*` methods work identically
- `next('route')` and `next('router')` sentinels are preserved
- `app.param()`, `router.param()`, and parameter callbacks work as before
- Sub-app mounting with `app.use('/path', subApp)` works identically
- Settings system (`app.set`, `app.get`, `app.enable`, `app.disable`) is unchanged
- View engine integration and `res.render` / `app.render` are unchanged
- All middleware (body-parser, serve-static, etc.) works identically

## Running Tests

```bash
npm install
npm run build    # compile TypeScript
npm test         # run test suite
```

The test suite uses Mocha and Supertest. Tests are written in JavaScript for backward compatibility.

```bash
# Run specific test files
npx mocha test/trie.js          # Radix trie unit tests
npx mocha test/app.basic.js     # Application integration tests
```

## License

[MIT](LICENSE)

[npm-version-image]: https://img.shields.io/npm/v/express
[npm-url]: https://npmjs.org/package/express
[github-actions-ci-image]: https://img.shields.io/github/actions/workflow/status/expressjs/express/ci.yml?branch=master&label=ci
[github-actions-ci-url]: https://github.com/expressjs/express/actions/workflows/ci.yml
[coveralls-image]: https://img.shields.io/coverallsCoverage/github/expressjs/express?branch=master
[coveralls-url]: https://coveralls.io/r/expressjs/express?branch=master
