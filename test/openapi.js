'use strict'

var assert = require('node:assert')

describe('OpenAPI', function () {
  describe('Schema converter', function () {
    var valibotToJsonSchema

    before(function () {
      valibotToJsonSchema = require('../dist/openapi/schema').valibotToJsonSchema
    })

    function wrap(schema) {
      return { '~standard': schema }
    }

    it('should convert a string schema', function () {
      var result = valibotToJsonSchema(wrap({ version: 1, vendor: 'valibot' }))
      // unknown type -> defaults to object type
      assert.ok(result)
    })
  })

  describe('Registry', function () {
    var OpenAPIRegistry

    before(function () {
      OpenAPIRegistry = require('../dist/openapi/index').OpenAPIRegistry
    })

    beforeEach(function () {
      OpenAPIRegistry.clear()
    })

    it('should register a route and generate spec', function () {
      OpenAPIRegistry.register({
        method: 'GET',
        path: '/users/:id',
        summary: 'Get user by ID',
        tags: ['users']
      })

      var spec = OpenAPIRegistry.generateSpec({
        info: { title: 'Test API', version: '1.0.0' }
      })

      assert.strictEqual(spec.openapi, '3.1.0')
      assert.strictEqual(spec.info.title, 'Test API')
      assert.ok(spec.paths['/users/{id}'])
      assert.strictEqual(spec.paths['/users/{id}'].get.summary, 'Get user by ID')
    })

    it('should normalize path params from :id to {id}', function () {
      OpenAPIRegistry.register({
        method: 'POST',
        path: '/users/:userId/posts/:postId',
        summary: 'Get post'
      })

      var spec = OpenAPIRegistry.generateSpec({
        info: { title: 'Test', version: '1.0.0' }
      })

      assert.ok(spec.paths['/users/{userId}/posts/{postId}'])
    })

    it('should handle routes without method (all methods)', function () {
      OpenAPIRegistry.register({
        path: '/health',
        summary: 'Health check'
      })

      var spec = OpenAPIRegistry.generateSpec({
        info: { title: 'Test', version: '1.0.0' }
      })

      assert.ok(spec.paths['/health'])
      // All methods should have the same operation
      assert.ok(spec.paths['/health'].get)
      assert.ok(spec.paths['/health'].post)
      assert.ok(spec.paths['/health'].put)
    })

    it('should collect tags from routes', function () {
      OpenAPIRegistry.register({
        method: 'GET',
        path: '/users',
        tags: ['users']
      })
      OpenAPIRegistry.register({
        method: 'GET',
        path: '/posts',
        tags: ['posts']
      })

      var spec = OpenAPIRegistry.generateSpec({
        info: { title: 'Test', version: '1.0.0' }
      })

      assert.strictEqual(spec.tags.length, 2)
      var tagNames = spec.tags.map(function (t) { return t.name })
      assert.ok(tagNames.includes('users'))
      assert.ok(tagNames.includes('posts'))
    })

    it('should generate operationId', function () {
      OpenAPIRegistry.register({
        method: 'GET',
        path: '/users/:id',
        summary: 'Get user'
      })

      var spec = OpenAPIRegistry.generateSpec({
        info: { title: 'Test', version: '1.0.0' }
      })

      assert.ok(spec.paths['/users/{id}'].get.operationId)
      assert.strictEqual(spec.paths['/users/{id}'].get.operationId, 'get_users_id')
    })

    it('should track route count', function () {
      assert.strictEqual(OpenAPIRegistry.routesCount, 0)

      OpenAPIRegistry.register({
        method: 'GET',
        path: '/a'
      })
      assert.strictEqual(OpenAPIRegistry.routesCount, 1)

      OpenAPIRegistry.register({
        method: 'POST',
        path: '/b'
      })
      assert.strictEqual(OpenAPIRegistry.routesCount, 2)
    })
  })

  describe('Integration with express', function () {
    var express
    var request

    before(function () {
      express = require('..')
      request = require('supertest')
    })

    it('should serve OpenAPI spec via setting', function (done) {
      var app = express()

      app.route('/users')
        .describe({ summary: 'List users', tags: ['users'] })
        .get(function (req, res) {
          res.json([])
        })

      app.set('openapi', {
        info: { title: 'My API', version: '1.0.0' },
        serveUI: false
      })

      request(app)
        .get('/openapi.json')
        .expect(200)
        .expect(function (res) {
          assert.strictEqual(res.body.openapi, '3.1.0')
          assert.strictEqual(res.body.info.title, 'My API')
          assert.ok(res.body.paths['/users'])
        })
        .end(done)
    })

    it('should serve Swagger UI when enabled', function (done) {
      var app = express()

      app.route('/test')
        .describe({ summary: 'Test' })
        .get(function (req, res) {
          res.send('ok')
        })

      app.set('openapi', {
        info: { title: 'Test', version: '1.0.0' },
        serveUI: true
      })

      request(app)
        .get('/docs')
        .expect(200)
        .expect('Content-Type', /html/)
        .expect(function (res) {
          assert.ok(res.text.includes('swagger-ui'))
        })
        .end(done)
    })
  })
})
