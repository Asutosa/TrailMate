function getFirstCoordinate(element) {
  if (Array.isArray(element.geometry)) {
    const coordinate = element.geometry.find(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lon) &&
        point.lat >= -90 &&
        point.lat <= 90 &&
        point.lon >= -180 &&
        point.lon <= 180,
    )

    if (coordinate) {
      return {
        latitude: coordinate.lat,
        longitude: coordinate.lon,
      }
    }
  }

  if (
    Number.isFinite(element.lat) &&
    Number.isFinite(element.lon) &&
    element.lat >= -90 &&
    element.lat <= 90 &&
    element.lon >= -180 &&
    element.lon <= 180
  ) {
    return {
      latitude: element.lat,
      longitude: element.lon,
    }
  }

  return null
}

function getDifficulty(tags) {
  const difficulty = String(tags.difficulty || '').toLowerCase()

  if (['easy', 'green'].includes(difficulty)) {
    return 'easy'
  }

  if (['hard', 'difficult', 'red', 'black'].includes(difficulty)) {
    return 'hard'
  }

  if (['moderate', 'medium', 'intermediate', 'blue'].includes(difficulty)) {
    return 'moderate'
  }

  return 'moderate'
}

function getDistance(tags) {
  const distance = Number.parseFloat(String(tags.distance || tags.length || ''))
  return Number.isFinite(distance) && distance >= 0 ? distance : 0
}

function getEstimatedTime(tags) {
  const duration = Number.parseFloat(String(tags.duration || ''))
  return Number.isFinite(duration) && duration >= 0 ? duration : 0
}

function getLocation(tags) {
  return (
    tags['addr:city'] ||
    tags['addr:town'] ||
    tags['addr:village'] ||
    tags['addr:state'] ||
    tags.place ||
    'Unknown location'
  )
}

function getDescription(tags) {
  const parts = []

  if (tags.highway) {
    parts.push(`OSM ${tags.highway}`)
  }

  if (tags.route) {
    parts.push(`${tags.route} route`)
  }

  if (tags.surface) {
    parts.push(`with a ${tags.surface} surface`)
  }

  return parts.length > 0 ? parts.join(', ') : 'Trail data from OpenStreetMap.'
}

function getInterests(tags) {
  const interests = new Set()

  if (tags.highway === 'footway' || tags.route === 'walking') {
    interests.add('walking')
  }

  if (tags.highway === 'path' || tags.route === 'hiking') {
    interests.add('hiking')
  }

  if (tags.tourism) {
    interests.add('tourism')
  }

  if (tags.natural) {
    interests.add('nature')
  }

  return [...interests]
}

function mapOsmTrails(osmElements) {
  if (!Array.isArray(osmElements)) {
    return []
  }

  return osmElements.reduce((trails, element) => {
    const coordinate = getFirstCoordinate(element)

    if (!coordinate) {
      return trails
    }

    const tags = element.tags || {}

    trails.push({
      name: tags.name || 'Unnamed Trail',
      description: getDescription(tags),
      location: getLocation(tags),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      difficulty: getDifficulty(tags),
      distance: getDistance(tags),
      estimatedTime: getEstimatedTime(tags),
      interests: getInterests(tags),
    })

    return trails
  }, [])
}

module.exports = {
  mapOsmTrails,
}
