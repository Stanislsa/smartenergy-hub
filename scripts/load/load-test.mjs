#!/usr/bin/env node
// Expérience de charge (Étape 11, partie D).
//
// Pour chaque palier de débit : envoi de mesures au Collector pendant une durée fixe, relevé des métriques
// toutes les 5 s, puis attente que le Storage ait rattrapé le flux Redis.
//
// Métriques relevées :
//   1. Collector  : latence de POST /api/measurements (mesurée par le script : moyenne, p95, max) et
//                   http.server.requests côté serveur (Actuator : nombre de requêtes, temps moyen, max)
//   2. Redis      : lag et pending du groupe storage-group sur le flux energy-measurements
//                   (redis-cli via docker compose) -> le Storage suit-il le débit ?
//   3. JVM        : process.cpu.usage et jvm.memory.used du Collector et de l'Analytics (Actuator)
//
// Utilisation (depuis la racine du dépôt, services et Docker lancés) :
//   node scripts/load/load-test.mjs
//   node scripts/load/load-test.mjs --steps 5,20,50,100 --duration 30
//
// Options : --steps (défaut 5,20,50,100 mesures/s), --duration <s par palier> (défaut 30),
//           --drain <s max d'attente du rattrapage> (défaut 120), --out <fichier> (défaut docs/monitoring-resultats.md)

import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import { generateMeasurement } from './profile.mjs'

const run = promisify(execFile)

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true'])
    return acc
  }, []),
)
const STEPS = (args.steps ?? '5,20,50,100').split(',').map(Number)
const DURATION = Number(args.duration ?? 30)
const DRAIN = Number(args.drain ?? 120)
const OUT = args.out ?? 'docs/monitoring-resultats.md'
const COLLECTOR = args.collector ?? 'http://localhost:8081'
const ANALYTICS = args.analytics ?? 'http://localhost:8083'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? '—' : v.toFixed(d))
const pct = (list, p) => {
  if (!list.length) return null
  const s = [...list].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}

// ---------- Relevés ----------
async function redisGroup() {
  try {
    const { stdout } = await run('docker', ['compose', 'exec', '-T', 'redis', 'redis-cli', 'XINFO', 'GROUPS', 'energy-measurements'])
    const lines = stdout.trim().split(/\r?\n/)
    const i = lines.indexOf('storage-group')
    if (i < 0) return null
    const g = {}
    for (let k = i - 1; k < lines.length - 1; k += 2) {
      if (k > i && lines[k] === 'name') break
      g[lines[k]] = lines[k + 1]
    }
    return { lag: g.lag === undefined || g.lag === '' ? null : Number(g.lag), pending: Number(g.pending) }
  } catch {
    return null
  }
}

async function metric(base, name, tag) {
  try {
    const res = await fetch(`${base}/actuator/metrics/${name}${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`)
    if (!res.ok) return null
    const body = await res.json()
    return Object.fromEntries(body.measurements.map((m) => [m.statistic, m.value]))
  } catch {
    return null
  }
}

async function jvm(base) {
  const [cpu, mem] = await Promise.all([metric(base, 'process.cpu.usage'), metric(base, 'jvm.memory.used')])
  return { cpu: cpu ? cpu.VALUE * 100 : null, memMb: mem ? mem.VALUE / 1048576 : null }
}

// ---------- Programme ----------
let sensors
try {
  sensors = (await (await fetch(`${ANALYTICS}/api/sensors?active=true`)).json()).filter((s) => s.active && s.maxPowerKw > 0)
} catch (e) {
  console.error(`Erreur : analytics-service injoignable (${ANALYTICS}) : ${e.cause?.code || e.message}`)
  process.exit(1)
}
if (!sensors.length) {
  console.error('Erreur : aucun capteur actif dans MongoDB')
  process.exit(1)
}
const g0 = await redisGroup()
if (!g0) console.warn('Attention : groupe storage-group introuvable via redis-cli (lancer depuis la racine du dépôt, Docker démarré).')
const actuatorAnalytics = (await metric(ANALYTICS, 'process.cpu.usage')) !== null
console.log(`Capteurs : ${sensors.map((s) => s.sensorId).join(', ')} | paliers : ${STEPS.join(', ')} mesures/s, ${DURATION} s chacun`)
console.log(`Actuator Analytics : ${actuatorAnalytics ? 'oui' : 'non (métriques JVM de l’Analytics absentes)'}\n`)

