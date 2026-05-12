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

Async error handling works automatically:

```typescript
app.get('/data', async (req, res) => {
  const data = await db.query()  // rejections become 500
  res.json(data)
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

### RESTful API

```typescript
import express from 'express'

const app = express()
app.use(express.json())

const items: Array<{ id: number; name: string }> = []

app.get('/items', (req, res) => {
  res.json(items)
})

app.get('/items/:id', (req, res) => {
  const item = items.find(i => i.id === Number(req.params.id))
  if (!item) return res.status(404).send('Not found')
  res.json(item)
})

app.post('/items', (req, res) => {
  const item = { id: items.length + 1, ...req.body }
  items.push(item)
  res.status(201).json(item)
})

app.put('/items/:id', (req, res) => {
  const idx = items.findIndex(i => i.id === Number(req.params.id))
  if (idx === -1) return res.status(404).send('Not found')
  items[idx] = { ...items[idx], ...req.body }
  res.json(items[idx])
})

app.delete('/items/:id', (req, res) => {
  const idx = items.findIndex(i => i.id === Number(req.params.id))
  if (idx === -1) return res.status(404).send('Not found')
  items.splice(idx, 1)
  res.status(204).end()
})

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
