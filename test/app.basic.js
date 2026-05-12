'use strict'

var assert = require('node:assert')
var request = require('supertest')

describe('app', function () {
  var express

  before(function () {
    express = require('..')
  })

  it('should return an express app', function () {
    var app = express()
    assert.strictEqual(typeof app, 'function')
    assert.strictEqual(typeof app.handle, 'function')
    assert.strictEqual(typeof app.listen, 'function')
    assert.strictEqual(typeof app.use, 'function')
    assert.strictEqual(typeof app.get, 'function')
    assert.strictEqual(typeof app.post, 'function')
  })

  it('should respond to GET requests', function (done) {
    var app = express()
    app.get('/hello', function (req, res) {
      res.send('world')
    })

    request(app)
      .get('/hello')
      .expect(200)
      .expect('world', done)
  })

  it('should respond to POST requests', function (done) {
    var app = express()
    app.post('/data', function (req, res) {
      res.status(201).send('created')
    })

    request(app)
      .post('/data')
      .expect(201)
      .expect('created', done)
  })

  it('should respond with 404 for unknown routes', function (done) {
    var app = express()
    app.get('/hello', function (req, res) {
      res.send('world')
    })

    request(app)
      .get('/unknown')
      .expect(404, done)
  })

  it('should support route parameters', function (done) {
    var app = express()
    app.get('/users/:id', function (req, res) {
      res.send('user ' + req.params.id)
    })

    request(app)
      .get('/users/42')
      .expect(200)
      .expect('user 42', done)
  })

  it('should support multiple route parameters', function (done) {
    var app = express()
    app.get('/users/:userId/posts/:postId', function (req, res) {
      res.send(req.params.userId + '-' + req.params.postId)
    })

    request(app)
      .get('/users/abc/posts/xyz')
      .expect(200)
      .expect('abc-xyz', done)
  })

  it('should support query parameters via req.query', function (done) {
    var app = express()
    app.get('/search', function (req, res) {
      res.send(req.query.q || 'empty')
    })

    request(app)
      .get('/search?q=hello')
      .expect(200)
      .expect('hello', done)
  })

  it('should support middleware via app.use', function (done) {
    var app = express()
    var called = false

    app.use(function (req, res, next) {
      called = true
      next()
    })

    app.get('/test', function (req, res) {
      res.send('ok')
    })

    request(app)
      .get('/test')
      .expect(200)
      .expect('ok', function (err) {
        if (err) return done(err)
        assert.ok(called)
        done()
      })
  })

  it('should support middleware at a specific path', function (done) {
    var app = express()

    app.use('/api', function (req, res, next) {
      req.api = true
      next()
    })

    app.get('/api/users', function (req, res) {
      res.send('api:' + !!req.api)
    })

    request(app)
      .get('/api/users')
      .expect(200)
      .expect('api:true', done)
  })

  it('should support the all method', function (done) {
    var app = express()
    app.all('/all', function (req, res) {
      res.send(req.method + ' ok')
    })

    request(app)
      .get('/all')
      .expect(200)
      .expect('GET ok', function () {
        request(app)
          .post('/all')
          .expect(200)
          .expect('POST ok', done)
      })
  })

  it('should support res.json', function (done) {
    var app = express()
    app.get('/json', function (req, res) {
      res.json({ msg: 'hello' })
    })

    request(app)
      .get('/json')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({ msg: 'hello' }, done)
  })

  it('should support res.status', function (done) {
    var app = express()
    app.get('/notfound', function (req, res) {
      res.status(404).send('not found')
    })

    request(app)
      .get('/notfound')
      .expect(404)
      .expect('not found', done)
  })

  it('should set X-Powered-By header', function (done) {
    var app = express()
    app.get('/powered', function (req, res) {
      res.send('ok')
    })

    request(app)
      .get('/powered')
      .expect('X-Powered-By', 'Express', done)
  })

  it('should support req.path', function (done) {
    var app = express()
    app.get('/path-test', function (req, res) {
      res.send(req.path)
    })

    request(app)
      .get('/path-test')
      .expect(200)
      .expect('/path-test', done)
  })

  it('should support the HEAD method', function (done) {
    var app = express()
    app.get('/head', function (req, res) {
      res.send('body')
    })

    request(app)
      .head('/head')
      .expect(200, done)
  })

  it('should support multiple handlers on the same route', function (done) {
    var app = express()
    var trace = []

    app.get('/multi', function (req, res, next) {
      trace.push('first')
      next()
    }, function (req, res) {
      trace.push('second')
      res.send(trace.join(','))
    })

    request(app)
      .get('/multi')
      .expect(200)
      .expect('first,second', done)
  })

  it('should support error handling middleware', function (done) {
    var app = express()

    app.get('/error', function (req, res, next) {
      next(new Error('boom'))
    })

    app.use(function (err, req, res, next) {
      res.status(500).send('caught: ' + err.message)
    })

    request(app)
      .get('/error')
      .expect(500)
      .expect('caught: boom', done)
  })

  it('should respond with 405 for wrong method (if route exists)', function (done) {
    var app = express()
    app.post('/only-post', function (req, res) {
      res.send('ok')
    })

    request(app)
      .get('/only-post')
      .expect(404, done)
  })

  it('should support res.redirect', function (done) {
    var app = express()
    app.get('/redirect-me', function (req, res) {
      res.redirect('/new-location')
    })

    request(app)
      .get('/redirect-me')
      .expect(302)
      .expect('Location', '/new-location', done)
  })

  it('should support res.cookie', function (done) {
    var app = express()
    app.get('/set-cookie', function (req, res) {
      res.cookie('name', 'value').send('ok')
    })

    request(app)
      .get('/set-cookie')
      .expect(200)
      .expect('Set-Cookie', /name=value/, done)
  })

  it('should work with async handlers', function (done) {
    var app = express()
    app.get('/async', async function (req, res) {
      await Promise.resolve()
      res.send('async ok')
    })

    request(app)
      .get('/async')
      .expect(200)
      .expect('async ok', done)
  })
})
