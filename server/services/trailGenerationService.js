const Trail = require('../models/Trail')
const { getNearbyTrails } = require('./openStreetMapService')
const { mapOsmTrails } = require('./trailMapper')

async function generateTrails(latitude, longitude) {
  try {
    const osmElements = await getNearbyTrails(latitude, longitude)
    const mappedTrails = mapOsmTrails(osmElements)
    const uniqueTrails = []
    const trailKeys = new Set()

    for (const trail of mappedTrails) {
      const trailKey = `${trail.name}|${trail.latitude}|${trail.longitude}`

      if (!trailKeys.has(trailKey)) {
        trailKeys.add(trailKey)
        uniqueTrails.push(trail)
      }
    }

    if (uniqueTrails.length === 0) {
      return []
    }

    const existingTrails = await Trail.find({
      $or: uniqueTrails.map((trail) => ({
        name: trail.name,
        latitude: trail.latitude,
        longitude: trail.longitude,
      })),
    })

    const existingByKey = new Map(
      existingTrails.map((trail) => [
        `${trail.name}|${trail.latitude}|${trail.longitude}`,
        trail,
      ]),
    )
    const newTrails = uniqueTrails.filter((trail) => {
      const trailKey = `${trail.name}|${trail.latitude}|${trail.longitude}`
      return !existingByKey.has(trailKey)
    })

    let savedNewTrails = []

    if (newTrails.length > 0) {
      savedNewTrails = await Trail.insertMany(newTrails)
    }

    return [...existingTrails, ...savedNewTrails]
  } catch (error) {
    console.error('Error generating trails:', error.message)
    throw new Error('Unable to generate and save trails')
  }
}

module.exports = {
  generateTrails,
}
