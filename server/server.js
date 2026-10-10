require('dotenv').config()

const express = require('express')
const connectDB = require('./config/db')
const trailRoutes = require('./routes/trailRoutes')
const healthRoutes = require('./routes/healthRoutes')

const app = express()

app.use(express.json())
app.use('/api/trails', trailRoutes)
app.use('/api/health', healthRoutes)

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'TrailMate server is running',
  })
})

async function startServer() {
  try {
    await connectDB()

    const PORT = process.env.PORT || 5000
    app.listen(PORT, () => {
      console.log(`TrailMate server listening on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('TrailMate server could not start:', error.message)
    process.exitCode = 1
  }
}

startServer()
