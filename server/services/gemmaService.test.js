const assert = require('node:assert/strict')
const test = require('node:test')

const { generateTrailRecommendation } = require('./gemmaService')

const originalFetch = global.fetch

const nearbyPlaces = [{
  name: 'Pine Lake',
  type: 'lake',
  description: 'A relaxing outdoor spot.',
  latitude: 12,
  longitude: 34,
  distanceKm: 1.2,
}]

const validRecommendation = {
  title: 'Relax by the lake',
  selectedPlaces: [{ name: 'Pine Lake', reason: 'It suits a relaxing outing.' }],
  plan: ['Walk to the lake', 'Enjoy the scenery'],
  description: 'A calm outdoor break.',
  tips: ['Bring water'],
}

test.afterEach(() => {
  global.fetch = originalFetch
})

function mockGemmaResponses(responses) {
  let responseIndex = 0

  global.fetch = async () => ({
    ok: true,
    json: async () => ({ response: responses[responseIndex++] }),
  })
}

test('accepts correct structured Gemma JSON and enables Ollama JSON output', async () => {
  let request
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body)
    return {
      ok: true,
      json: async () => ({ response: JSON.stringify(validRecommendation) }),
    }
  }

  const recommendation = await generateTrailRecommendation({}, nearbyPlaces)

  assert.deepEqual(recommendation, validRecommendation)
  assert.equal(request.model, 'gemma3:1b')
  assert.equal(request.format, 'json')
  assert.equal(request.stream, false)
  assert.match(request.prompt, /Never return a nearbyPlaces item or a single place object/)
})

test('sends only a bounded set of necessary OSM place fields', async () => {
  let request
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body)
    return {
      ok: true,
      json: async () => ({ response: JSON.stringify(validRecommendation) }),
    }
  }

  const places = [
    nearbyPlaces[0],
    ...Array.from({ length: 11 }, (_, index) => ({
      ...nearbyPlaces[0],
      name: `Place ${index}`,
      extraInternalField: 'not sent',
    })),
  ]
  await generateTrailRecommendation({}, places)

  const promptPlaces = JSON.parse(request.prompt.match(/OpenStreetMap \(input only\):\n(\[.*\])\n/)[1])
  assert.equal(promptPlaces.length, 10)
  assert.deepEqual(Object.keys(promptPlaces[0]).sort(), [
    'description',
    'distanceKm',
    'latitude',
    'longitude',
    'name',
    'type',
  ])
})

test('parses valid Gemma JSON wrapped in a Markdown code fence', async () => {
  mockGemmaResponses([`\n\`\`\`json\n${JSON.stringify(validRecommendation)}\n\`\`\`\n`])

  const recommendation = await generateTrailRecommendation({}, nearbyPlaces)

  assert.deepEqual(recommendation, validRecommendation)
})

test('retries an invalid first response and accepts valid corrective JSON', async () => {
  const requestedPrompts = []
  global.fetch = async (_url, options) => {
    requestedPrompts.push(JSON.parse(options.body).prompt)
    return {
      ok: true,
      json: async () => ({
        response: requestedPrompts.length === 1
          ? '{"name":"Pine Lake"}'
          : JSON.stringify(validRecommendation),
      }),
    }
  }

  const recommendation = await generateTrailRecommendation({}, nearbyPlaces)

  assert.deepEqual(recommendation, validRecommendation)
  assert.equal(requestedPrompts.length, 2)
  assert.match(requestedPrompts[1], /"selectedPlaces":/)
})

test('retries a single-place object and uses fallback when both attempts fail', async () => {
  mockGemmaResponses(['{"name":"Pine Lake"}', '{"title":42}'])

  const recommendation = await generateTrailRecommendation(
    { interest: 'Relaxation' },
    nearbyPlaces,
  )

  assert.equal(recommendation.selectedPlaces[0].name, 'Pine Lake')
  assert.match(recommendation.title, /^Fallback plan/)
  assert.match(recommendation.description, /no AI-generated recommendation/)
})

test('rejects invented places and falls back to a supplied OSM place', async () => {
  mockGemmaResponses([
    JSON.stringify({
      ...validRecommendation,
      selectedPlaces: [{ name: 'Invented Peak', reason: 'It looks suitable.' }],
    }),
    JSON.stringify({
      ...validRecommendation,
      selectedPlaces: [{ name: 'Still Invented', reason: 'It looks suitable.' }],
    }),
  ])

  const recommendation = await generateTrailRecommendation({}, nearbyPlaces)

  assert.equal(recommendation.selectedPlaces[0].name, 'Pine Lake')
  assert.notEqual(recommendation.selectedPlaces[0].name, 'Invented Peak')
})
