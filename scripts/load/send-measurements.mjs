#!/usr/bin/env node
// Envoi de mesures au Collector (partie D : alimentation du front et expérience de charge, Étape 11).
//
// - La liste des capteurs vient de MongoDB via GET /api/sensors (analytics-service) : capteurs actifs uniquement.
// - Chaque mesure est envoyée à POST /api/measurements (collector-service) et suit la vraie chaîne :
//   Collector -> Redis Streams -> Storage -> Cassandra -> Analytics -> front.
// - Les valeurs sont générées (comme un simulateur de compteurs) : puissance autour de 45 % du maxPowerKw
//   du capteur avec un cycle jour/nuit, tension autour de 230 V, courant cohérent avec P = U × I.
//
// Utilisation (depuis la racine du dépôt) :
//   node scripts/load/send-measurements.mjs                       1 mesure/s, sans fin (Ctrl+C pour arrêter)
//   node scripts/load/send-measurements.mjs --rate 20 --duration 60   expérience de charge : 20 mesures/s pendant 60 s
//   node scripts/load/send-measurements.mjs --spike 0.01          1 % de mesures en pic (puissance > maxPowerKw)
//
// Options : --rate <mesures/s> (défaut 1), --duration <s> (défaut : sans fin), --spike <0..1> (défaut 0),
//           --collector <url> (défaut http://localhost:8081), --analytics <url> (défaut http://localhost:8083)

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true'])
    return acc
  }, []),
)

const RATE = Number(args.rate ?? 1)
const DURATION = args.duration ? Number(args.duration) : null
const SPIKE = Number(args.spike ?? 0)
const COLLECTOR = args.collector ?? 'http://localhost:8081'
const ANALYTICS = args.analytics ?? 'http://localhost:8083'

if (!(RATE > 0) || RATE > 500) exit('--rate doit être compris entre 0 et 500 mesures/s')
if (DURATION !== null && !(DURATION > 0)) exit('--duration doit être un nombre de secondes positif')
if (!(SPIKE >= 0 && SPIKE <= 1)) exit('--spike doit être compris entre 0 et 1')

function exit(msg) {
  console.error(`Erreur : ${msg}`)
  process.exit(1)
}

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d
const noise = (amplitude) => (Math.random() * 2 - 1) * amplitude

// Mesure d'un capteur à l'instant t
function measurement(sensor, t) {
  const hour = t.getUTCHours() + t.getUTCMinutes() / 60
  const base = sensor.maxPowerKw * 0.45
  // cycle jour/nuit : minimum vers 3 h UTC, maximum vers 15 h UTC (± 30 %)
  let powerKw = base * (1 + 0.3 * Math.sin(((hour - 9) / 24) * 2 * Math.PI)) + noise(base * 0.05)
  const spike = Math.random() < SPIKE
  if (spike) powerKw = sensor.maxPowerKw * (1.2 + Math.random() * 0.4)
  powerKw = Math.max(0, powerKw)
  const voltage = 230 + noise(3)
  return {
    body: {
      sensorId: sensor.sensorId,
      timestamp: t.toISOString(),
      powerKw: round(powerKw, 3),
      voltage: round(voltage, 1),
      current: round((powerKw * 1000) / voltage, 2),
      frequency: round(50 + noise(0.05), 2),
      temperature: round(26 + noise(1.5) + (spike ? 6 : 0), 1),
    },
    spike,
  }
}

// ---------- Statistiques ----------
const stats = { sent: 0, accepted: 0, rejected: 0, failed: 0, spikes: 0, latencies: [], codes: {} }
let window = { sent: 0, accepted: 0, latencies: [] }

function percentile(list, p) {
  if (!list.length) return 0
  const s = [...list].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}

async function send(sensor) {
  const { body, spike } = measurement(sensor, new Date())
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
