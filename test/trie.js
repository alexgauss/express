'use strict'

var assert = require('node:assert')

describe('RadixTrie', function () {
  var RadixTrie

  before(function () {
    var mod = require('../dist/router/trie')
    RadixTrie = mod.RadixTrie
  })

  it('should match a static route', function () {
    var trie = new RadixTrie()
    var handler = function () {}
    trie.insert('/users', 'GET', [handler])

    var result = trie.lookup('/users', 'GET')
    assert.ok(result)
    assert.strictEqual(result.handlers.length, 1)
    assert.strictEqual(result.handlers[0], handler)
    assert.deepStrictEqual(result.params, {})
  })

  it('should not match a different method', function () {
    var trie = new RadixTrie()
    trie.insert('/users', 'GET', [function () {}])

    var result = trie.lookup('/users', 'POST')
    assert.ok(result)
    assert.strictEqual(result.handlers.length, 0)
  })

  it('should match multiple methods', function () {
    var trie = new RadixTrie()
    var getHandler = function () {}
    var postHandler = function () {}
    trie.insert('/users', 'GET', [getHandler])
    trie.insert('/users', 'POST', [postHandler])

    var getResult = trie.lookup('/users', 'GET')
    assert.strictEqual(getResult.handlers[0], getHandler)

    var postResult = trie.lookup('/users', 'POST')
    assert.strictEqual(postResult.handlers[0], postHandler)
  })

  it('should extract parameters', function () {
    var trie = new RadixTrie()
    trie.insert('/users/:id', 'GET', [function () {}])

    var result = trie.lookup('/users/42', 'GET')
    assert.ok(result)
    assert.strictEqual(result.params.id, '42')
  })

  it('should match multiple parameters', function () {
    var trie = new RadixTrie()
    trie.insert('/users/:userId/posts/:postId', 'GET', [function () {}])

    var result = trie.lookup('/users/abc/posts/xyz', 'GET')
    assert.ok(result)
    assert.strictEqual(result.params.userId, 'abc')
    assert.strictEqual(result.params.postId, 'xyz')
  })

  it('should match wildcard routes', function () {
    var trie = new RadixTrie()
    trie.insert('/files/*', 'GET', [function () {}])

    var result = trie.lookup('/files/some/deep/path', 'GET')
    assert.ok(result)
    assert.strictEqual(result.params['*'], 'some/deep/path')
  })

  it('should match ALL method handler', function () {
    var trie = new RadixTrie()
    var handler = function () {}
    trie.insert('/users', 'ALL', [handler])

    var getResult = trie.lookup('/users', 'GET')
    assert.strictEqual(getResult.handlers.length, 1)
    assert.strictEqual(getResult.handlers[0], handler)

    var postResult = trie.lookup('/users', 'POST')
    assert.strictEqual(postResult.handlers.length, 1)
    assert.strictEqual(postResult.handlers[0], handler)
  })

  it('should return null for non-matching routes', function () {
    var trie = new RadixTrie()
    trie.insert('/users', 'GET', [function () {}])

    var result = trie.lookup('/posts', 'GET')
    assert.strictEqual(result, null)
  })

  it('should match middleware prefix', function () {
    var trie = new RadixTrie()
    var mw = function () {}
    trie.insertMiddleware('/api', [mw])

    var result = trie.lookup('/api/users', 'GET')
    assert.ok(result)
    assert.strictEqual(result.middleware.length, 1)
    assert.strictEqual(result.middleware[0].handlers[0], mw)
  })

  it('should collect middleware from root', function () {
    var trie = new RadixTrie()
    var rootMw = function () {}
    trie.insertMiddleware('/', [rootMw])

    var result = trie.lookup('/any/path', 'GET')
    assert.ok(result)
    assert.strictEqual(result.middleware.length, 1)
  })

  it('should match parameter with static routes correctly (priority)', function () {
    var trie = new RadixTrie()
    var staticHandler = function () {}
    var paramHandler = function () {}
    trie.insert('/users/profile', 'GET', [staticHandler])
    trie.insert('/users/:id', 'GET', [paramHandler])

    var staticResult = trie.lookup('/users/profile', 'GET')
    assert.strictEqual(staticResult.handlers[0], staticHandler)

    var paramResult = trie.lookup('/users/42', 'GET')
    assert.strictEqual(paramResult.handlers[0], paramHandler)
  })

  it('should normalize trailing slashes', function () {
    var trie = new RadixTrie()
    trie.insert('/users', 'GET', [function () {}])

    var result = trie.lookup('/users/', 'GET')
    assert.ok(result)
  })

  it('should support ALL method alongside specific methods', function () {
    var trie = new RadixTrie()
    var allHandler = function () {}
    var getHandler = function () {}

    trie.insert('/users', 'ALL', [allHandler])
    trie.insert('/users', 'GET', [getHandler])

    var result = trie.lookup('/users', 'GET')
    assert.strictEqual(result.handlers.length, 2)
    assert.strictEqual(result.handlers[0], allHandler)
    assert.strictEqual(result.handlers[1], getHandler)
  })

  it('should handle deep nested routes', function () {
    var trie = new RadixTrie()
    var handler = function () {}
    trie.insert('/a/b/c/d/e', 'GET', [handler])

    var result = trie.lookup('/a/b/c/d/e', 'GET')
    assert.ok(result)
    assert.strictEqual(result.handlers.length, 1)
  })

  it('should not cross-contaminate params between routes', function () {
    var trie = new RadixTrie()
    trie.insert('/users/:id', 'GET', [function () {}])
    trie.insert('/posts/:title', 'GET', [function () {}])

    var result1 = trie.lookup('/users/42', 'GET')
    assert.strictEqual(result1.params.id, '42')
    assert.strictEqual(result1.params.title, undefined)

    var result2 = trie.lookup('/posts/hello-world', 'GET')
    assert.strictEqual(result2.params.title, 'hello-world')
    assert.strictEqual(result2.params.id, undefined)
  })
})
