const Trail = require('../models/Trail')
const mongoose = require('mongoose')
const { getNearbyPlaces } = require('../services/openStreetMapService')
const { generateTrailRecommendation } = require('../services/gemmaService')

async function createTrail(req, res) {
  try {
    const trail = await Trail.create(req.body)
    res.status(201).json(trail)
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Trail validation failed',
        errors: error.errors,
      })
    }

    console.error('Error creating trail:', error.message)
    res.status(500).json({ message: 'Failed to create trail' })
  }
}

async function getTrails(_req, res) {
  try {
    const trails = await Trail.find()
    res.status(200).json(trails)
  } catch (error) {
    console.error('Error fetching trails:', error.message)
    res.status(500).json({ message: 'Failed to fetch trails' })
  }
}

async function generateTrails(req, res) {
  const {
    latitude,
    longitude,
    radius = 5,
    time,
    interest,
    difficulty,
  } = req.body

  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    ![1, 5, 10, 25, 50].includes(radius) ||
    !['30 minutes', '1 hour', '2 hours', '3+ hours'].includes(time) ||
    !['Nature', 'Walking', 'Photography', 'Wildlife', 'Relaxation', 'Exploration'].includes(interest) ||
    !['Easy', 'Moderate', 'Challenging'].includes(difficulty)
  ) {
    return res.status(400).json({
      message: 'Valid location, radius, time, interest, and difficulty are required',
    })
  }

  try {
    const places = await getNearbyPlaces(latitude, longitude, radius)

    if (places.length === 0) {
      return res.status(404).json({
        message: 'No nearby OpenStreetMap places found for this location',
      })
    }

    const recommendation = await generateTrailRecommendation(
      { latitude, longitude, time, interest, difficulty },
      places,
    )

    res.status(200).json({ places, recommendation })
  } catch (error) {
    console.error('Error fetching nearby places:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      message: 'Failed to fetch nearby places',
      error: error.message,
    })
  }
}

async function getTrailById(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid trail ID' })
  }

  try {
    const trail = await Trail.findById(req.params.id)

    if (!trail) {
      return res.status(404).json({ message: 'Trail not found' })
    }

    res.status(200).json(trail)
  } catch (error) {
    console.error('Error fetching trail:', error.message)
    res.status(500).json({ message: 'Failed to fetch trail' })
  }
}

async function updateTrail(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid trail ID' })
  }

  try {
    const trail = await Trail.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })

    if (!trail) {
      return res.status(404).json({ message: 'Trail not found' })
    }

    res.status(200).json(trail)
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Trail validation failed',
        errors: error.errors,
      })
    }

    console.error('Error updating trail:', error.message)
    res.status(500).json({ message: 'Failed to update trail' })
  }
}

async function deleteTrail(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid trail ID' })
  }

  try {
    const trail = await Trail.findByIdAndDelete(req.params.id)

    if (!trail) {
      return res.status(404).json({ message: 'Trail not found' })
    }

    res.status(200).json({ message: 'Trail deleted successfully' })
  } catch (error) {
    console.error('Error deleting trail:', error.message)
    res.status(500).json({ message: 'Failed to delete trail' })
  }
}

module.exports = {
  createTrail,
  getTrails,
  generateTrails,
  getTrailById,
  updateTrail,
  deleteTrail,
}
