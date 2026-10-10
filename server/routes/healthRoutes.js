const express = require('express')
const { getOverpassHealth, getGemmaHealth } = require('../controllers/healthController')

const router = express.Router()

router.get('/overpass', getOverpassHealth)
router.get('/gemma', getGemmaHealth)

module.exports = router
