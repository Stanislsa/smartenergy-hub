// Authentification des scripts quand l'API est protégée (variables API_USER / API_PASSWORD)
export async function authHeaders(analyticsUrl) {
  const user = process.env.API_USER
  const password = process.env.API_PASSWORD
  if (!user || !password) return {}
  const res = await fetch(`${analyticsUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password })
  })
  if (!res.ok) {
    console.error(`Connexion refusée (HTTP ${res.status}) pour ${user}`)
    process.exit(2)
  }
  const { accessToken } = await res.json()
  return { Authorization: `Bearer ${accessToken}` }
}