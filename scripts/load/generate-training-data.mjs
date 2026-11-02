#!/usr/bin/env node
// Génère un jeu de données d'entraînement pour ai-service (partie D, à la demande de la partie IA).
//
// Format attendu par ai-service/training/train_forecast_model.py et train_anomaly_model.py :
//   CSV data/raw/forecast_dataset.csv avec sensor_id, measured_at, power_kw, voltage, temperature
//   (colonnes supplémentaires : current, frequency, is_anomaly, anomaly_type).
// Les mesures suivent le même profil que le script d'envoi (profile.mjs) : un modèle entraîné sur
// ces données correspond à ce que le Collector reçoit ensuite.
//
// Capteurs : lus dans MongoDB via GET /api/sensors (Analytics), ou donnés avec --sensors.
//
// Utilisation (depuis la racine du dépôt) :
//   node scripts/load/generate-training-data.mjs
//   node scripts/load/generate-training-data.mjs --days 90 --step 5 --out ai-service/data/raw
//   node scripts/load/generate-training-data.mjs --sensors SENSOR-001:8,SENSOR-002:12
//
// Options : --days (défaut 90), --step <minutes> (défaut 5), --spike (défaut 0.02), --voltage-drop (défaut 0.01),
//           --out <dossier> (défaut ai-service/data/raw), --json (écrit aussi un fichier JSON),
//           --sensors <ID:maxPowerKw,...>, --analytics <url> (défaut http://localhost:8083)

import { mkdirSync, createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { generateMeasurement } from './profile.mjs'
import { authHeaders } from './auth.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true'])
    return acc
  }, []),
)

const DAYS = Number(args.days ?? 90)
const STEP = Number(args.step ?? 5)
const SPIKE = Number(args.spike ?? 0.02)
const DROP = Number(args['voltage-drop'] ?? 0.01)
const OUT = args.out ?? join('ai-service', 'data', 'raw')
const ANALYTICS = args.analytics ?? 'http://localhost:8083'

function exit(msg) {
  console.error(`Erreur : ${msg}`)
  process.exit(1)
}
if (!(DAYS > 0 && DAYS <= 365)) exit('--days doit être compris entre 1 et 365')
if (!(STEP >= 1 && STEP <= 60)) exit('--step doit être compris entre 1 et 60 minutes')

let sensors
if (args.sensors) {
  sensors = args.sensors.split(',').map((s) => {
    const [sensorId, max] = s.split(':')
    if (!sensorId || !(Number(max) > 0)) exit(`--sensors : format attendu ID:maxPowerKw (reçu « ${s} »)`)
    return { sensorId, maxPowerKw: Number(max) }
  })
} else {
  try {
    const res = await fetch(`${ANALYTICS}/api/sensors`, { headers: await authHeaders(ANALYTICS) })
    if (!res.ok) exit(`GET /api/sensors a répondu ${res.status}`)
    sensors = (await res.json()).filter((s) => s.maxPowerKw > 0)
  } catch (e) {
    exit(`analytics-service injoignable (${ANALYTICS}) : ${e.cause?.code || e.message}. Utiliser --sensors ID:maxPowerKw,...`)
  }
}
if (!sensors.length) exit('aucun capteur')

// Période : les DAYS derniers jours, jusqu'à l'heure pleine courante (UTC)
const end = new Date()
end.setUTCMinutes(0, 0, 0)
const start = new Date(end.getTime() - DAYS * 86400000)
const stepMs = STEP * 60000

mkdirSync(OUT, { recursive: true })
const csvPath = join(OUT, 'forecast_dataset.csv')
const csv = createWriteStream(csvPath)
csv.write('sensor_id,measured_at,power_kw,voltage,temperature,current,frequency,is_anomaly,anomaly_type\n')
const jsonPath = join(OUT, 'forecast_dataset.json')
const json = args.json ? createWriteStream(jsonPath) : null
json?.write('[\n')

const counts = {}
let total = 0
let first = true
for (const sensor of sensors) {
  counts[sensor.sensorId] = { rows: 0, spike_power: 0, voltage_drop: 0 }
  for (let t = start.getTime(); t < end.getTime(); t += stepMs) {
    const m = generateMeasurement(sensor, new Date(t), { spike: SPIKE, voltageDrop: DROP })
    const row = {
      sensor_id: m.sensorId,
      measured_at: m.timestamp,
      power_kw: m.powerKw,
      voltage: m.voltage,
      temperature: m.temperature,
      current: m.current,
      frequency: m.frequency,
      is_anomaly: m.anomaly !== null,
      anomaly_type: m.anomaly,
    }
    csv.write(
      `${row.sensor_id},${row.measured_at},${row.power_kw},${row.voltage},${row.temperature},` +
        `${row.current},${row.frequency},${row.is_anomaly ? 'True' : 'False'},${row.anomaly_type ?? ''}\n`,
    )
    if (json) {
      json.write(`${first ? '' : ',\n'}${JSON.stringify(row)}`)
      first = false
    }
    counts[sensor.sensorId].rows++
    if (m.anomaly) counts[sensor.sensorId][m.anomaly]++
    total++
  }
}
json?.write('\n]\n')
await Promise.all([new Promise((r) => csv.end(r)), json ? new Promise((r) => json.end(r)) : null])

console.log(`Période : ${start.toISOString()} -> ${end.toISOString()} (${DAYS} jours, une mesure toutes les ${STEP} min)`)
for (const [id, c] of Object.entries(counts)) {
  console.log(`  ${id} : ${c.rows} mesures (${Math.floor((c.rows * STEP) / 60)} h), pics ${c.spike_power}, chutes de tension ${c.voltage_drop}`)
}
console.log(`Total : ${total} mesures`)
console.log(`CSV  : ${csvPath}`)
if (json) console.log(`JSON : ${jsonPath}`)
