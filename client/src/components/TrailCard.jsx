function TrailCard({ trail, origin }) {
  const directionsUrl = origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${trail.latitude},${trail.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${trail.latitude},${trail.longitude}`

  return (
    <article className="trail-card">
      <div className="trail-card-heading">
        <h3>{trail.name}</h3>
        <span className="difficulty">{trail.type}</span>
      </div>
      <p className="trail-description">
        {trail.description}
      </p>
      <dl className="trail-details">
        <div>
          <dt>Distance</dt>
          <dd>{trail.distanceKm} km away</dd>
        </div>
      </dl>
      <a
        className="directions-button"
        href={directionsUrl}
        target="_blank"
        rel="noreferrer"
      >
        Get Directions
      </a>
    </article>
  )
}

export default TrailCard
