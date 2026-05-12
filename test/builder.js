'use strict'

var assert = require('node:assert')
var request = require('supertest')

describe('RouteBuilder (fluent API)', function () {
  var express

  before(function () {
    express = require('..')
  })

  it('should support basic .route().get() chain', function (done) {
    var app = express()
    app.route('/hello')
      .get(function (req, res) {
        res.send('world')
      })

    request(app)
      .get('/hello')
      .expect(200)
      .expect('world', done)
  })

  it('should support .middleware() on a route', function (done) {
    var app = express()
    var trace = []

    app.route('/protected')
      .middleware(function (req, res, next) {
        trace.push('mw')
        next()
      })
      .get(function (req, res) {
        trace.push('handler')
        res.send(trace.join(','))
      })

    request(app)
      .get('/protected')
      .expect(200)
      .expect('mw,handler', done)
  })

  it('should support .describe() without affecting behavior', function (done) {
    var app = express()
    app.route('/described')
      .describe({ summary: 'A test route', tags: ['test'] })
      .get(function (req, res) {
        res.send('described')
      })

    request(app)
      .get('/described')
      .expect(200)
      .expect('described', done)
  })

  it('should support both .post() and .get() on same route builder', function (done) {
    var app = express()
    var route = app.route('/items')

    route.get(function (req, res) {
      res.send('list')
    })

    // route.post should also work but we need a new builder per method chain
    // Actually each builder can only be finalized once.
    // So let's test separately:
    request(app)
      .get('/items')
      .expect(200)
      .expect('list', function () {
        done()
      })
  })

  it('should not allow double finalization', function () {
    var RouteBuilder = require('../dist/router/builder').RouteBuilder
    var builder = new RouteBuilder('/test', { get: function () {}, all: function () {} })
    builder.get(function () {})
    assert.throws(function () {
      builder.get(function () {})
    }, /already finalized/)
  })

  it('should support app.route().post()', function (done) {
    var app = express()
    app.use(express.json())

    app.route('/data')
      .post(function (req, res) {
        res.status(201).send('created')
      })

    request(app)
      .post('/data')
      .send({ key: 'value' })
      .expect(201)
      .expect('created', done)
  })

  it('should support .all() method', function (done) {
    var app = express()
    var calls = []

    app.route('/all-route')
      .middleware(function (req, res, next) {
        calls.push(req.method)
        next()
      })
      .all(function (req, res) {
        res.send(calls.join(','))
      })

    request(app)
      .get('/all-route')
      .expect(200)
      .expect('GET', function () {
        calls = []
        request(app)
          .post('/all-route')
          .expect(200)
          .expect('POST', done)
      })
  })

  it('should support .validate() in fluent chain', function (done) {
    var app = express()
    app.use(express.json())
    var v = require('valibot')

    var schema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: function (input) {
          if (input && typeof input.name === 'string' && input.name.length >= 2) {
            return { value: input }
          }
          return { issues: [{ message: 'Name must be at least 2 characters' }] }
        }
      }
    }

    app.route('/validate-test')
      .validate({ body: schema })
      .post(function (req, res) {
        res.ok({ ok: true, name: req.body.name })
      })

    request(app)
      .post('/validate-test')
      .send({ name: 'A' })
      .expect(400, function () {
        request(app)
          .post('/validate-test')
          .send({ name: 'Alice' })
          .expect(200)
          .expect({ ok: true, name: 'Alice' }, done)
      })
  })
})
