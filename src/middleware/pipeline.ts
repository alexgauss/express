import type { Handler, ErrorHandler, Next, Request, Response, MiddlewareEntry } from '../types'

export class RouterExitError extends Error {
  constructor() {
    super('router exit')
    this.name = 'RouterExitError'
  }
}

export class RouteExitError extends Error {
  constructor() {
    super('route exit')
    this.name = 'RouteExitError'
  }
}

function isErrorHandler(fn: any): boolean {
  return fn.length === 4
}

interface PipelineLayer {
  handler: any
  path?: string
}

export function createPipeline(layers: PipelineLayer[]): (req: Request, res: Response) => Promise<void> {
  const reqAny = ({} as any)
  const resAny = ({} as any)

  return async function run(req: Request, res: Response): Promise<void> {
    let idx = 0
    let doneCalled = false

    async function next(err?: any): Promise<void> {
      if (doneCalled) return

      if (err === 'route') {
        doneCalled = true
        return
      }
      if (err === 'router') {
        doneCalled = true
        return
      }

      let layer = layers[idx++]
      if (!layer) {
        if (err) throw err
        return
      }

      if (err) {
        while (layer && !isErrorHandler(layer.handler)) {
          layer = layers[idx++]
        }
        if (!layer) {
          throw err
        }
      } else {
        while (layer && isErrorHandler(layer.handler)) {
          layer = layers[idx++]
        }
        if (!layer) return
      }

      await new Promise<void>((resolve, reject) => {
        const nextFn: Next = (e?: any) => {
          if (e === 'route' || e === 'router') {
            doneCalled = true
            resolve()
            return
          }
          next(e).then(resolve, reject)
        }

        try {
          const result = err
            ? layer.handler(err, req, res, nextFn)
            : layer.handler(req, res, nextFn)

          if (result instanceof Promise) {
            result.then(
              () => {
                if (!doneCalled) resolve()
              },
              (e: any) => reject(e)
            )
          } else if (result !== undefined) {
            if (!doneCalled) resolve()
          }
        } catch (e: any) {
          reject(e)
        }
      })
    }

    try {
      await next()
    } catch (err: any) {
      if (err instanceof RouterExitError) return
      if (err instanceof RouteExitError) return
      const finalErr = err
      doneCalled = true
      let errorLayer = layers[idx]
      while (errorLayer && !isErrorHandler(errorLayer.handler)) {
        errorLayer = layers[++idx]
      }
      if (errorLayer) {
        await new Promise<void>((resolve) => {
          const nextFn: Next = () => resolve()
          try {
            const result = errorLayer.handler(finalErr, req, res, nextFn)
            if (result instanceof Promise) result.then(resolve, () => resolve())
          } catch {
            resolve()
          }
        })
      }
    }
  }
}

export function buildHandlerChain(
  middlewareEntries: MiddlewareEntry[],
  handlers: any[],
  baseUrl: string
): PipelineLayer[] {
  const normalLayers: PipelineLayer[] = []
  const errorLayers: PipelineLayer[] = []
  const added = new Set<Function>()

  for (const entry of middlewareEntries) {
    for (const handler of entry.handlers) {
      if (!added.has(handler)) {
        added.add(handler)
        const layer = { handler, path: entry.path }
        if (handler.length === 4) {
          errorLayers.push(layer)
        } else {
          normalLayers.push(layer)
        }
      }
    }
  }

  for (const handler of handlers) {
    if (!added.has(handler)) {
      added.add(handler)
      normalLayers.push({ handler })
    }
  }

  return [...normalLayers, ...errorLayers]
}
