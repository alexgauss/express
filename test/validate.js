'use strict'

var assert = require('node:assert')
var request = require('supertest')

describe('validate middleware', function () {
  var express
  var v

  before(function () {
    express = require('..')
    v = require('valibot')
  })

  function makeStandardSchema(schema) {
    var wrapped = v.pipe ? schema : schema
    return {
      '~standard': {
        version: 1,
        vendor: 'valibot',
        validate: function (input) {
          try {
            var result = v.parse(wrapped, input)
            return { value: result }
          } catch (e) {
            var issues = []
            if (e.issues) {
              for (var i = 0; i < e.issues.length; i++) {
                issues.push({ message: e.issues[i].message })
              }
            }
            return { issues: issues }
          }
        }
      }
    }
  }

  it('should validate body and pass', function (done) {
    var app = express()
    app.use(express.json())

    var schema = makeStandardSchema(v.object({
      name: v.pipe(v.string(), v.minLength(2)),
      age: v.pipe(v.number(), v.minValue(0))
    }))

    app.post('/test',
      require('../dist/middleware/validate').validate({ body: schema }),
      function (req, res) {
        res.ok({ name: req.body.name, age: req.body.age })
      }
    )

    request(app)
      .post('/test')
      .send({ name: 'Alice', age: 30 })
      .expect(200)
      .expect({ name: 'Alice', age: 30 }, done)
  })

  it('should reject invalid body', function (done) {
    var app = express()
    app.use(express.json())

    var schema = makeStandardSchema(v.object({
      name: v.pipe(v.string(), v.minLength(2))
    }))

    app.post('/test',
      require('../dist/middleware/validate').validate({ body: schema }),
      function (req, res) {
        res.ok({ name: req.body.name })
      }
    )

    request(app)
      .post('/test')
      .send({ name: 'A' })
      .expect(400, done)
  })

  it('should validate params', function (done) {
    var app = express()

    var schema = makeStandardSchema(v.object({
      id: v.pipe(v.string(), v.minLength(1))
    }))

    app.get('/users/:id',
      require('../dist/middleware/validate').validate({ params: schema }),
      function (req, res) {
        res.ok({ id: req.params.id })
      }
    )

    request(app)
      .get('/users/42')
      .expect(200)
      .expect({ id: '42' }, done)
  })

  it('should skip validation when schema is not provided', function (done) {
    var app = express()
    app.use(express.json())

    app.post('/test',
      require('../dist/middleware/validate').validate({}),
      function (req, res) {
        res.ok({ ok: true })
      }
    )

    request(app)
      .post('/test')
      .send({ foo: 'bar' })
      .expect(200)
      .expect({ ok: true }, done)
  })
})
