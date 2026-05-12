# Fluent Route Builder

The `RouteBuilder` returned by `app.route()` provides a chainable API for defining routes with validation, documentation, and middleware.

## Basic Usage

```typescript
app.route('/users')
  .get(handler)
```

With extras:

```typescript
app.route('/users/:id')
  .describe({
    summary: 'Get user by ID',
    description: 'Returns a single user record',
    tags: ['users']
  })
  .validate({
    params: v.object({ id: v.pipe(v.string(), v.uuid()) })
  })
  .middleware(authenticate, rateLimiter)
  .get(async (req, res) => {
    const user = await db.findUser(req.params.id)
    if (!user) throw new NotFoundError('User')
    res.ok(user)
  })
```

## Methods

### .describe(description)

Attaches OpenAPI metadata. Only routes with `.describe()` appear in the generated OpenAPI spec.

```typescript
interface RouteDescription {
  summary?: string
  description?: string
  tags?: string[]
  deprecated?: boolean
  security?: Array<Record<string, string[]>>
  operationId?: string
  responses?: Record<string | number, {
    description: string
    schema?: StandardSchemaV1
  }>
}
```

### .validate(schemas)

Validates request data using Standard Schema v1 compatible schemas.

```typescript
interface ValidationSchemas {
  body?: StandardSchemaV1
  query?: StandardSchemaV1
  params?: StandardSchemaV1
  headers?: StandardSchemaV1
}
```

Validation middleware runs before route middleware and handlers. On failure, responds with 400.

### .middleware(...handlers)

Adds route-specific middleware (runs after validation, before handler).

### Terminal Verbs

Each builder can be finalized **once**. After calling one of these, the builder is locked:

- `.get(handler)`
- `.post(handler)`
- `.put(handler)`
- `.delete(handler)`
- `.patch(handler)`
- `.options(handler)`
- `.head(handler)`
- `.all(handler)`

## How It Works

1. `app.route(path)` creates a `RouteBuilder` with the path and a reference to the router
2. `.describe()`, `.validate()`, `.middleware()` store metadata and return `this`
3. The terminal verb:
   - Builds the handler chain: `[validation, ...middleware, ...handlers]`
   - Registers the route in the radix trie
   - Pushes metadata to the OpenAPI registry
   - Locks the builder (prevents double registration)

## Error Handling

Attempting to call a terminal verb twice on the same builder throws:

```typescript
const builder = app.route('/test').get(fn1)
builder.get(fn2) // Error: RouteBuilder already finalized
```
