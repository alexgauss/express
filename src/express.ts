import { createApplication } from './application'
import { Router } from './router/index'
import { Route } from './router/route'
import { reqProto } from './request'
import { resProto } from './response'
import { logger } from './logger/index'
import { requestId } from './logger/index'

const express = createApplication as any

express.application = {}
express.request = reqProto as any
express.response = resProto as any
express.Router = Router
express.Route = Route
express.logger = logger
express.requestId = requestId
express.json = function json(options?: any) { return require('body-parser').json(options) }
express.raw = function raw(options?: any) { return require('body-parser').raw(options) }
express.text = function text(options?: any) { return require('body-parser').text(options) }
express.urlencoded = function urlencoded(options?: any) { return require('body-parser').urlencoded(options) }
express.static = function staticFn(root: string, options?: any) { return require('serve-static')(root, options) }

export { express, logger, requestId }
export default express
