# API Reference

## express()

Creates the application. The returned app is a callable function suitable for `http.createServer(app)`.

```typescript
import express from 'express'
const app = express()
```

### Static Methods

| Method | Description |
|---|---|
| `express.Router` | Router class constructor |
| `express.Route` | Route class constructor |
| `express.logger(options?)` | Structured request logging |
| `express.requestId(options?)` | Request ID middleware |
| `express.validate(schemas)` | Schema validation middleware |
| `express.json(options?)` | JSON body parser |
| `express.urlencoded(options?)` | URL-encoded body parser |
| `express.raw(options?)` | Binary body parser |
| `express.text(options?)` | Text body parser |
| `express.static(root, options?)` | Static file serving |

## Application

### app.use()

```typescript
app.use((req, res, next) => { next() })
app.use('/path', middleware)
app.use('/path', subApp)
```

### app.get() / app.post() / app.put() / app.delete() / app.patch() / app.options() / app.head()

```typescript
app.get('/users', handler)
app.get('/users/:id', handler)
app.get('/users/:userId/posts/:postId', handler)

// Multiple handlers
app.get('/profile', authenticate, loadProfile, handler)
```

One-argument `app.get()` reads a setting:
```typescript
app.set('title', 'My App')
console.log(app.get('title')) // 'My App'
```

### app.route()

Returns a [RouteBuilder](./Fluent-Route-Builder).

```typescript
app.route('/users')
  .describe({ summary: 'List users' })
  .get(handler)
```

### app.all()

```typescript
app.all('/api/*', cors)
```

### app.param()

```typescript
app.param('id', async (req, res, next, value, name) => {
  req.user = await db.findUser(value)
  next()
})
```

### app.set() / app.get()

```typescript
app.set('etag', 'strong')
app.set('trust proxy', true)
app.set('query parser', 'extended')
app.set('env', 'production')
app.set('view engine', 'ejs')
app.set('jsonp callback name', 'cb')
app.set('openapi', { info: { title: 'API', version: '1.0.0' } })
```

### app.listen()

```typescript
app.listen(3000)
app.listen(3000, () => console.log('Ready'))
app.listen(3000, '0.0.0.0')
```

## Request

See [Request API](https://github.com/expressjs/express#request-api) in the Readme.

## Response

See [Response API](https://github.com/expressjs/express#response-api) in the Readme.
