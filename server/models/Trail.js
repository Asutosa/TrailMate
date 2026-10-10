const mongoose = require('mongoose')

const trailSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    difficulty: {
      type: String,
      required: true,
      enum: ['easy', 'moderate', 'hard'],
      lowercase: true,
      trim: true,
    },
    distance: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedTime: {
      type: Number,
      required: true,
      min: 0,
    },
    interests: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model('Trail', trailSchema)
