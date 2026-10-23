import { useEffect, useState } from 'react'
import { api, settle } from './api/client'
import { last24h } from './utils'

// Services vérifiés depuis le navigateur.
// - Collector, Storage, Analytics, IA : endpoint /health de chaque service.
// - MongoDB : déduit de GET /api/sensors (lecture MongoDB par analytics-service).
// - Cassandra : déduit de GET /api/measurements/{id}/latest (lecture Cassandra).
// Redis n'expose rien au navigateur : son état n'est pas affiché.
export const SERVICES = [
  { key: 'collector', label: 'Collector', port: 8081 },
  { key: 'storage', label: 'Storage', port: 8082 },
  { key: 'analytics', label: 'Analytics', port: 8083 },
  { key: 'ai', label: 'Service IA', port: 8085 },
  { key: 'mongodb', label: 'MongoDB', port: 27018 },
  { key: 'cassandra', label: 'Cassandra', port: 9042 },
]

export async function checkServices() {
  const [collector, storage, analytics, ai, sensors] = await Promise.all([
    settle(api.health('collector')),
    settle(api.health('storage')),
    settle(api.health('analytics')),
    settle(api.health('ai')),
    settle(api.sensors()),
  ])
  let cassandra = { ok: false }
  if (sensors.ok && sensors.value.length) {
    const r = await settle(api.latest(sensors.value[0].sensorId))
    // 404 = capteur sans mesure : Cassandra a répondu
    cassandra = { ok: r.ok || r.error?.status === 404 }
  }
  return {
    collector: collector.ok,
    storage: storage.ok,
    analytics: analytics.ok,
    ai: ai.ok,
    mongodb: sensors.ok,
    cassandra: cassandra.ok,
  }
}

export function useServices(intervalMs = 30000) {
  const [state, setState] = useState(null)
  useEffect(() => {
    let alive = true
    const tick = () => checkServices().then((s) => alive && setState(s))
    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [intervalMs])
  return state
}

// Anomalies des dernières 24 h sur tous les capteurs actifs (une requête par capteur)
export async function recentAnomalies(sensors) {
  const { from, to } = last24h()
  const active = sensors.filter((s) => s.active)
  const reports = await Promise.all(active.map((s) => settle(api.anomalies(s.sensorId, from, to))))
  const list = []
  reports.forEach((r, i) => {
    if (r.ok) r.value.anomalies.forEach((a) => list.push({ ...a, sensorId: active[i].sensorId, sensorName: active[i].name }))
  })
  return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}
