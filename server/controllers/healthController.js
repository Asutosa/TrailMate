const { checkOverpassHealth, checkGemmaHealth } = require('../services/healthService')

async function getOverpassHealth(_req, res) {
  const result = await checkOverpassHealth()
  res.status(result.status === 'ok' ? 200 : 503).json(result)
}

async function getGemmaHealth(_req, res) {
  const result = await checkGemmaHealth()
  res.status(result.status === 'ok' ? 200 : 503).json(result)
}

module.exports = {
  getOverpassHealth,
  getGemmaHealth,
}
