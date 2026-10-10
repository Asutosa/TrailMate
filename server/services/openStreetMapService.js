const DEFAULT_OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter'
const FALLBACK_OVERPASS_API_URL = 'https://overpass.kumi.systems/api/interpreter'
const ADDITIONAL_FALLBACK_OVERPASS_API_URL = 'https://overpass.private.coffee/api/interpreter'
const MAILRU_FALLBACK_OVERPASS_API_URL = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
const DEFAULT_OVERPASS_REQUEST_TIMEOUT_MS = 30000
const OVERPASS_MAX_ATTEMPTS = 2
const DEFAULT_RADIUS_KM = 5
const TRAIL_SEARCH_RADIUS_METERS = 5000

function getOverpassUrls() {
  const primaryUrl = process.env.OVERPASS_API_URL || DEFAULT_OVERPASS_API_URL

  return [...new Set([
    primaryUrl,
    FALLBACK_OVERPASS_API_URL,
    ADDITIONAL_FALLBACK_OVERPASS_API_URL,
    MAILRU_FALLBACK_OVERPASS_API_URL,
  ])]
}

function getOverpassRequestTimeoutMs() {
  const configuredTimeout = Number.parseInt(process.env.OVERPASS_REQUEST_TIMEOUT_MS, 10)

  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_OVERPASS_REQUEST_TIMEOUT_MS
}

function isTransientOverpassFailure(error, response) {
  return error.name === 'AbortError' ||
    !response ||
    response.status === 429 ||
    response.status >= 500
}

async function requestOverpass(query) {
  let lastError

  for (const url of getOverpassUrls()) {
    for (let attempt = 1; attempt <= OVERPASS_MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController()
      const timeoutMs = getOverpassRequestTimeoutMs()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      let response

      try {
        response = await fetch(url, {
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
          throw new Error(`Overpass API returned HTTP ${response.status}`)
        }

        return await response.json()
      } catch (error) {
        lastError = error.name === 'AbortError'
          ? new Error(`Overpass API request timed out after ${timeoutMs}ms`)
          : error
        const status = typeof response?.status === 'number' ? ` HTTP ${response.status}` : ''
        const retrying = isTransientOverpassFailure(error, response) && attempt < OVERPASS_MAX_ATTEMPTS
        console.error(`Overpass request failed at ${url}${status} (attempt ${attempt}/${OVERPASS_MAX_ATTEMPTS})${retrying ? ', retrying' : ''}: ${lastError.message}`)

        if (!retrying) {
          break
        }
      } finally {
        clearTimeout(timeout)
      }
    }
  }

  throw lastError || new Error('Overpass API request failed')
}

async function getNearbyTrails(latitude, longitude) {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Valid latitude and longitude are required')
  }

  const query = `
    [out:json][timeout:25];
    (
      way["highway"~"path|footway|track"](around:${TRAIL_SEARCH_RADIUS_METERS},${latitude},${longitude});
      way["route"="hiking"](around:${TRAIL_SEARCH_RADIUS_METERS},${latitude},${longitude});
    );
    out geom;
  `

  try {
    const data = await requestOverpass(query)
    return data.elements
  } catch (error) {
    console.error('Error retrieving trail data from OpenStreetMap:', error.message)
    throw new Error('Unable to retrieve trail data from OpenStreetMap')
  }
}

function getPlaceType(tags) {
  if (tags.highway === 'path' || tags.highway === 'footway' || tags.route === 'hiking') {
    return 'trail'
  }

  if (tags.leisure === 'park') {
    return 'park'
  }

  if (tags.leisure === 'nature_reserve') {
    return 'nature reserve'
  }

  if (tags.tourism === 'viewpoint') {
    return 'viewpoint'
  }

  if (tags.natural === 'wood' || tags.natural === 'forest') {
    return 'forest'
  }

  if (tags.natural === 'water' || tags.natural === 'lake') {
    return 'lake'
  }

  return 'outdoor place'
}

function getElementCoordinates(element) {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return { latitude: element.lat, longitude: element.lon }
  }

  if (element.center && Number.isFinite(element.center.lat) && Number.isFinite(element.center.lon)) {
    return { latitude: element.center.lat, longitude: element.center.lon }
  }

  return null
}

function getPlaceDescription(type) {
  const descriptions = {
    viewpoint: 'Great for a short stop to enjoy the surrounding scenery and take photos.',
    park: 'A good option for a relaxed walk, open-air break, and casual exploration.',
    forest: 'Explore the natural surroundings on foot and look for interesting plants and wildlife.',
    'nature reserve': 'A peaceful place to experience local nature and observe wildlife.',
    lake: 'A relaxing outdoor spot to enjoy the water and surrounding scenery.',
    trail: 'A nearby path for walking and exploring the outdoors.',
  }

  return descriptions[type] || 'A nearby outdoor place to explore.'
}

function haversineDistance(latitude, longitude, placeLatitude, placeLongitude) {
  const earthRadiusKm = 6371
  const toRadians = (value) => (value * Math.PI) / 180
  const latitudeDifference = toRadians(placeLatitude - latitude)
  const longitudeDifference = toRadians(placeLongitude - longitude)
  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(latitude)) *
      Math.cos(toRadians(placeLatitude)) *
      Math.sin(longitudeDifference / 2) ** 2

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function getNearbyPlaces(latitude, longitude, radiusKm = DEFAULT_RADIUS_KM) {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    ![1, 5, 10, 25, 50].includes(radiusKm)
  ) {
    throw new Error('Valid latitude, longitude, and radius are required')
  }

  const radiusMeters = radiusKm * 1000
  const query = `
    [out:json][timeout:20];
    (
      nwr["highway"~"path|footway|track"](around:${radiusMeters},${latitude},${longitude});
      nwr["route"="hiking"](around:${radiusMeters},${latitude},${longitude});
      nwr["leisure"~"park|nature_reserve"](around:${radiusMeters},${latitude},${longitude});
      nwr["tourism"="viewpoint"](around:${radiusMeters},${latitude},${longitude});
      nwr["natural"~"wood|forest|water|lake"](around:${radiusMeters},${latitude},${longitude});
    );
    out tags center;
  `

  try {
    const data = await requestOverpass(query)
    const elements = Array.isArray(data.elements) ? data.elements : []
    let normalizedPlaceCount = 0
    let filteredPlaceCount = 0
    const places = elements.reduce((results, element) => {
      const coordinates = getElementCoordinates(element)

      if (!coordinates) {
        return results
      }

      const tags = element.tags || {}
      normalizedPlaceCount += 1
      const name = typeof tags.name === 'string' ? tags.name.trim() : ''

      if (!name || name.toLowerCase() === 'unknown place') {
        return results
      }

      filteredPlaceCount += 1
      const type = getPlaceType(tags)

      results.push({
        name,
        type,
        description: getPlaceDescription(type),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        distanceKm: Number(
          haversineDistance(
            latitude,
            longitude,
            coordinates.latitude,
            coordinates.longitude,
          ).toFixed(2),
        ),
      })

      return results
    }, [])

    console.info(
      `OpenStreetMap nearby places: raw elements=${elements.length}, normalized places=${normalizedPlaceCount}, filtered places=${filteredPlaceCount}`,
    )

    return places.sort((first, second) => first.distanceKm - second.distanceKm)
  } catch (error) {
    console.error('Error retrieving nearby places from OpenStreetMap:', error.message)
    throw new Error('Unable to retrieve nearby places from OpenStreetMap')
  }
}

module.exports = {
  getNearbyTrails,
  getNearbyPlaces,
}
