const mongoose = require('mongoose')

async function connectDB() {
  const { MONGODB_URI } = process.env

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in the environment')
  }

  try {
    await mongoose.connect(MONGODB_URI)
    console.log('MongoDB connected successfully')
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    throw error
  }
}

module.exports = connectDB
