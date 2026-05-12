import type { Handler, TrieNode, MatchResult, MiddlewareEntry, PathSegment } from '../types'

function createNode(prefix: string = ''): TrieNode {
  return {
    prefix,
    children: new Map(),
    paramChild: null,
    paramName: null,
    wildcardChild: null,
    handlers: new Map(),
    allHandlers: [],
    middleware: []
  }
}

function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = []
  const parts = path.split('/')

  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '*') {
      segments.push({ kind: 'wildcard' })
    } else if (part.startsWith('*')) {
      segments.push({ kind: 'wildcard', name: part.slice(1) || undefined })
    } else if (part.startsWith(':')) {
      segments.push({ kind: 'param', name: part.slice(1) })
    } else if (part.startsWith('{') && part.endsWith('}')) {
      const inner = part.slice(1, -1)
      if (inner.startsWith('*')) {
        segments.push({ kind: 'wildcard', name: inner.slice(1) || undefined })
      } else {
        segments.push({ kind: 'param', name: inner })
      }
    } else {
      segments.push({ kind: 'static', value: part })
    }
  }

  return segments
}

function findInsertNode(root: TrieNode, segments: PathSegment[]): { node: TrieNode; params: string[] } {
  let current = root
  const params: string[] = []

  for (const segment of segments) {
    if (segment.kind === 'static') {
      let child = current.children.get(segment.value)
      if (!child) {
        child = createNode(segment.value)
        current.children.set(segment.value, child)
      }
      current = child
    } else if (segment.kind === 'param') {
      if (!current.paramChild) {
        current.paramChild = createNode()
        current.paramName = segment.name
      } else if (current.paramName !== segment.name) {
        if (!current.paramName) {
          current.paramName = segment.name
        }
      }
      params.push(segment.name)
      current = current.paramChild
    } else if (segment.kind === 'wildcard') {
      if (!current.wildcardChild) {
        current.wildcardChild = createNode()
      }
      if (segment.name) {
        params.push(segment.name)
      }
      current = current.wildcardChild
    }
  }

  return { node: current, params }
}

function findLookupNode(
  root: TrieNode,
  segments: string[],
  params: Record<string, string>,
  middlewareAccum: MiddlewareEntry[]
): TrieNode | null {
  let current: TrieNode | null = root

  for (let i = 0; i < segments.length && current; i++) {
    const segment = segments[i]

    for (const mw of current.middleware) {
      let already = false
      for (const existing of middlewareAccum) {
        if (existing.path === mw.path && existing.handlers[0] === mw.handlers[0]) {
          already = true
          break
        }
      }
      if (!already) middlewareAccum.push(mw)
    }

    if (current.wildcardChild) {
      const rest = segments.slice(i).join('/')
      params['*'] = rest
      return current.wildcardChild
    }

    const staticChild = current.children.get(segment)
    if (staticChild) {
      current = staticChild
      continue
    }

    if (current.paramChild) {
      params[current.paramName || '0'] = segment
      current = current.paramChild
      continue
    }

    if (current.children.size === 0 && current.paramChild === null && current.wildcardChild === null) {
      return current
    }

    current = null
  }

  if (current) {
    for (const mw of current.middleware) {
      let already = false
      for (const existing of middlewareAccum) {
        if (existing.path === mw.path && existing.handlers[0] === mw.handlers[0]) {
          already = true
          break
        }
      }
      if (!already) middlewareAccum.push(mw)
    }
  }

  return current
}

export class RadixTrie {
  private root: TrieNode = createNode()

  insert(path: string, method: string, handlers: Handler[]): void {
    const normalizedPath = normalizePath(path)
    const segments = parsePath(normalizedPath)
    const { node } = findInsertNode(this.root, segments)

    if (method === 'ALL') {
      node.allHandlers.push(...handlers)
    } else {
      const m = method.toLowerCase()
      const existing = node.handlers.get(m)
      if (existing) {
        existing.push(...handlers)
      } else {
        node.handlers.set(m, [...handlers])
      }
    }
  }

  insertMiddleware(path: string, handlers: Handler[]): void {
    const normalizedPath = normalizePath(path)
    const segments = parsePath(normalizedPath)
    const { node } = findInsertNode(this.root, segments)

    node.middleware.push({ path: normalizedPath, handlers })
  }

  lookup(url: string, method: string): MatchResult | null {
    const normalizedPath = normalizePath(url)
    const segments = normalizedPath.split('/').filter(Boolean)
    const params: Record<string, string> = {}
    const middlewareAccum: MiddlewareEntry[] = []

    for (const mw of this.root.middleware) {
      middlewareAccum.push(mw)
    }

    const node = findLookupNode(this.root, segments, params, middlewareAccum)

    if (!node) return null

    const handlers: Handler[] = []

    if (node.allHandlers.length > 0) {
      handlers.push(...node.allHandlers)
    }

    const methodHandlers = node.handlers.get(method.toLowerCase())
    if (methodHandlers) {
      handlers.push(...methodHandlers)
    }

    return {
      params,
      middleware: middlewareAccum,
      handlers,
      node
    }
  }

  hasRoute(path: string, method: string): boolean {
    const result = this.lookup(path, method)
    return result !== null && result.handlers.length > 0
  }
}

function normalizePath(path: string): string {
  if (path === '' || path === '.') return '/'
  let result = path
  while (result.length > 0 && result.endsWith('/') && result !== '/') {
    result = result.slice(0, -1)
  }
  if (!result.startsWith('/')) result = '/' + result
  result = result.replace(/\/+/g, '/')
  return result
}

export { parsePath, normalizePath }
