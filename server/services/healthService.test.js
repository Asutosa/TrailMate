const assert = require('node:assert/strict')
const test = require('node:test')

const { getGemmaHealth, getOverpassHealth } = require('../controllers/healthController')

const originalFetch = global.fetch

test.afterEach(() => {
  global.fetch = originalFetch
})

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(value) {
      this.body = value
    },
  }
}

test('GET /api/health/overpass reports the endpoint that succeeds', async () => {
  const requestedUrls = []
  global.fetch = async (url) => {
    requestedUrls.push(url)
    return requestedUrls.length === 1
      ? response(503, {})
      : response(200, { elements: [] })
  }
  const result = responseRecorder()

  await getOverpassHealth({}, result)

  assert.equal(result.statusCode, 200)
  assert.equal(result.body.status, 'ok')
  assert.equal(result.body.endpoint, requestedUrls[1])
  assert.equal(requestedUrls.length, 2)
})

test('GET /api/health/gemma reports a successful model check', async () => {
  global.fetch = async (_url, options) => {
    const request = JSON.parse(options.body)
    assert.equal(request.model, 'gemma3:1b')
    assert.equal(request.prompt, 'Reply with the word OK.')
    return response(200, { response: 'OK' })
  }
  const result = responseRecorder()

  await getGemmaHealth({}, result)

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.body, { status: 'ok', model: 'gemma3:1b' })
})

test('health routes return concise failure status without response secrets', async () => {
  global.fetch = async () => response(500, {})
  const overpassResult = responseRecorder()
  const gemmaResult = responseRecorder()

  await getOverpassHealth({}, overpassResult)
  await getGemmaHealth({}, gemmaResult)

  assert.equal(overpassResult.statusCode, 503)
  assert.equal(gemmaResult.statusCode, 503)
  assert.equal(gemmaResult.body.statusCode, 500)
  assert.equal('response' in gemmaResult.body, false)
})
