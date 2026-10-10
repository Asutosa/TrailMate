import { useState } from 'react'
import LocationForm from './components/LocationForm'
import TrailList from './components/TrailList'
import RecommendationPanel from './components/RecommendationPanel'
import { generateTrails } from './services/api'
import './App.css'

function App() {
  const [trails, setTrails] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchLocation, setSearchLocation] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [generationNumber, setGenerationNumber] = useState(0)

  async function handleGenerate(location) {
    setIsLoading(true)
    setError('')

    try {
      const result = await generateTrails(location)
      setTrails(result.places)
      setRecommendation(result.recommendation)
      setSearchLocation(location)
      setGenerationNumber((number) => number + 1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="page">
      <section className="control-panel">
        <header className="site-header">
          <a className="brand" href="/" aria-label="TrailMate home">
            <span className="brand-mark" aria-hidden="true">+</span>
            TrailMate
          </a>
          <span className="header-note">Find your way outside</span>
        </header>

        <div className="hero">
          <p className="eyebrow">Hacktoberfest 2026 · Week 1</p>
          <h1>Make room for<br /><em>the wild.</em></h1>
          <p className="tagline">
            Find a simple outdoor adventure near your chosen location.
          </p>
          <LocationForm onGenerate={handleGenerate} isLoading={isLoading} />
        </div>
      </section>

      <section className="results-panel" aria-live="polite">
        {error && <p className="request-error">{error}</p>}
        {!error && !recommendation && !isLoading && (
          <div className="discover-empty">
            <span className="discover-icon" aria-hidden="true">✦</span>
            <p className="section-kicker">Your next adventure</p>
            <h2>Find somewhere<br /><em>worth wandering.</em></h2>
            <p>Choose a location and your preferences to uncover outdoor places nearby.</p>
          </div>
        )}
        {isLoading && (
          <div className="loading-state">
            <span className="loading-dot" aria-hidden="true" />
            <p>Searching nearby places...</p>
          </div>
        )}
        {!isLoading && !error && recommendation && (
          <div className="results-content">
            <div className="recommendation-sticky">
              <RecommendationPanel recommendation={recommendation} />
            </div>
            <section className="results-section">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Explore nearby</p>
                  <h2>Your trail matches</h2>
                </div>
                {trails.length > 0 && <span className="result-count">{trails.length} places</span>}
              </div>
              <TrailList
                key={generationNumber}
                trails={trails}
                origin={searchLocation}
              />
            </section>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
