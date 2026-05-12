'use strict'

var assert = require('node:assert')
var request = require('supertest')

describe('logger', function () {
  var express

  before(function () {
    express = require('..')
  })

  it('should log requests in dev format', function (done) {
    var app = express()
    var logs = []

    app.use(express.logger({
      format: 'dev',
      stream: { write: function (s) { logs.push(s) } }
    }))

    app.get('/test', function (req, res) {
      res.send('ok')
    })

    request(app)
      .get('/test')
      .expect(200, function (err) {
        if (err) return done(err)
        assert.ok(logs.length > 0)
        assert.ok(logs[0].includes('GET'))
        assert.ok(logs[0].includes('/test'))
        assert.ok(logs[0].includes('200'))
        done()
      })
  })

  it('should log in JSON format', function (done) {
    var app = express()
    var logs = []

    app.use(express.logger({
      format: 'json',
      stream: { write: function (s) { logs.push(s) } }
    }))

    app.get('/json', function (req, res) {
      res.json({ ok: true })
    })

    request(app)
      .get('/json')
      .expect(200, function (err) {
        if (err) return done(err)
        var entry = JSON.parse(logs[0])
        assert.strictEqual(entry.method, 'GET')
        assert.strictEqual(entry.url, '/json')
        assert.strictEqual(entry.status, 200)
        assert.ok(entry.duration >= 0)
        assert.ok(entry.timestamp)
        done()
      })
  })

  it('should skip filtered requests', function (done) {
    var app = express()
    var logs = []

    app.use(express.logger({
      format: 'json',
      skip: function (req) { return req.url === '/skip' },
      stream: { write: function (s) { logs.push(s) } }
    }))

    app.get('/skip', function (req, res) {
      res.send('skipped')
    })

    request(app)
      .get('/skip')
      .expect(200, function (err) {
        if (err) return done(err)
        assert.strictEqual(logs.length, 0)
        done()
      })
  })

  it('should generate request IDs', function (done) {
    var app = express()

    app.use(express.requestId())

    app.get('/id', function (req, res) {
      res.json({ id: req.requestId })
    })

    request(app)
      .get('/id')
      .expect(200)
      .expect(function (res) {
        assert.ok(res.body.id)
        assert.ok(typeof res.body.id === 'string')
        assert.ok(res.headers['x-request-id'])
      })
      .end(done)
  })

  it('should preserve existing X-Request-Id', function (done) {
    var app = express()

    app.use(express.requestId())

    app.get('/id', function (req, res) {
      res.json({ id: req.requestId })
    })

    request(app)
      .get('/id')
      .set('X-Request-Id', 'custom-id')
      .expect(200)
      .expect(function (res) {
        assert.strictEqual(res.body.id, 'custom-id')
      })
      .end(done)
  })
})
