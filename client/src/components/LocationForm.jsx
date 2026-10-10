import { useState } from 'react'

function LocationForm({ onGenerate, isLoading }) {
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [radius, setRadius] = useState('5')
  const [time, setTime] = useState('1 hour')
  const [interest, setInterest] = useState('Nature')
  const [difficulty, setDifficulty] = useState('Easy')
  const [error, setError] = useState('')

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }

    setError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude))
        setLongitude(String(position.coords.longitude))
      },
      (locationError) => {
        const messages = {
          1: 'Location permission was denied.',
          2: 'Your location is unavailable.',
          3: 'Location request timed out.',
        }

        setError(messages[locationError.code] || 'Unable to get your location.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    )
  }

  function handleSubmit(event) {
    event.preventDefault()

    const parsedLatitude = Number(latitude)
    const parsedLongitude = Number(longitude)

    if (
      !Number.isFinite(parsedLatitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90 ||
      !Number.isFinite(parsedLongitude) ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      setError('Enter a valid latitude and longitude.')
      return
    }

    setError('')
    onGenerate({
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      radius: Number(radius),
      time,
      interest,
      difficulty,
    })
  }

  return (
    <form className="location-form" onSubmit={handleSubmit}>
      <div className="form-fields">
        <label>
          Latitude
          <input
            type="number"
            min="-90"
            max="90"
            step="any"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            placeholder="25.028"
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            min="-180"
            max="180"
            step="any"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            placeholder="85.420"
          />
        </label>
        <label>
          Search radius
          <select value={radius} onChange={(event) => setRadius(event.target.value)}>
            <option value="1">1 km</option>
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="25">25 km</option>
            <option value="50">50 km</option>
          </select>
        </label>
        <label>
          Available time
          <select value={time} onChange={(event) => setTime(event.target.value)}>
            <option value="30 minutes">30 minutes</option>
            <option value="1 hour">1 hour</option>
            <option value="2 hours">2 hours</option>
            <option value="3+ hours">3+ hours</option>
          </select>
        </label>
        <label>
          Interest
          <select value={interest} onChange={(event) => setInterest(event.target.value)}>
            <option>Nature</option>
            <option>Walking</option>
            <option>Photography</option>
            <option>Wildlife</option>
            <option>Relaxation</option>
            <option>Exploration</option>
          </select>
        </label>
        <label>
          Difficulty
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option>Easy</option>
            <option>Moderate</option>
            <option>Challenging</option>
          </select>
        </label>
      </div>
      <button
        className="location-button"
        type="button"
        onClick={handleUseMyLocation}
        disabled={isLoading}
      >
        Use My Location
      </button>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Finding trails...' : 'Generate Trails'}
      </button>
      {error && <p className="form-error">{error}</p>}
    </form>
  )
}

export default LocationForm