const results = []
for (const rate of STEPS) {
  const httpBefore = await metric(COLLECTOR, 'http.server.requests', 'uri:/api/measurements')
  const lat = []
  const codes = {}
  const samples = []
  let sent = 0
  let next = 0
  let lastSendAt = null
  const pending = new Set()
  const started = performance.now()
  const period = 1000 / rate

  const sender = setInterval(() => {
    const due = Math.min(Math.floor((performance.now() - started) / period) + 1, Math.round(rate * DURATION))
    while (sent < due) {
      sent++
      lastSendAt = performance.now()
      const m = generateMeasurement(sensors[next++ % sensors.length], new Date())
      delete m.anomaly
      const t0 = performance.now()
      const p = fetch(`${COLLECTOR}/api/measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m),
      })
        .then((r) => {
          lat.push(performance.now() - t0)
          codes[r.status] = (codes[r.status] || 0) + 1
        })
        .catch(() => (codes.erreur = (codes.erreur || 0) + 1))
        .finally(() => pending.delete(p))
      pending.add(p)
    }
  }, Math.max(5, Math.min(period, 50)))

  process.stdout.write(`Palier ${rate}/s : envoi`)
  while (performance.now() - started < DURATION * 1000) {
    await sleep(5000)
    const [g, c, a] = await Promise.all([redisGroup(), jvm(COLLECTOR), jvm(ANALYTICS)])
    samples.push({ g, c, a })
    process.stdout.write('.')
  }
  clearInterval(sender)
  await Promise.allSettled([...pending])
  // Débit obtenu : mesures envoyées / durée réelle d'envoi (jusqu'au dernier envoi, intervalle compris)
  const sendSeconds = lastSendAt ? (lastSendAt - started) / 1000 + 1 / rate : DURATION

  // Rattrapage du Storage
  const gEnd = await redisGroup()
  let drainSeconds = null
  const drainStart = performance.now()
  if (gEnd && gEnd.lag !== null) {
    process.stdout.write(' rattrapage')
    while (performance.now() - drainStart < DRAIN * 1000) {
      const g = await redisGroup()
      if (g && g.lag === 0) {
        drainSeconds = (performance.now() - drainStart) / 1000
        break
      }
      await sleep(1000)
      process.stdout.write('.')
    }
  }
  const httpAfter = await metric(COLLECTOR, 'http.server.requests', 'uri:/api/measurements')

  const serverCount = httpAfter && httpBefore ? httpAfter.COUNT - httpBefore.COUNT : null
  const serverAvgMs = serverCount ? ((httpAfter.TOTAL_TIME - httpBefore.TOTAL_TIME) / serverCount) * 1000 : null
  const max = (f) => {
    const v = samples.map(f).filter((x) => x != null)
    return v.length ? Math.max(...v) : null
  }
  const r = {
    rate,
    sent,
    achieved: sent / sendSeconds,
    accepted: codes[202] || 0,
    codes,
    latAvg: lat.length ? lat.reduce((s, x) => s + x, 0) / lat.length : null,
    latP95: pct(lat, 95),
    latMax: lat.length ? Math.max(...lat) : null,
    serverCount,
    serverAvgMs,
    lagMax: max((s) => s.g?.lag),
    lagEnd: gEnd?.lag ?? null,
    pendingMax: max((s) => s.g?.pending),
    drainSeconds,
    cpuCollector: max((s) => s.c.cpu),
    memCollector: max((s) => s.c.memMb),
    cpuAnalytics: max((s) => s.a.cpu),
    memAnalytics: max((s) => s.a.memMb),
  }
  results.push(r)
  console.log(
    `\n  ${r.accepted}/${r.sent} acceptées (${fmt(r.achieved)}/s) | latence moy. ${fmt(r.latAvg)} ms, p95 ${fmt(r.latP95)} ms` +
      ` | lag max ${r.lagMax ?? '—'}, fin ${r.lagEnd ?? '—'}, rattrapé en ${r.drainSeconds == null ? 'non rattrapé' : fmt(r.drainSeconds) + ' s'}` +
      ` | CPU Collector max ${fmt(r.cpuCollector)} %\n`,
  )
}

// ---------- Rapport ----------
const now = new Date().toISOString()
const md = `# Résultats de l'expérience de charge

Généré par \`scripts/load/load-test.mjs\` le ${now}.
Capteurs : ${sensors.map((s) => s.sensorId).join(', ')}. Durée par palier : ${DURATION} s.

## Collector et flux Redis

| Débit visé | Débit obtenu | Acceptées (202) | Latence moy. (ms) | p95 (ms) | Max (ms) | Requêtes vues par Actuator | Temps serveur moy. (ms) | Lag Redis max | Lag en fin d'envoi | Rattrapage du Storage |
|---|---|---|---|---|---|---|---|---|---|---|
${results
  .map(
    (r) =>
      `| ${r.rate}/s | ${fmt(r.achieved)}/s | ${r.accepted} / ${r.sent} | ${fmt(r.latAvg)} | ${fmt(r.latP95)} | ${fmt(r.latMax)} | ${r.serverCount ?? '—'} | ${fmt(r.serverAvgMs, 2)} | ${r.lagMax ?? '—'} | ${r.lagEnd ?? '—'} | ${r.drainSeconds == null ? 'non rattrapé' : fmt(r.drainSeconds) + ' s'} |`,
  )
  .join('\n')}

## JVM (maximum relevé pendant l'envoi)

| Débit visé | CPU Collector (%) | Mémoire Collector (Mo) | CPU Analytics (%) | Mémoire Analytics (Mo) |
|---|---|---|---|---|
${results.map((r) => `| ${r.rate}/s | ${fmt(r.cpuCollector)} | ${fmt(r.memCollector, 0)} | ${fmt(r.cpuAnalytics)} | ${fmt(r.memAnalytics, 0)} |`).join('\n')}

Codes HTTP par palier : ${results.map((r) => `${r.rate}/s → ${JSON.stringify(r.codes)}`).join(' ; ')}
`
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, md)
console.log(`Rapport écrit : ${OUT}`)
