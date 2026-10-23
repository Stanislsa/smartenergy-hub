import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { api, settle } from '../api/client'
import { Badge, Card, Empty, ErrorBox, Field, Loading, PageHead, SensorSelect } from '../components/ui'
import { METHOD_LABELS, dateTime, daysAgoIso, daysRange, explainAnomaly, todayIso, useAsync } from '../utils'

const TONES = { THRESHOLD: 'red', Z_SCORE: 'orange', POWER_VARIATION: 'yellow', VOLTAGE: 'blue', TEMPERATURE: 'purple' }
const PAGE_SIZE = 15

export default function Anomalies() {
  const sensorsQ = useAsync(() => api.sensors(), [])
  const [filters, setFilters] = useState({ sensorId: '', method: '', start: daysAgoIso(6), end: todayIso() })
  const [applied, setApplied] = useState(filters)
  const [formError, setFormError] = useState(null)
  const [page, setPage] = useState(1)

  const { data, loading, error } = useAsync(async () => {
    if (!sensorsQ.data) return null
    const targets = applied.sensorId ? sensorsQ.data.filter((s) => s.sensorId === applied.sensorId) : sensorsQ.data
    const { from, to } = daysRange(applied.start, applied.end)
    const results = await Promise.all(targets.map((s) => settle(api.anomalies(s.sensorId, from, to))))
    const list = []
    const failed = []
    results.forEach((r, i) => {
      if (r.ok) r.value.anomalies.forEach((a) => list.push({ ...a, sensorId: targets[i].sensorId }))
      else failed.push(`${targets[i].sensorId} (${r.error.message})`)
    })
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    return { list, failed }
  }, [applied, sensorsQ.data])

  useEffect(() => setPage(1), [applied])

  const submit = (e) => {
    e.preventDefault()
    const days = (new Date(filters.end) - new Date(filters.start)) / 86400000 + 1
    if (days < 1) return setFormError('La date de fin doit être postérieure ou égale à la date de début.')
    if (days > 31) return setFormError('La période ne peut pas dépasser 31 jours (limite de l’API).')
    setFormError(null)
    setApplied({ ...filters })
  }

  const list = useMemo(() => (data?.list || []).filter((a) => !applied.method || a.method === applied.method), [data, applied])
  const counts = useMemo(() => {
    const c = {}
    ;(data?.list || []).forEach((a) => (c[a.method] = (c[a.method] || 0) + 1))
    return c
  }, [data])
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const rows = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <PageHead title="Alertes et anomalies" subtitle="Anomalies détectées par analytics-service (seuil, z-score, variation, tension, température)">
        {data && (
          <span className="pill red">
            <AlertTriangle size={14} /> {data.list.length} anomalie{data.list.length > 1 ? 's' : ''} sur la période
          </span>
        )}
      </PageHead>

      <ErrorBox error={sensorsQ.error} onRetry={sensorsQ.reload} />

      <Card>
        <form className="filters" onSubmit={submit}>
          <Field label="Capteur">
            <SensorSelect allowAll sensors={sensorsQ.data} value={filters.sensorId} onChange={(v) => setFilters({ ...filters, sensorId: v })} />
          </Field>
          <Field label="Méthode">
            <select value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}>
              <option value="">Toutes les méthodes</option>
              {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Du">
            <input type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
          </Field>
          <Field label="Au">
            <input type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
          </Field>
          <button className="btn">Filtrer</button>
        </form>
        {formError && <div className="state error">{formError}</div>}
        {data && (
          <div className="chips">
            {Object.entries(METHOD_LABELS).map(([k, v]) => (
              <Badge key={k} tone={TONES[k]}>{v} : {counts[k] || 0}</Badge>
            ))}
          </div>
        )}
      </Card>

      <Card pad={false}>
        {loading && <Loading />}
        <ErrorBox error={error} />
        {data?.failed.length > 0 && <div className="state error">Capteurs non analysés : {data.failed.join(' ; ')}</div>}
        {data && list.length === 0 && <Empty>Aucune anomalie sur cette période.</Empty>}
        {rows.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date / heure</th>
                  <th>Capteur</th>
                  <th>Méthode</th>
                  <th>Valeur observée</th>
                  <th>Seuil</th>
                  <th>Explication</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => {
                  const e = explainAnomaly(a)
                  return (
                    <tr key={`${a.sensorId}-${a.timestamp}-${a.method}-${i}`}>
                      <td>{dateTime(a.timestamp)}</td>
                      <td className="mono">{a.sensorId}</td>
                      <td><Badge tone={TONES[a.method]}>{METHOD_LABELS[a.method]}</Badge></td>
                      <td><b>{e.observed}</b></td>
                      <td>{e.limit}</td>
                      <td className="explain">{e.text}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {list.length > 0 && (
          <div className="table-foot">
            <span>Affichage de {rows.length} sur {list.length} anomalie{list.length > 1 ? 's' : ''}</span>
            <div className="pager">
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} className={page === i + 1 ? 'on' : ''} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
