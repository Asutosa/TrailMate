const express = require('express')
const {
  createTrail,
  getTrails,
  generateTrails,
  getTrailById,
  updateTrail,
  deleteTrail,
} = require('../controllers/trailController')

const router = express.Router()

router.route('/').post(createTrail).get(getTrails)
router.post('/generate', generateTrails)
router.route('/:id').get(getTrailById).put(updateTrail).delete(deleteTrail)

module.exports = router
