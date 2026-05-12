const etag = require('etag')

export function compileETag(val: any): any {
  if (typeof val === 'function') return val
  if (val === true) return etag
  if (val === 'strong') return etag
  if (val === 'weak') {
    return function weakETag(body: any, encoding?: BufferEncoding) {
      return etag(body, { weak: true })
    }
  }
  return false
}

export function setCharset(type: string, charset: string): string {
  if (!type || !charset) return type
  const parsed = require('content-type').parse(type)
  parsed.parameters.charset = charset
  return require('content-type').format(parsed)
}

export function normalizeType(type: string): string {
  return ~type.indexOf('/') ? type : require('mime-types').lookup(type) || type
}

export function normalizeTypes(types: string[]): Array<{ value: string; quality: number }> {
  const result: Array<{ value: string; quality: number }> = []
  for (const type of types) {
    const parsed = /^(.+?)(?::(\d+))?$/.exec(type)
    if (parsed) {
      result.push({
        value: parsed[1],
        quality: parsed[2] ? parseInt(parsed[2], 10) : 1
      })
    }
  }
  return result
}
