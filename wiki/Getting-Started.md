# Getting Started

## Installation

```bash
npm install express
```

Node.js 18 or higher is required.

## Hello World

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

## With the Fluent Builder

```typescript
import express from 'express'
import * as v from 'valibot'

const app = express()

app.route('/hello')
  .describe({ summary: 'Say hello' })
  .get((req, res) => {
    res.send('Hello World')
  })

app.set('openapi', {
  info: { title: 'My API', version: '1.0.0' }
})

app.listen(3000)
```

## Project Setup

For a TypeScript project:

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist"
  }
}
```

## Next Steps

- [API Reference](./API-Reference)
- [Fluent Route Builder](./Fluent-Route-Builder)
- [Async Patterns](./Async-Patterns)
