#!/usr/bin/env node
// Envoi de mesures au Collector (partie D : alimentation du front et expérience de charge, Étape 11).
//
// - La liste des capteurs vient de MongoDB via GET /api/sensors (analytics-service) : capteurs actifs uniquement.
// - Chaque mesure est envoyée à POST /api/measurements (collector-service) et suit la vraie chaîne :
//   Collector -> Redis Streams -> Storage -> Cassandra -> Analytics -> front.
// - Les valeurs sont générées (comme un simulateur de compteurs) selon le profil de profile.mjs.
//
// Utilisation (depuis la racine du dépôt) :
//   node scripts/load/send-measurements.mjs                       1 mesure/s, sans fin (Ctrl+C pour arrêter)
//   node scripts/load/send-measurements.mjs --rate 20 --duration 60   expérience de charge : 20 mesures/s pendant 60 s
//   node scripts/load/send-measurements.mjs --spike 0.01          1 % de mesures en pic (puissance > maxPowerKw)
//   node scripts/load/send-measurements.mjs --backfill-hours 24   historique des 24 dernières heures (1 mesure / 5 min
//                                                                  par capteur), envoyé au Collector, puis arrêt
//
// Options : --rate <mesures/s> (défaut 1), --duration <s> (défaut : sans fin), --spike <0..1> (défaut 0),
//           --backfill-hours <h> (historique, max 168 ; envoi à 50 mesures/s),
//           --collector <url> (défaut http://localhost:8081), --analytics <url> (défaut http://localhost:8083)

import { generateMeasurement } from './profile.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true'])
    return acc
  }, []),
)

const RATE = Number(args.rate ?? 1)
const DURATION = args.duration ? Number(args.duration) : null
const SPIKE = Number(args.spike ?? 0)
const BACKFILL = args['backfill-hours'] ? Number(args['backfill-hours']) : null
const COLLECTOR = args.collector ?? 'http://localhost:8081'
const ANALYTICS = args.analytics ?? 'http://localhost:8083'

if (!(RATE > 0) || RATE > 500) exit('--rate doit être compris entre 0 et 500 mesures/s')
if (DURATION !== null && !(DURATION > 0)) exit('--duration doit être un nombre de secondes positif')
if (!(SPIKE >= 0 && SPIKE <= 1)) exit('--spike doit être compris entre 0 et 1')
if (BACKFILL !== null && !(BACKFILL > 0 && BACKFILL <= 168)) exit('--backfill-hours doit être compris entre 1 et 168')

function exit(msg) {
  console.error(`Erreur : ${msg}`)
  process.exit(1)
}

// Mesure d'un capteur à l'instant t (profil commun : profile.mjs)
function measurement(sensor, t) {
  const m = generateMeasurement(sensor, t, { spike: SPIKE })
  const { anomaly, ...body } = m
  return { body, spike: anomaly === 'spike_power' }
}

// ---------- Statistiques ----------
const stats = { sent: 0, accepted: 0, rejected: 0, failed: 0, spikes: 0, latencies: [], codes: {} }
let window = { sent: 0, accepted: 0, latencies: [] }

function percentile(list, p) {
  if (!list.length) return 0
  const s = [...list].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}

