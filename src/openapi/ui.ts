import type { Handler } from '../types'
import type { GeneratedOpenAPI } from './index'

export function serveOpenAPI(spec: GeneratedOpenAPI): Handler {
  return (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(JSON.stringify(spec, null, 2))
  }
}

export function serveSwaggerUI(specUrl: string = '/openapi.json'): Handler {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: ${JSON.stringify(specUrl)},
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
      ],
      layout: 'StandaloneLayout'
    });
  </script>
</body>
</html>`

  return (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(html)
  }
}
