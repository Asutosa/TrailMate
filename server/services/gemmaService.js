const GEMMA_API_URL = process.env.GEMMA_API_URL || 'http://127.0.0.1:11434/api/generate'
const GEMMA_MODEL = process.env.GEMMA_MODEL || 'gemma3:1b'
const GEMMA_REQUEST_TIMEOUT_MS = 120000
const MAX_GEMMA_PLACES = 10
const RECOMMENDATION_SCHEMA = `{
  "title": "string",
  "selectedPlaces": [
    { "name": "exact supplied place name", "reason": "string" }
  ],
  "plan": ["string"],
  "description": "string",
  "tips": ["string"]
}`

function getGemmaPlaces(nearbyPlaces) {
  return nearbyPlaces.slice(0, MAX_GEMMA_PLACES).map((place) => ({
    name: place.name,
    type: place.type,
    description: place.description,
    latitude: place.latitude,
    longitude: place.longitude,
    distanceKm: place.distanceKm,
  }))
}

function buildPrompt(userPreferences, nearbyPlaces) {
  const gemmaPlaces = getGemmaPlaces(nearbyPlaces)

  return `You are TrailMate's local outdoor recommendation engine.

INPUT: The nearbyPlaces array below contains real places from OpenStreetMap. Use only their exact name values in selectedPlaces.
OUTPUT: Return exactly one recommendation JSON object. Never return a nearbyPlaces item or a single place object such as {"name":"...","type":"...","latitude":...}. Never invent, rename, or add places.
The output must contain all five fields: title and description are strings; selectedPlaces is an array of objects with string name and reason; plan and tips are arrays of strings.
Return only the JSON object with no Markdown fences, explanation, or surrounding commentary:
${RECOMMENDATION_SCHEMA}

User preferences:
${JSON.stringify(userPreferences, null, 2)}

Nearby places from OpenStreetMap (input only):
${JSON.stringify(gemmaPlaces)}
`
}

function buildCorrectionPrompt(userPreferences, nearbyPlaces) {
  const gemmaPlaces = getGemmaPlaces(nearbyPlaces)

  return `Your previous response did not match the required recommendation schema. It must not be a single place object.

Return exactly one concise JSON recommendation object with no Markdown or commentary.
Required output schema:
${RECOMMENDATION_SCHEMA}

Every selectedPlaces.name must exactly match a name in the OpenStreetMap input below. Never invent or rename a place.

User preferences:
${JSON.stringify(userPreferences, null, 2)}

OpenStreetMap nearbyPlaces input:
${JSON.stringify(gemmaPlaces)}
`
}