async function send(sensor, t = new Date()) {
  const { body, spike } = measurement(sensor, t)
  const start = performance.now()
  stats.sent++
  window.sent++
  if (spike) stats.spikes++
  try {
    const res = await fetch(`${COLLECTOR}/api/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const ms = performance.now() - start
    stats.latencies.push(ms)
    window.latencies.push(ms)
    stats.codes[res.status] = (stats.codes[res.status] || 0) + 1
    if (res.status === 202) {
      stats.accepted++
      window.accepted++
    } else {
      stats.rejected++
      if (stats.rejected <= 3) console.warn(`  ${res.status} pour ${body.sensorId} : ${(await res.text()).slice(0, 200)}`)
    }
  } catch (e) {
    stats.failed++
    stats.codes.erreur = (stats.codes.erreur || 0) + 1
    if (stats.failed <= 3) console.warn(`  Collector injoignable (${COLLECTOR}) : ${e.cause?.code || e.message}`)
  }
}

function printWindow(seconds) {
  const l = window.latencies
  const avg = l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0
  console.log(
    `[${new Date().toLocaleTimeString('fr-FR')}] ${window.sent} envoyées / ${seconds} s` +
      ` (${(window.sent / seconds).toFixed(1)}/s), 202 : ${window.accepted},` +
      ` latence moy. ${avg.toFixed(1)} ms, p95 ${percentile(l, 95).toFixed(1)} ms`,
  )
  window = { sent: 0, accepted: 0, latencies: [] }
}

function printSummary(elapsed) {
  const l = stats.latencies
  const avg = l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0
  console.log('\n===== Bilan =====')
  console.log(`Durée                : ${elapsed.toFixed(1)} s`)
  console.log(`Mesures envoyées     : ${stats.sent} (${(stats.sent / elapsed).toFixed(1)}/s), dont ${stats.spikes} pics`)
  console.log(`Acceptées (202)      : ${stats.accepted}`)
  console.log(`Refusées (autre code): ${stats.rejected}`)
  console.log(`Échecs réseau        : ${stats.failed}`)
  console.log(`Codes HTTP           : ${JSON.stringify(stats.codes)}`)
  console.log(`Latence (ms)         : moy. ${avg.toFixed(1)}, p50 ${percentile(l, 50).toFixed(1)}, p95 ${percentile(l, 95).toFixed(1)}, p99 ${percentile(l, 99).toFixed(1)}, max ${(l.length ? Math.max(...l) : 0).toFixed(1)}`)
}

// ---------- Programme ----------
let sensors
try {
  const res = await fetch(`${ANALYTICS}/api/sensors?active=true`)
  if (!res.ok) exit(`GET /api/sensors a répondu ${res.status}`)
  sensors = (await res.json()).filter((s) => s.active && s.maxPowerKw > 0)
} catch (e) {
  exit(`analytics-service injoignable (${ANALYTICS}) : ${e.cause?.code || e.message}`)
}
if (!sensors.length) exit('aucun capteur actif dans MongoDB')

console.log(`Capteurs actifs (MongoDB) : ${sensors.map((s) => `${s.sensorId} (Pmax ${s.maxPowerKw} kW)`).join(', ')}`)

// ---------- Mode historique : une mesure toutes les 5 min par capteur sur les dernières heures ----------
if (BACKFILL !== null) {
  const step = 5 * 60000
  const end = Date.now()
  const times = []
  for (let t = Math.ceil((end - BACKFILL * 3600000) / step) * step; t < end; t += step) times.push(t)
  const jobs = []
  for (const s of sensors) for (const t of times) jobs.push([s, new Date(t)])
  console.log(`Historique : ${times.length} mesures par capteur sur ${BACKFILL} h, ${jobs.length} au total (50/s)\n`)
  const started = performance.now()
  const reporter = setInterval(() => printWindow(10), 10000)
  for (let i = 0; i < jobs.length; i += 50) {
    const batchStart = performance.now()
    await Promise.all(jobs.slice(i, i + 50).map(([s, t]) => send(s, t)))
    const wait = 1000 - (performance.now() - batchStart)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  }
  clearInterval(reporter)
  printSummary((performance.now() - started) / 1000)
  process.exit(stats.failed > 0 && stats.accepted === 0 ? 1 : 0)
}
console.log(
  `Envoi vers ${COLLECTOR}/api/measurements : ${RATE} mesure(s)/s` +
    `${DURATION ? ` pendant ${DURATION} s` : ', Ctrl+C pour arrêter'}${SPIKE ? `, pics : ${SPIKE * 100} %` : ''}\n`,
)

const started = performance.now()
const pending = new Set()
let next = 0
let ticks = 0
const periodMs = 1000 / RATE

const timer = setInterval(() => {
  // rattrapage si le minuteur a pris du retard
  const due = Math.floor((performance.now() - started) / periodMs) + 1
  while (ticks < due) {
    ticks++
    const p = send(sensors[next++ % sensors.length]).finally(() => pending.delete(p))
    pending.add(p)
  }
  if (DURATION && performance.now() - started >= DURATION * 1000) stop()
}, Math.max(5, Math.min(periodMs, 100)))

const reporter = setInterval(() => printWindow(10), 10000)

let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  clearInterval(timer)
  clearInterval(reporter)
  await Promise.allSettled([...pending])
  printSummary((performance.now() - started) / 1000)
  process.exit(stats.failed > 0 && stats.accepted === 0 ? 1 : 0)
}
process.on('SIGINT', stop)
