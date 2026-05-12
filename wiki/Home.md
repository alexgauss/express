# Welcome to the Express Wiki

Express is a fast, type-safe, minimalist web framework for Node.js, rewritten in TypeScript with a radix-trie router, async-first pipeline, fluent API builder, built-in validation, and auto-generated OpenAPI docs.

## Quick Links

- [Getting Started](./Getting-Started)
- [API Reference](./API-Reference)
- [Fluent Route Builder](./Fluent-Route-Builder)
- [Request Validation](./Request-Validation)
- [Typed HTTP Errors](./Typed-HTTP-Errors)
- [OpenAPI & Swagger](./OpenAPI-and-Swagger)
- [Logging](./Logging)
- [Async Patterns](./Async-Patterns)
- [Migration Guide](./Migration-Guide)
- [Architecture Overview](./Architecture-Overview)

## Key Features

- **TypeScript-native** — Full type safety for the entire API surface
- **Radix-trie router** — O(k) route matching instead of O(n) linear scan
- **Async-first** — Native Promise-based middleware pipeline
- **Fluent API** — Chain `.describe()`, `.validate()`, `.middleware()`, `.get()` on routes
- **Built-in validation** — Standard Schema v1 middleware for body/query/params
- **Auto OpenAPI** — Generate OpenAPI 3.1 specs from route definitions
- **Typed errors** — `NotFoundError`, `BadRequestError`, `ValidationError`, etc.
- **Structured logging** — Built-in logger with JSON, dev, and combined formats
- **Zero external router deps** — Everything is built-in

## Quick Example

```typescript
import express from 'express'
import * as v from 'valibot'

const app = express()

app.route('/users/:id')
  .describe({ summary: 'Get user', tags: ['users'] })
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
