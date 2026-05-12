import type { StandardSchemaV1 } from '../middleware/validate'
import { valibotToJsonSchema, type JSONSchema } from './schema'

export interface RouteSpec {
  method?: string
  path: string
  summary?: string
  description?: string
  tags?: string[]
  deprecated?: boolean
  security?: Array<Record<string, string[]>>
  operationId?: string
  parameters?: {
    path?: StandardSchemaV1
    query?: StandardSchemaV1
    headers?: StandardSchemaV1
  }
  requestBody?: StandardSchemaV1
  responses?: Record<string | number, {
    description: string
    schema?: StandardSchemaV1
  }>
}

interface OpenAPIInfo {
  title: string
  version: string
  description?: string
  contact?: {
    name?: string
    url?: string
    email?: string
  }
  license?: {
    name: string
    url?: string
  }
}

interface OpenAPIOptions {
  info: OpenAPIInfo
  servers?: Array<{ url: string; description?: string }>
  security?: Array<Record<string, string[]>>
}

export interface GeneratedOpenAPI {
  openapi: string
  info: OpenAPIInfo
  servers?: Array<{ url: string; description?: string }>
  paths: Record<string, Record<string, any>>
  components: {
    schemas: Record<string, JSONSchema>
    securitySchemes?: Record<string, any>
  }
  security?: Array<Record<string, string[]>>
  tags?: Array<{ name: string; description?: string }>
}

class OpenAPIRegistryClass {
  private routes: RouteSpec[] = []
  private schemas: Map<string, JSONSchema> = new Map()
  private schemaCount = 0

  register(spec: RouteSpec): void {
    this.routes.push(spec)
  }

  registerSchemaRef(schema: StandardSchemaV1): string {
    if (!schema) return ''
    const jsonSchema = valibotToJsonSchema(schema)
    const key = `Schema${++this.schemaCount}`
    this.schemas.set(key, jsonSchema)
    return key
  }

  generateSpec(options: OpenAPIOptions): GeneratedOpenAPI {
    const spec: GeneratedOpenAPI = {
      openapi: '3.1.0',
      info: options.info,
      servers: options.servers,
      paths: {},
      components: {
        schemas: {}
      },
      security: options.security,
      tags: []
    }

    const tagSet = new Set<string>()

    for (const route of this.routes) {
      if (route.tags) {
        for (const tag of route.tags) {
          tagSet.add(tag)
        }
      }

      const pathItem = buildPathItem(route, this)
      const normalizedPath = normalizePathParams(route.path)

      if (!spec.paths[normalizedPath]) {
        spec.paths[normalizedPath] = {}
      }

      if (route.method) {
        spec.paths[normalizedPath][route.method.toLowerCase()] = pathItem
      } else {
        for (const method of ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']) {
          spec.paths[normalizedPath][method] = { ...pathItem }
        }
      }
    }

    spec.tags = Array.from(tagSet).map(name => ({ name }))

    for (const [key, schema] of this.schemas.entries()) {
      spec.components.schemas[key] = schema
    }

    return spec
  }

  clear(): void {
    this.routes = []
    this.schemas.clear()
    this.schemaCount = 0
  }

  get routesCount(): number {
    return this.routes.length
  }
}

function buildPathItem(route: RouteSpec, registry: OpenAPIRegistryClass): Record<string, any> {
  const operation: Record<string, any> = {
    summary: route.summary || '',
    description: route.description || '',
    tags: route.tags || [],
    deprecated: route.deprecated || false,
    operationId: route.operationId || generateOperationId(route),
    parameters: [],
    responses: {}
  }

  if (route.security) {
    operation.security = route.security
  }

  if (route.parameters?.path) {
    const jsonSchema = valibotToJsonSchema(route.parameters.path)
    if (jsonSchema.properties) {
      for (const [name, prop] of Object.entries(jsonSchema.properties)) {
        operation.parameters.push({
          name,
          in: 'path',
          required: jsonSchema.required?.includes(name) ?? true,
          schema: prop
        })
      }
    }
  }

  if (route.parameters?.query) {
    const jsonSchema = valibotToJsonSchema(route.parameters.query)
    if (jsonSchema.properties) {
      for (const [name, prop] of Object.entries(jsonSchema.properties)) {
        operation.parameters.push({
          name,
          in: 'query',
          required: jsonSchema.required?.includes(name) ?? false,
          schema: prop
        })
      }
    }
  }

  if (route.parameters?.headers) {
    const jsonSchema = valibotToJsonSchema(route.parameters.headers)
    if (jsonSchema.properties) {
      for (const [name, prop] of Object.entries(jsonSchema.properties)) {
        operation.parameters.push({
          name,
          in: 'header',
          required: jsonSchema.required?.includes(name) ?? false,
          schema: prop
        })
      }
    }
  }

  if (route.requestBody) {
    const jsonSchema = valibotToJsonSchema(route.requestBody)
    const schemaRef = registry.registerSchemaRef(route.requestBody)

    if (schemaRef) {
      jsonSchema.$ref = `#/components/schemas/${schemaRef}`
    }

    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: jsonSchema
        }
      }
    }
  }

  if (route.responses) {
    for (const [status, response] of Object.entries(route.responses)) {
      const respObj: any = { description: response.description }
      if (response.schema) {
        const jsonSchema = valibotToJsonSchema(response.schema)
        respObj.content = {
          'application/json': { schema: jsonSchema }
        }
      }
      operation.responses[status] = respObj
    }
  }

  if (Object.keys(operation.responses).length === 0) {
    operation.responses = {
      '200': { description: 'Successful response' }
    }
  }

  return operation
}

function normalizePathParams(path: string): string {
  return path.replace(/:([^/]+)/g, '{$1}')
}

function generateOperationId(route: RouteSpec): string {
  const method = (route.method || 'ALL').toLowerCase()
  const path = route.path.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  return `${method}_${path}` || 'operation'
}

export const OpenAPIRegistry = new OpenAPIRegistryClass()
