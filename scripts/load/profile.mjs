// Profil commun des mesures générées (script d'envoi et jeu d'entraînement) :
// puissance autour de 45 % du maxPowerKw avec un cycle jour/nuit (± 30 %, minimum vers 3 h UTC,
// maximum vers 15 h UTC) et un bruit de ± 5 % ; tension 230 V ± 3 ; courant I = P / U ;
// fréquence 50 Hz ± 0,05 ; température 26 °C ± 1,5.
// Anomalies optionnelles : pic de puissance (1,2 à 1,6 × maxPowerKw, température + 6 °C)
// ou chute de tension (195 à 205 V).
import { authHeaders } from './auth.mjs'
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d
const noise = (amplitude) => (Math.random() * 2 - 1) * amplitude

export function generateMeasurement(sensor, t, { spike = 0, voltageDrop = 0 } = {}) {
  const hour = t.getUTCHours() + t.getUTCMinutes() / 60
  const base = sensor.maxPowerKw * 0.45
  let powerKw = base * (1 + 0.3 * Math.sin(((hour - 9) / 24) * 2 * Math.PI)) + noise(base * 0.05)
  let voltage = 230 + noise(3)
  let temperature = 26 + noise(1.5)
  let anomaly = null

  const r = Math.random()
  if (r < spike) {
    anomaly = 'spike_power'
    powerKw = sensor.maxPowerKw * (1.2 + Math.random() * 0.4)
    temperature += 6
  } else if (r < spike + voltageDrop) {
    anomaly = 'voltage_drop'
    voltage = 195 + Math.random() * 10
  }
  powerKw = Math.max(0, powerKw)

  return {
    sensorId: sensor.sensorId,
    timestamp: t.toISOString(),
    powerKw: round(powerKw, 3),
    voltage: round(voltage, 1),
    current: round((powerKw * 1000) / voltage, 2),
    frequency: round(50 + noise(0.05), 2),
    temperature: round(temperature, 1),
    anomaly,
  }
}
