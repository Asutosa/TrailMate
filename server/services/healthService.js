const OVERPASS_URLS = [
  process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
const OVERPASS_HEALTH_TIMEOUT_MS = 15000
const GEMMA_API_URL = process.env.GEMMA_API_URL || 'http://127.0.0.1:11434/api/generate'
const GEMMA_MODEL = 'gemma3:1b'
const GEMMA_HEALTH_TIMEOUT_MS = 15000

function uniqueUrls(urls) {
  return [...new Set(urls)]
}

function safeEndpoint(endpoint) {
  try {
    const url = new URL(endpoint)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return '[configured endpoint]'
  }
}

async function checkOverpassHealth() {
  const query = '[out:json][timeout:5];node(0,0,0.001,0.001);out 1;'
  const failures = []

  for (const endpoint of uniqueUrls(OVERPASS_URLS)) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OVERPASS_HEALTH_TIMEOUT_MS)
    let response

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'TrailMate/1.0',
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      })

      if (!response.ok) {
        failures.push({ endpoint: safeEndpoint(endpoint), status: response.status })
        continue
      }

      await response.json()
      return { status: 'ok', endpoint: safeEndpoint(endpoint) }
    } catch (error) {
      failures.push({
        endpoint: safeEndpoint(endpoint),
        error: error.name === 'AbortError' ? 'timeout' : 'request failed',
        ...(typeof response?.status === 'number' ? { status: response.status } : {}),
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  return { status: 'error', error: 'All Overpass endpoints failed', failures }
}

async function checkGemmaHealth() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMMA_HEALTH_TIMEOUT_MS)

  try {
    const response = await fetch(GEMMA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GEMMA_MODEL,
        prompt: 'Reply with the word OK.',
        stream: false,
        options: { temperature: 0 },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      return { status: 'error', model: GEMMA_MODEL, statusCode: response.status }
    }

    const data = await response.json()

    if (typeof data.response !== 'string') {
      return { status: 'error', model: GEMMA_MODEL, error: 'Ollama returned no generated response' }
    }

    return { status: 'ok', model: GEMMA_MODEL }
  } catch (error) {
    return {
      status: 'error',
      model: GEMMA_MODEL,
      error: error.name === 'AbortError' ? 'timeout' : 'connection failed',
    }
  } finally {
    clearTimeout(timeout)
  }
}

module.exports = {
  checkOverpassHealth,
  checkGemmaHealth,
}
