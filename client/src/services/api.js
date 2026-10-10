const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export async function generateTrails(location) {
  const response = await fetch(`${API_BASE_URL}/api/trails/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(location),
  })

  if (!response.ok) {
    throw new Error('Unable to generate trails. Please try again.')
  }

  return response.json()
}
