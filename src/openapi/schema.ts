import type { StandardSchemaV1 } from '../middleware/validate'

export interface JSONSchema {
  type?: string
  properties?: Record<string, JSONSchema>
  items?: JSONSchema
  required?: string[]
  enum?: any[]
  anyOf?: JSONSchema[]
  oneOf?: JSONSchema[]
  allOf?: JSONSchema[]
  nullable?: boolean
  description?: string
  default?: any
  format?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  additionalProperties?: boolean | JSONSchema
  $ref?: string
  [key: string]: any
}

const BUILT_IN_SCHEMA_REGISTRY: Record<string, JSONSchema> = {}

export function registerSchema(name: string, schema: JSONSchema): void {
  BUILT_IN_SCHEMA_REGISTRY[name] = schema
}

export function valibotToJsonSchema(schema: StandardSchemaV1): JSONSchema {
  const props = schema['~standard']

  if (!props || typeof props !== 'object') {
    return { type: 'object' }
  }

  const schemaObj = schema as any
  const result: JSONSchema = {}

  switch (schemaObj.type) {
    case 'string': {
      result.type = 'string'
      const pipe = (schemaObj as any).pipe
      if (Array.isArray(pipe)) {
        for (const action of pipe) {
          applyStringAction(result, action)
        }
      }
      break
    }

    case 'number':
    case 'integer': {
      result.type = schemaObj.type === 'integer' ? 'integer' : 'number'
      const pipe = (schemaObj as any).pipe
      if (Array.isArray(pipe)) {
        for (const action of pipe) {
          applyNumberAction(result, action)
        }
      }
      break
    }

    case 'boolean': {
      result.type = 'boolean'
      break
    }

    case 'null': {
      result.type = 'null'
      break
    }

    case 'object': {
      result.type = 'object'
      result.properties = {}
      const entries = (schemaObj as any).entries
      if (entries && typeof entries === 'object') {
        const required: string[] = []
        for (const key of Object.keys(entries)) {
          const fieldSchema = entries[key]
          result.properties[key] = convertFieldSchema(fieldSchema)
          if (!isOptional(fieldSchema)) {
            required.push(key)
          }
        }
        if (required.length > 0) result.required = required
      }
      result.additionalProperties = false
      break
    }

    case 'array': {
      result.type = 'array'
      const item = (schemaObj as any).item
      if (item && typeof item === 'object' && item['~standard']) {
        result.items = valibotToJsonSchema(item)
      } else {
        result.items = { type: 'object' }
      }
      break
    }

    case 'union': {
      const options = (schemaObj as any).options
      if (Array.isArray(options) && options.length > 0) {
        result.anyOf = options
          .filter((o: any) => o && o['~standard'])
          .map((o: any) => valibotToJsonSchema(o))
        if (result.anyOf.length === 0) result.anyOf = [{ type: 'object' }]
      }
      break
    }

    case 'enum': {
      result.type = 'string'
      const enumValues = (schemaObj as any).values || (schemaObj as any).options
      if (enumValues && typeof enumValues === 'object') {
        result.enum = Object.values(enumValues).filter(
          (v: any) => typeof v === 'string'
        )
      }
      break
    }

    default: {
      if (schemaObj.kind === 'schema') {
        if ((schemaObj as any).wrapped) {
          return valibotToJsonSchema((schemaObj as any).wrapped)
        }
      }
      result.type = 'object'
      break
    }
  }

  if (schemaObj.description) {
    result.description = schemaObj.description
  }
  if (schemaObj.default !== undefined) {
    result.default = schemaObj.default
  }

  return result
}

function convertFieldSchema(schema: any): JSONSchema {
  if (!schema || !schema['~standard']) {
    return { type: 'object' }
  }
  const result = valibotToJsonSchema(schema)
  if (schema.type === 'optional' || schema.type === 'nullable') {
    const wrapped = schema.wrapped
    if (wrapped && wrapped['~standard']) {
      const base = valibotToJsonSchema(wrapped)
      if (schema.type === 'nullable') {
        base.nullable = true
      }
      return base
    }
  }
  return result
}

function isOptional(schema: any): boolean {
  if (!schema) return false
  if (schema.type === 'optional') return true
  if ((schema as any).pipe) {
    return isOptional((schema as any).pipe[0])
  }
  return false
}

function applyStringAction(result: JSONSchema, action: any): void {
  switch (action.type) {
    case 'min_length':
      result.minLength = action.requirement
      break
    case 'max_length':
      result.maxLength = action.requirement
      break
    case 'email':
      result.format = 'email'
      break
    case 'url':
      result.format = 'uri'
      break
    case 'uuid':
      result.format = 'uuid'
      result.pattern = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      break
    case 'regex':
      if (action.requirement instanceof RegExp) {
        result.pattern = action.requirement.source
      } else if (typeof action.requirement === 'string') {
        result.pattern = action.requirement
      }
      break
  }
}

function applyNumberAction(result: JSONSchema, action: any): void {
  switch (action.type) {
    case 'min_value':
      result.minimum = action.requirement
      break
    case 'max_value':
      result.maximum = action.requirement
      break
    case 'integer':
      result.type = 'integer'
      break
  }
}