function getSafeResponseForLogging(rawResponse) {
  return String(rawResponse)
    .replace(/(["']?(?:api[_-]?key|token|password|secret)["']?\s*[:=]\s*["'])[^"']+(["'])/gi, '$1[REDACTED]$2')
    .replace(/\s+/g, ' ')
    .slice(0, 300)
}

function parseRecommendation(rawResponse) {
  if (typeof rawResponse !== 'string') {
    throw new Error('Gemma response was missing a text response')
  }

  const trimmedResponse = rawResponse.trim()
  const fencedResponse = trimmedResponse.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const jsonResponse = (fencedResponse ? fencedResponse[1] : trimmedResponse).trim()

  try {
    return JSON.parse(jsonResponse)
  } catch {
    throw new Error('Gemma returned malformed JSON')
  }
}

function validateRecommendation(recommendation, nearbyPlaces) {
  if (!recommendation || typeof recommendation !== 'object' || Array.isArray(recommendation)) {
    throw new Error('Gemma recommendation validation failed: response must be a JSON object')
  }

  const requiredFields = [
    ['title', 'a string', typeof recommendation.title === 'string'],
    ['selectedPlaces', 'an array', Array.isArray(recommendation.selectedPlaces)],
    ['plan', 'an array', Array.isArray(recommendation.plan)],
    ['description', 'a string', typeof recommendation.description === 'string'],
    ['tips', 'an array', Array.isArray(recommendation.tips)],
  ]
  const missingField = requiredFields.find(([, , isValid]) => !isValid)

  if (missingField) {
    throw new Error(`Gemma recommendation validation failed: "${missingField[0]}" must be ${missingField[1]}`)
  }

  if (!recommendation.title.trim()) {
    throw new Error('Gemma recommendation validation failed: "title" must not be empty')
  }

  if (!recommendation.description.trim()) {
    throw new Error('Gemma recommendation validation failed: "description" must not be empty')
  }

  if (recommendation.selectedPlaces.length === 0) {
    throw new Error('Gemma recommendation validation failed: "selectedPlaces" must contain at least one place')
  }

  if (recommendation.plan.some((step) => typeof step !== 'string' || !step.trim())) {
    throw new Error('Gemma recommendation validation failed: every "plan" item must be a non-empty string')
  }

  if (recommendation.tips.some((tip) => typeof tip !== 'string' || !tip.trim())) {
    throw new Error('Gemma recommendation validation failed: every "tips" item must be a non-empty string')
  }

  const placesByName = new Map(
    nearbyPlaces.map((place) => [place.name.trim().toLowerCase(), place.name]),
  )

  const selectedPlaces = recommendation.selectedPlaces.map((selectedPlace) => {
    if (
      !selectedPlace ||
      typeof selectedPlace.name !== 'string' ||
      typeof selectedPlace.reason !== 'string'
    ) {
      throw new Error('Gemma returned an invalid selected place')
    }

    const exactName = placesByName.get(selectedPlace.name.trim().toLowerCase())

    if (!exactName) {
      throw new Error(`Gemma recommended a place not supplied by OpenStreetMap: ${selectedPlace.name}`)
    }

    return {
      name: exactName,
      reason: selectedPlace.reason.trim(),
    }
  })

  return {
    title: recommendation.title.trim(),
    selectedPlaces,
    plan: recommendation.plan.filter((step) => typeof step === 'string').map((step) => step.trim()),
    description: recommendation.description.trim(),
    tips: recommendation.tips.filter((tip) => typeof tip === 'string').map((tip) => tip.trim()),
  }
}

function buildFallbackRecommendation(userPreferences, nearbyPlaces) {
  const place = nearbyPlaces[0]
  const type = place.type || 'outdoor place'
  const interest = userPreferences.interest || 'outdoor exploration'

  return {
    title: `Fallback plan for ${place.name}`,
    selectedPlaces: [{
      name: place.name,
      reason: `${place.name} is a nearby ${type} suitable for ${interest.toLowerCase()}.`,
    }],
    plan: [
      `Travel to ${place.name}.`,
      `Spend time enjoying this ${type}.`,
      'Return when you are ready.',
    ],
    description: `Fallback recommendation based on the supplied OpenStreetMap place; no AI-generated recommendation was used.`,
    tips: ['Bring water and follow local outdoor guidance.'],
  }
}

async function requestGemma(prompt) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMMA_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(GEMMA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GEMMA_MODEL,
        prompt,
        format: 'json',
        stream: false,
        options: {
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Gemma runtime returned HTTP ${response.status}`)
    }

    const data = await response.json()
    return data && data.response
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Gemma request timed out')
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function generateTrailRecommendation(userPreferences, nearbyPlaces) {
  if (!Array.isArray(nearbyPlaces) || nearbyPlaces.length === 0) {
    throw new Error('Gemma recommendation unavailable: no OpenStreetMap places are available for a fallback')
  }

  let firstError = null
  let lastResponse = ''
  const prompts = [
    buildPrompt(userPreferences, nearbyPlaces),
    buildCorrectionPrompt(userPreferences, nearbyPlaces),
  ]

  for (const [attempt, prompt] of prompts.entries()) {
    try {
      lastResponse = await requestGemma(prompt)
      const recommendation = parseRecommendation(lastResponse)
      return validateRecommendation(recommendation, nearbyPlaces)
    } catch (error) {
      if (attempt === 0) {
        firstError = error
      }

      console.error(
        `Gemma attempt ${attempt + 1} failed: ${error.message}. Response preview: ${getSafeResponseForLogging(lastResponse)}`,
      )
    }
  }

  console.error(`Using OSM-only fallback after Gemma attempts failed: ${firstError.message}`)
  return buildFallbackRecommendation(userPreferences, nearbyPlaces)
}

module.exports = {
  generateTrailRecommendation,
}
