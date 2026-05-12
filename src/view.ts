import * as fs from 'node:fs'
import * as path from 'node:path'
import * as pathModule from 'node:path'
import type { View as ViewInterface } from './types'

export class View implements ViewInterface {
  defaultEngine: string
  ext: string
  name: string
  path: string
  engine: Function
  root: string | string[]

  constructor(name: string, options: {
    defaultEngine?: string
    root: string | string[]
    engines: Record<string, Function>
  }) {
    this.defaultEngine = options.defaultEngine || ''
    this.ext = pathModule.extname(name)
    this.name = name
    this.root = options.root
    this.engine = this.resolveEngine(options.engines)
    this.path = this.resolve(options.engines)
  }

  private resolveEngine(engines: Record<string, Function>): Function {
    if (this.ext) {
      const engine = engines[this.ext]
      if (engine) return engine
    }

    if (this.defaultEngine) {
      const ext = this.defaultEngine[0] !== '.' ? '.' + this.defaultEngine : this.defaultEngine
      const engine = engines[ext]
      if (engine) return engine
    }

    throw new Error(`No engine found for "${this.ext || this.defaultEngine}"`)
  }

  private resolve(engines: Record<string, Function>): string {
    const roots = Array.isArray(this.root) ? this.root : [this.root]
    let ext = this.ext

    if (!ext) {
      ext = this.defaultEngine[0] !== '.' ? '.' + this.defaultEngine : this.defaultEngine
    }

    for (const root of roots) {
      const filePath = pathModule.resolve(root, this.name)
      if (fs.existsSync(filePath)) return filePath

      const withExt = filePath + ext
      if (fs.existsSync(withExt)) return withExt

      const indexed = pathModule.join(filePath, 'index' + ext)
      if (fs.existsSync(indexed)) return indexed
    }

    return ''
  }

  render(options: object, callback: (err: any, html: string) => void): void {
    try {
      this.engine(this.path, options, callback)
    } catch (err) {
      callback(err, '')
    }
  }
}
