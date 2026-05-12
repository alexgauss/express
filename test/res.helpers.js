'use strict'

var assert = require('node:assert')
var request = require('supertest')

describe('res helpers', function () {
  var express

  before(function () {
    express = require('..')
  })

  it('res.ok() should send 200', function (done) {
    var app = express()
    app.get('/test', function (req, res) {
      res.ok({ message: 'ok' })
    })
    request(app)
      .get('/test')
      .expect(200)
      .expect({ message: 'ok' }, done)
  })

  it('res.created() should send 201', function (done) {
    var app = express()
    app.post('/items', function (req, res) {
      res.created({ id: 1 })
    })
    request(app)
      .post('/items')
      .expect(201)
      .expect({ id: 1 }, done)
  })

  it('res.noContent() should send 204', function (done) {
    var app = express()
    app.delete('/items/1', function (req, res) {
      res.noContent()
    })
    request(app)
      .delete('/items/1')
      .expect(204, done)
  })

  it('res.badRequest() should send 400', function (done) {
    var app = express()
    app.get('/test', function (req, res) {
      res.badRequest([{ field: 'name', message: 'required' }])
    })
    request(app)
      .get('/test')
      .expect(400)
      .expect(function (res) {
        assert.strictEqual(res.body.error, 'Bad request')
        assert.ok(res.body.details)
      })
      .end(done)
  })

  it('res.unauthorized() should send 401', function (done) {
    var app = express()
    app.get('/admin', function (req, res) {
      res.unauthorized()
    })
    request(app)
      .get('/admin')
      .expect(401)
      .expect({ error: 'Unauthorized' }, done)
  })

  it('res.forbidden() should send 403', function (done) {
    var app = express()
    app.get('/secret', function (req, res) {
      res.forbidden()
    })
    request(app)
      .get('/secret')
      .expect(403, done)
  })

  it('res.notFound() should send 404', function (done) {
    var app = express()
    app.get('/missing', function (req, res) {
      res.notFound('User not found')
    })
    request(app)
      .get('/missing')
      .expect(404)
      .expect({ error: 'User not found' }, done)
  })

  it('res.conflict() should send 409', function (done) {
    var app = express()
    app.get('/conflict', function (req, res) {
      res.conflict()
    })
    request(app)
      .get('/conflict')
      .expect(409, done)
  })

  it('res.tooManyRequests() should send 429 with Retry-After', function (done) {
    var app = express()
    app.get('/ratelimited', function (req, res) {
      res.tooManyRequests(30)
    })
    request(app)
      .get('/ratelimited')
      .expect(429)
      .expect('Retry-After', '30', done)
  })

  it('res.error() should send custom status', function (done) {
    var app = express()
    app.get('/custom', function (req, res) {
      res.error(418, "I'm a teapot")
    })
    request(app)
      .get('/custom')
      .expect(418)
      .expect({ error: "I'm a teapot" }, done)
  })
})
