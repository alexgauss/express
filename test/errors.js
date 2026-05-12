'use strict'

var assert = require('node:assert')

describe('HttpError', function () {
  var errors

  before(function () {
    errors = require('../dist/errors/index')
  })

  it('should create a basic HTTP error', function () {
    var err = new errors.HttpError(404, 'Not found')
    assert.strictEqual(err.statusCode, 404)
    assert.strictEqual(err.message, 'Not found')
    assert.strictEqual(err.name, 'HttpError')
    assert.ok(err.expose)
  })

  it('should hide details for 5xx errors', function () {
    var err = new errors.HttpError(500)
    assert.strictEqual(err.expose, false)
  })

  it('should create NotFoundError', function () {
    var err = new errors.NotFoundError('User', '42')
    assert.strictEqual(err.statusCode, 404)
    assert.strictEqual(err.message, 'User "42" not found')
    assert.strictEqual(err.name, 'NotFoundError')
  })

  it('should create NotFoundError without arguments', function () {
    var err = new errors.NotFoundError()
    assert.strictEqual(err.message, 'Not found')
  })

  it('should create BadRequestError', function () {
    var err = new errors.BadRequestError('Invalid input')
    assert.strictEqual(err.statusCode, 400)
    assert.strictEqual(err.message, 'Invalid input')
  })

  it('should create UnauthorizedError', function () {
    var err = new errors.UnauthorizedError()
    assert.strictEqual(err.statusCode, 401)
    assert.strictEqual(err.message, 'Unauthorized')
  })

  it('should create ForbiddenError', function () {
    var err = new errors.ForbiddenError()
    assert.strictEqual(err.statusCode, 403)
  })

  it('should create ConflictError', function () {
    var err = new errors.ConflictError('Already exists')
    assert.strictEqual(err.statusCode, 409)
  })

  it('should create ValidationError with issues', function () {
    var issues = [{ message: 'Name is required', path: ['name'] }]
    var err = new errors.ValidationError(issues)
    assert.strictEqual(err.statusCode, 400)
    assert.strictEqual(err.issues, issues)
  })

  it('should create TooManyRequestsError', function () {
    var err = new errors.TooManyRequestsError(30)
    assert.strictEqual(err.statusCode, 429)
    assert.strictEqual(err.retryAfter, 30)
  })

  it('should create TooManyRequestsError with default', function () {
    var err = new errors.TooManyRequestsError()
    assert.strictEqual(err.retryAfter, 60)
  })

  it('should create InternalServerError', function () {
    var err = new errors.InternalServerError('Boom')
    assert.strictEqual(err.statusCode, 500)
    assert.strictEqual(err.expose, false)
  })

  it('should carry details on HttpError', function () {
    var err = new errors.HttpError(400, 'Validation failed', { field: 'email' })
    assert.deepStrictEqual(err.details, { field: 'email' })
  })
})
