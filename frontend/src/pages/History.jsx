import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, List } from 'lucide-react'
import { api } from '../api/client'
import { Card, Empty, ErrorBox, Field, Loading, PageHead, SensorSelect } from '../components/ui'
import { dateTime, daysAgoIso, daysRange, num, todayIso, useAsync } from '../utils'

const METRICS = [
  { key: 'powerKw', label: 'Puissance (kW)', color: '#2563eb', digits: 2 },
  { key: 'voltage', label: 'Tension (V)', color: '#f59e0b', digits: 1 },
  { key: 'temperature', label: 'Température (°C)', color: '#10b981', digits: 1 },
  { key: 'current', label: 'Courant (A)', color: '#8b5cf6', digits: 2 },
  { key: 'frequency', label: 'Fréquence (Hz)', color: '#ef4444', digits: 2 },
]

export default function History() {
  const [params] = useSearchParams()
  const sensorsQ = useAsync(() => api.sensors(), [])
  const [filters, setFilters] = useState({
    sensorId: params.get('sensor') || '',
    start: daysAgoIso(6),
    end: todayIso(),
    metric: 'all',
  })
  const [applied, setApplied] = useState(null)
  const [formError, setFormError] = useState(null)

  // Premier capteur par défaut, puis chargement initial
  useEffect(() => {
    if (sensorsQ.data && !applied) {
      const sensorId = filters.sensorId || sensorsQ.data[0]?.sensorId || ''
      const f = { ...filters, sensorId }
      setFilters(f)
      setApplied(f)
    }
  }, [sensorsQ.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, error } = useAsync(async () => {
    if (!applied?.sensorId) return null
    const { from, to } = daysRange(applied.start, applied.end)
    return api.history(applied.sensorId, from, to, 5000)
  }, [applied])

  const submit = (e) => {
    e.preventDefault()
    const days = (new Date(filters.end) - new Date(filters.start)) / 86400000 + 1
    if (days < 1) return setFormError('La date de fin doit être postérieure ou égale à la date de début.')
    if (days > 31) return setFormError('La période ne peut pas dépasser 31 jours (limite de l’API).')
    setFormError(null)
    setApplied({ ...filters })
  }

  const chart = useMemo(() => (data ? data.slice().reverse() : []), [data])
  const shown = METRICS.filter(
    (m) => (applied?.metric === 'all' ? ['powerKw', 'voltage', 'temperature'].includes(m.key) : m.key === applied?.metric) &&
      chart.some((r) => r[m.key] != null),
  )
  const sensor = sensorsQ.data?.find((s) => s.sensorId === applied?.sensorId)

  return (
    <>
      <PageHead title="Historique des mesures" subtitle="Évolution des mesures par capteur et par période (Cassandra)" />

      <ErrorBox error={sensorsQ.error} onRetry={sensorsQ.reload} />

      <Card>
        <form className="filters" onSubmit={submit}>
          <Field label="Capteur">
            <SensorSelect sensors={sensorsQ.data} value={filters.sensorId} onChange={(v) => setFilters({ ...filters, sensorId: v })} />
          </Field>
          <Field label="Du">
            <input type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
          </Field>
          <Field label="Au">
            <input type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
          </Field>
          <Field label="Métrique">
            <select value={filters.metric} onChange={(e) => setFilters({ ...filters, metric: e.target.value })}>
              <option value="all">Puissance, tension, température</option>
              {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </Field>
          <button className="btn">Filtrer</button>
        </form>
        {formError && <div className="state error">{formError}</div>}
      </Card>

      <Card title={`Évolution des mesures${sensor ? ` – ${sensor.name} (${sensor.sensorId})` : ''}`} icon={Activity}>
        {loading && <Loading />}
        <ErrorBox error={error} />
        {data && data.length === 0 && <Empty>Aucune mesure sur cette période.</Empty>}
        {chart.length > 0 && shown.length > 1 && shown.some((m) => m.key === 'voltage') && (
          <p className="hint">Tension sur l’axe de droite.</p>
        )}
        {chart.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7ecf3" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={(v) => dateTime(v).slice(0, 5)} tick={{ fontSize: 11 }} minTickGap={50} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              {shown.some((m) => m.key === 'voltage') && shown.length > 1 && (
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              )}
              <Tooltip labelFormatter={dateTime} formatter={(v, name) => [num(v), name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {shown.map((m) => (
                <Line key={m.key} yAxisId={m.key === 'voltage' && shown.length > 1 ? 'right' : 'left'} type="monotone" dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2} dot={chart.length < 60} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {data && data.length > 0 && (
        <Card title={`Mesures (${data.length}${data.length === 5000 ? ', limite atteinte' : ''})`} icon={List} pad={false}>
          <div className="table-wrap scroll">
            <table>
              <thead>
                <tr>
                  <th>Date / heure</th>
                  <th>Capteur</th>
                  {METRICS.map((m) => <th key={m.key}>{m.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 200).map((m) => (
                  <tr key={m.timestamp}>
                    <td>{dateTime(m.timestamp)}</td>
                    <td className="mono">{m.sensorId}</td>
                    {METRICS.map((x) => <td key={x.key}>{num(m[x.key], x.digits)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 200 && <div className="table-foot"><span>200 mesures les plus récentes affichées sur {data.length}.</span></div>}
        </Card>
      )}
    </>
  )
}
