const assert = require('node:assert/strict')
const test = require('node:test')

const { getNearbyPlaces } = require('./openStreetMapService')

const originalFetch = global.fetch
const originalOverpassUrl = process.env.OVERPASS_API_URL

test.afterEach(() => {
  global.fetch = originalFetch

  if (originalOverpassUrl === undefined) {
    delete process.env.OVERPASS_API_URL
  } else {
    process.env.OVERPASS_API_URL = originalOverpassUrl
  }
})

test('returns named places from a successful response and uses the next endpoint after retries', async () => {
  process.env.OVERPASS_API_URL = 'https://primary.example/api/interpreter'
  const requestedUrls = []
  let requestCount = 0

  global.fetch = async (url, options) => {
    requestedUrls.push(url)
    requestCount += 1

    if (requestCount <= 2) {
      return { ok: false, status: 500 }
    }

    const query = String(options.body.get('data'))
    assert.match(query, /nwr\["leisure"~"park\|nature_reserve"\]/)
    assert.doesNotMatch(query, /nwr\["name"\]/)
    assert.match(query, /out tags center;/)

    return {
      ok: true,
      json: async () => ({
        elements: [{
          type: 'node',
          lat: 12,
          lon: 34,
          tags: { name: 'Fallback Park', leisure: 'park' },
        }],
      }),
    }
  }

  const places = await getNearbyPlaces(12, 34, 1)

  assert.deepEqual(requestedUrls, [
    'https://primary.example/api/interpreter',
    'https://primary.example/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ])
  assert.equal(places[0].name, 'Fallback Park')
})

test('keeps named-place filtering after receiving unnamed OSM elements', async () => {
  process.env.OVERPASS_API_URL = 'https://primary.example/api/interpreter'

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      elements: [
        {
          type: 'node',
          lat: 12,
          lon: 34,
          tags: { leisure: 'park' },
        },
        {
          type: 'node',
          lat: 12.001,
          lon: 34.001,
          tags: { name: 'Named Park', leisure: 'park' },
        },
      ],
    }),
  })

  const places = await getNearbyPlaces(12, 34, 1)

  assert.deepEqual(places.map((place) => place.name), ['Named Park'])
})

test('returns an empty list when OSM has no named places', async () => {
  process.env.OVERPASS_API_URL = 'https://primary.example/api/interpreter'

  global.fetch = async () => ({
    ok: true,
    json: async () => ({ elements: [] }),
  })

  const places = await getNearbyPlaces(12, 34, 1)

  assert.deepEqual(places, [])
})

test('moves on after a timeout and does not treat it as an empty result', async () => {
  process.env.OVERPASS_API_URL = 'https://timeout.example/api/interpreter'
  const requestedUrls = []

  global.fetch = async (url) => {
    requestedUrls.push(url)
    const error = new Error('request aborted')
    error.name = 'AbortError'
    throw error
  }

  await assert.rejects(
    () => getNearbyPlaces(12, 34, 1),
    { message: 'Unable to retrieve nearby places from OpenStreetMap' },
  )
  assert.equal(requestedUrls.length, 8)
})

test('throws a clear error when every Overpass endpoint fails', async () => {
  process.env.OVERPASS_API_URL = 'https://primary.example/api/interpreter'
  const requestedUrls = []

  global.fetch = async (url) => {
    requestedUrls.push(url)
    throw new Error('connection refused')
  }

  await assert.rejects(
    () => getNearbyPlaces(12, 34, 1),
    { message: 'Unable to retrieve nearby places from OpenStreetMap' },
  )

  assert.deepEqual(requestedUrls, [
    'https://primary.example/api/interpreter',
    'https://primary.example/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ])
})
