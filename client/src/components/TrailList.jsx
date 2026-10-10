import { useState } from 'react'
import TrailCard from './TrailCard'

function TrailList({ trails, origin }) {
  const [visibleCount, setVisibleCount] = useState(10)

  if (trails.length === 0) {
    return <p className="empty-state">No trails yet. Enter a location to begin.</p>
  }

  return (
    <section className="trail-list" aria-label="Available trails">
      {trails.slice(0, visibleCount).map((trail) => (
        <TrailCard
          key={trail._id || `${trail.name}-${trail.latitude}-${trail.longitude}`}
          trail={trail}
          origin={origin}
        />
      ))}
      {visibleCount < trails.length && (
        <button
          className="load-more-button"
          type="button"
          onClick={() => setVisibleCount((count) => count + 10)}
        >
          Load More
        </button>
      )}
    </section>
  )
}

export default TrailList
