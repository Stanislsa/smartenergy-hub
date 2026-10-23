import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, AlertTriangle, BarChart3, Database, Gauge, ListOrdered, Zap } from 'lucide-react'
import { api, settle } from '../api/client'
import { Badge, Card, Empty, ErrorBox, Field, Kpi, Loading, PageHead, SensorSelect } from '../components/ui'
import { METHOD_LABELS, dateTime, dayRange, daysAgoIso, num, timeShort, useAsync, withUnit } from '../utils'

// Pour chaque capteur actif :
//  1. résumé enregistré dans MongoDB (GET /api/sensors/{id}/daily-summary?date=) ;
//  2. sinon, indicateurs calculés par analytics-service sur la journée UTC
//     (GET /api/analytics/{id}/summary + GET /api/analytics/{id}/anomalies/all).
async function loadDay(date) {
  const sensors = (await api.sensors()).filter((s) => s.active)
  const { from, to } = dayRange(date)
  const rows = await Promise.all(
    sensors.map(async (s) => {
      const [stored, computed, anomalies] = await Promise.all([
        settle(api.dailySummary(s.sensorId, date)),
        settle(api.summary(s.sensorId, from, to)),
        settle(api.anomalies(s.sensorId, from, to)),
      ])
      const anomalyList = anomalies.ok ? anomalies.value.anomalies : []
      if (stored.ok && stored.value?.date === date) {
        const d = stored.value
        return { sensor: s, source: 'mongo', avg: d.avgPowerKw, max: d.maxPowerKw, energy: d.energyKwh,
          anomalyCount: d.anomalyCount, measurements: computed.ok ? computed.value.measurementCount : null, anomalyList }
      }
      if (computed.ok) {
        const c = computed.value
        return { sensor: s, source: 'computed', avg: c.avgPowerKw, max: c.maxPowerKw, energy: c.energyKwh,
          anomalyCount: anomalies.ok ? anomalyList.length : null, measurements: c.measurementCount, anomalyList }
      }
      return { sensor: s, source: 'error', error: computed.error, anomalyList: [] }
    }),
  )
  return rows
}

export default function DailySummary() {
  const [date, setDate] = useState(daysAgoIso(0))
  const { data, loading, error, reload } = useAsync(() => loadDay(date), [date])

  const withData = useMemo(() => (data || []).filter((r) => r.source !== 'error' && (r.measurements ?? 1) > 0), [data])
  const totals = useMemo(() => {
    if (!data) return null
    const energy = withData.reduce((s, r) => s + (r.energy || 0), 0)
    const maxes = withData.map((r) => r.max).filter((v) => v != null)
    const anomalies = withData.reduce((s, r) => s + (r.anomalyCount || 0), 0)
    return { energy, max: maxes.length ? Math.max(...maxes) : null, anomalies, sensors: withData.length, total: data.length }
  }, [data, withData])
  const top = useMemo(() => withData.slice().sort((a, b) => (b.energy || 0) - (a.energy || 0)).slice(0, 3), [withData])
  const byMethod = useMemo(() => {
    const c = {}
    withData.forEach((r) => r.anomalyList.forEach((a) => (c[a.method] = (c[a.method] || 0) + 1)))
    return c
  }, [withData])

  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <PageHead title={`Résumé du ${label}`} subtitle="Synthèse des mesures et des anomalies de la journée (UTC)">
        <Field label="Jour">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </PageHead>

      <ErrorBox error={error} onRetry={reload} />
      {loading && !data && <Loading />}

      {totals && (
        <div className="grid kpis">
          <Kpi icon={Zap} color="green" label="Énergie totale estimée" value={num(totals.energy, 1)} unit="kWh" sub="E ≈ Σ Pi·Δt, capteurs actifs" />
          <Kpi icon={Gauge} color="blue" label="Puissance maximale" value={num(totals.max)} unit="kW" sub="Tous capteurs confondus" />
          <Kpi icon={AlertTriangle} color="orange" label="Anomalies" value={totals.anomalies} sub="Toutes méthodes" />
          <Kpi icon={Database} color="purple" label="Capteurs avec données" value={`${totals.sensors} / ${totals.total}`} sub="Capteurs actifs" />
        </div>
      )}

      {data && (
        <div className="grid two-one">
          <DayChart sensors={data.map((r) => r.sensor)} date={date} defaultId={top[0]?.sensor.sensorId} />
          <div className="stack">
            <Card title="Top 3 capteurs (énergie)" icon={ListOrdered}>
              {top.length === 0 && <Empty>Aucune donnée ce jour.</Empty>}
              <ol className="top">
                {top.map((r) => (
                  <li key={r.sensor.sensorId}>
                    <span>{r.sensor.sensorId}<small>{r.sensor.name}</small></span>
                    <b>{num(r.energy, 1)} kWh</b>
                  </li>
                ))}
              </ol>
            </Card>
            <Card title="Anomalies du jour par méthode" icon={AlertTriangle}>
              <ul className="events">
                {Object.entries(METHOD_LABELS).map(([k, v]) => (
                  <li key={k}><span>{v}</span><b>{byMethod[k] || 0}</b></li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {data && (
        <Card title="Détail par capteur" icon={BarChart3} pad={false}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Capteur</th><th>Mesures</th><th>Puissance moy.</th><th>Puissance max</th><th>Énergie</th><th>Anomalies</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.sensor.sensorId}>
                    <td><span className="mono">{r.sensor.sensorId}</span> <small className="muted">{r.sensor.name}</small></td>
                    {r.source === 'error' ? (
                      <td colSpan={6} className="muted">Indisponible : {r.error?.message}</td>
                    ) : (
                      <>
                        <td>{r.measurements ?? '—'}</td>
                        <td>{withUnit(r.avg, 'kW')}</td>
                        <td>{withUnit(r.max, 'kW')}</td>
                        <td>{withUnit(r.energy, 'kWh')}</td>
                        <td>{r.anomalyCount ?? '—'}</td>
                        <td>
                          {r.source === 'mongo'
                            ? <Badge tone="green">Résumé MongoDB</Badge>
                            : <Badge tone="gray">Calculé (Analytics)</Badge>}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

function DayChart({ sensors, date, defaultId }) {
  const [picked, setPicked] = useState('')
  const sensorId = picked || defaultId || sensors[0]?.sensorId || ''
  const { data, loading, error } = useAsync(async () => {
    if (!sensorId) return []
    const { from, to } = dayRange(date)
    return (await api.history(sensorId, from, to, 5000)).slice().reverse()
  }, [sensorId, date])

  return (
    <Card title="Puissance de la journée (kW)" icon={Activity}
      actions={<SensorSelect sensors={sensors} value={sensorId} onChange={setPicked} />}>
      {loading && <Loading />}
      <ErrorBox error={error} />
      {data && data.length === 0 && <Empty>Aucune mesure ce jour pour ce capteur.</Empty>}
      {data && data.length > 0 && (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gDay" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7ecf3" vertical={false} />
            <XAxis dataKey="timestamp" tickFormatter={timeShort} tick={{ fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={dateTime} formatter={(v) => [`${num(v)} kW`, 'Puissance']} />
            <Area type="monotone" dataKey="powerKw" stroke="#10b981" strokeWidth={2} fill="url(#gDay)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
