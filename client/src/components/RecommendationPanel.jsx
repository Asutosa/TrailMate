function RecommendationPanel({ recommendation }) {
  const description = recommendation.description
    .replace('Fallback recommendation based on the supplied OpenStreetMap place; no AI-generated recommendation was used.', '')
    .trim()

  return (
    <section className="recommendation-panel" aria-labelledby="trail-plan-title">
      <p className="section-kicker">Gemma recommendation</p>
      <h2 id="trail-plan-title">Your Trail Plan</h2>
      <h3>{recommendation.title}</h3>
      {description && <p>{description}</p>}

      <h4>Selected places</h4>
      <ul>
        {recommendation.selectedPlaces.map((place) => (
          <li key={place.name}>
            <strong>{place.name}</strong>
            <span>{place.reason}</span>
          </li>
        ))}
      </ul>

      <h4>Suggested plan</h4>
      <ol>
        {recommendation.plan.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
      </ol>

      <h4>Tips</h4>
      <ul>
        {recommendation.tips.map((tip, index) => <li key={`${index}-${tip}`}>{tip}</li>)}
      </ul>
    </section>
  )
}

export default RecommendationPanel
