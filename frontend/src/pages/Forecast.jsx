import { useEffect, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Brain, Info, LineChart as LineIcon } from 'lucide-react'
import { api, settle } from '../api/client'
import { Card, Empty, ErrorBox, Field, Loading, PageHead, SensorSelect } from '../components/ui'
import { dateTime, last24h, num, timeShort, useAsync } from '../utils'

// Le service IA renvoie une prévision par appel (POST /api/v1/forecasts/predict, horizon 1 à 1440 min).
// Pour tracer une courbe, on interroge plusieurs horizons répartis sur la durée choisie.
const HORIZONS = [
  { label: '1 heure', minutes: 60 },
  { label: '6 heures', minutes: 360 },
  { label: '12 heures', minutes: 720 },
  { label: '24 heures', minutes: 1440 },
]
const STEPS = 6

export default function Forecast() {
  const sensorsQ = useAsync(() => api.sensors({ active: true }), [])
  const status = useAsync(() => api.modelStatus(), [])
  const [sensorId, setSensorId] = useState('')
  const [horizon, setHorizon] = useState(360)
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (sensorsQ.data && !sensorId) setSensorId(sensorsQ.data[0]?.sensorId || '')
  }, [sensorsQ.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async (e) => {
    e.preventDefault()
    setRunning(true)
    setResult(null)
    const { from, to } = last24h()
    const minutes = Array.from({ length: STEPS }, (_, i) => Math.round((horizon * (i + 1)) / STEPS))
    const [history, ...preds] = await Promise.all([
      settle(api.history(sensorId, from, to, 5000)),
      ...minutes.map((m) => settle(api.forecast(sensorId, m))),
    ])
    const ok = preds.filter((p) => p.ok).map((p) => p.value)
    setResult({
      sensorId,
      horizon,
      history: history.ok ? history.value.slice().reverse() : [],
      forecasts: ok,
      error: ok.length === 0 ? preds[0]?.error : null,
    })
    setRunning(false)
  }

  const chart = result
    ? [
        ...result.history.map((m) => ({ t: new Date(m.timestamp).getTime(), real: m.powerKw })),
        ...result.forecasts.map((f) => ({
          t: new Date(f.forecast_time.endsWith('Z') ? f.forecast_time : `${f.forecast_time}Z`).getTime(),
          pred: f.predicted_power_kw,
          band: f.confidence_interval ? [f.confidence_interval.lower, f.confidence_interval.upper] : undefined,
        })),
      ].sort((a, b) => a.t - b.t)
    : []
  const last = result?.forecasts.at(-1)

  return (
    <>
      <PageHead title="Prévision de la consommation" subtitle="Puissance estimée par le service IA (Random Forest) pour les prochaines heures" />

      <ErrorBox error={sensorsQ.error} onRetry={sensorsQ.reload} />

      <Card>
        <form className="filters" onSubmit={generate}>
          <Field label="Capteur">
            <SensorSelect sensors={sensorsQ.data} value={sensorId} onChange={setSensorId} />
          </Field>
          <Field label="Horizon">
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
              {HORIZONS.map((h) => <option key={h.minutes} value={h.minutes}>{h.label}</option>)}
            </select>
          </Field>
          <button className="btn" disabled={!sensorId || running}>{running ? 'Calcul…' : 'Générer'}</button>
        </form>
      </Card>

      <div className="grid two-one">
        <Card title={`Prévision${result ? ` – ${result.sensorId}` : ''}`} icon={LineIcon}>
          {running && <Loading label="Interrogation du service IA…" />}
          {!result && !running && <Empty>Choisissez un capteur et un horizon, puis cliquez sur « Générer ».</Empty>}
          {result?.error && (
            <>
              <ErrorBox error={result.error} />
              <p className="hint">
                {result.error.status === 503
                  ? 'Le modèle de prévision n’est pas encore entraîné (fichier du modèle absent dans ai-service).'
                  : result.error.status === 0
                    ? 'Le service IA (port 8085) ne répond pas : vérifiez qu’il est démarré.'
                    : 'Le service IA a renvoyé une erreur : voir ses logs.'}
              </p>
            </>
          )}
          {result && !result.error && chart.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7ecf3" vertical={false} />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']}
                  tickFormatter={(v) => timeShort(new Date(v).toISOString())} tick={{ fontSize: 11 }} minTickGap={40} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(v) => dateTime(new Date(v).toISOString())}
                  formatter={(v, name) => [Array.isArray(v) ? `${num(v[0])} – ${num(v[1])} kW` : `${num(v)} kW`, name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area dataKey="band" name="Intervalle de confiance (95 %)" fill="#fbbf24" fillOpacity={0.2} stroke="none" connectNulls />
                <Line dataKey="real" name="Mesures (24 h)" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
                <Line dataKey="pred" name="Prévision" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className="stack">
          <Card title="Résultats de la prévision" icon={Info}>
            {!last && <Empty>Pas encore de prévision.</Empty>}
            {last && (
              <dl className="kv">
                <dt>Puissance prévue (à {result.horizon / 60} h)</dt><dd>{num(last.predicted_power_kw)} kW</dd>
                {last.confidence_interval && (
                  <>
                    <dt>Intervalle de confiance</dt>
                    <dd>{num(last.confidence_interval.lower)} – {num(last.confidence_interval.upper)} kW</dd>
                  </>
                )}
                <dt>Instant prévu</dt><dd>{dateTime(last.forecast_time.endsWith('Z') ? last.forecast_time : `${last.forecast_time}Z`)}</dd>
                <dt>Version du modèle</dt><dd>{last.model_version}</dd>
                <dt>Points calculés</dt><dd>{result.forecasts.length} / {STEPS}</dd>
              </dl>
            )}
          </Card>
          <Card title="Modèle de détection (service IA)" icon={Brain}>
            {status.loading && <Loading />}
            {status.error && <ErrorBox error={status.error} />}
            {status.data && (
              <dl className="kv">
                <dt>Modèle</dt><dd>{status.data.model_name}</dd>
                <dt>Type</dt><dd>{status.data.model_type}</dd>
                <dt>Statut</dt><dd>{status.data.status}</dd>
                <dt>Version</dt><dd>{status.data.version}</dd>
              </dl>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
