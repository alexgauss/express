# Async Patterns

Express's async-first pipeline natively supports async/await middleware and route handlers without any wrapper functions or detection overhead.

## Basic Async Handler

```typescript
app.get('/users', async (req, res) => {
  const users = await db.findUsers()
  res.ok(users)
})
```

Async rejections are automatically caught by the error middleware:

```typescript
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message })
})
```

## Patterns

### Pattern 1: try/catch per handler

```typescript
app.get('/users/:id', async (req, res) => {
  try {
    const user = await db.findUser(req.params.id)
    if (!user) return res.notFound()
    res.ok(user)
  } catch (err) {
    res.badRequest(err.message)
  }
})
```

### Pattern 2: Throw typed errors

```typescript
app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id)
  if (!user) throw new NotFoundError('User')
  res.ok(user)
})
```

### Pattern 3: Global error handler (recommended)

```typescript
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode
    })
  }
  console.error('Unhandled:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})
```

## Async Middleware

```typescript
async function auth(req, res, next) {
  const token = req.get('Authorization')
  if (!token) throw new UnauthorizedError()

  const user = await verifyToken(token)
  req.user = user
  next()
}

async function audit(req, res, next) {
  const start = Date.now()
  const origEnd = res.end.bind(res)

  res.end = function (...args) {
    logAudit(req, Date.now() - start).catch(() => {})
    origEnd(...args)
  }

  next()
}

app.get('/admin', auth, audit, handler)
```

## Concurrent Operations

```typescript
// Parallel reads
app.get('/dashboard', async (req, res) => {
  const [users, posts, stats] = await Promise.all([
    db.findUsers(),
    db.findPosts(),
    db.getStats()
  ])
  res.ok({ users, posts, stats })
})

// Parallel writes with error isolation
app.post('/batch', async (req, res) => {
  const results = await Promise.allSettled(
    req.body.items.map(item => db.create(item))
  )
  const succeeded = results.filter(r => r.status === 'fulfilled')
  const failed = results.filter(r => r.status === 'rejected')
  res.ok({ succeeded: succeeded.length, failed: failed.length })
})
```

## Streaming with Async Generators

```typescript
app.get('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')

  async function* generate() {
    for (const item of await db.findLargeDataset()) {
      yield `data: ${JSON.stringify(item)}\n\n`
    }
  }

  const { Readable } = require('node:stream')
  Readable.from(generate()).pipe(res)
})
```
