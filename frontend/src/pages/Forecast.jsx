import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Brain, Info, LineChart as LineIcon, RefreshCw, RotateCcw } from 'lucide-react';
import { api, settle } from '../api/client';
import {
  Card,
  Empty,
  ErrorBox,
  Field,
  Loading,
  PageHead,
  SensorSelect,
  CardSkeleton,
} from '../components/ui';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import { dateTime, last24h, num, timeShort } from '../utils';

// Le service IA renvoie une prévision par appel (POST /api/v1/forecasts/predict, horizon 1 à 1440 min).
// Pour tracer une courbe, on interroge plusieurs horizons répartis sur la durée choisie.
const HORIZONS = [
  { label: '1 heure', minutes: 60 },
  { label: '6 heures', minutes: 360 },
  { label: '12 heures', minutes: 720 },
  { label: '24 heures', minutes: 1440 },
];
const STEPS = 6;

export default function Forecast() {
  const { data: sensorsData, isLoading: sensorsLoading, isFetching: sensorsFetching, error: sensorsError } = useQuery({
    queryKey: ['sensors', 'active'],
    queryFn: () => api.sensors({ active: true }),
    staleTime: 60 * 1000,
  });

  const { data: modelStatus, isLoading: statusLoading, isFetching: statusFetching, error: statusError, refetch: refetchStatus } = useQuery({
    queryKey: ['modelStatus'],
    queryFn: () => api.modelStatus(),
    staleTime: 60 * 1000,
  });

  const [sensorId, setSensorId] = useState('');
  const [horizon, setHorizon] = useState(360);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    if (sensorsData && !sensorId) setSensorId(sensorsData[0]?.sensorId || '');
  }, [sensorsData]);

  const generate = async e => {
    e.preventDefault();
    setRunning(true);
    setResult(null);
    setGeneratedAt(null);
    const { from, to } = last24h();
    const minutes = Array.from({ length: STEPS }, (_, i) =>
      Math.round((horizon * (i + 1)) / STEPS)
    );
    const [history, ...preds] = await Promise.all([
      settle(api.history(sensorId, from, to, 5000)),
      ...minutes.map(m => settle(api.forecast(sensorId, m))),
    ]);
    const ok = preds.filter(p => p.ok).map(p => p.value);
    setResult({
      sensorId,
      horizon,
      history: history.ok ? history.value.slice().reverse() : [],
      forecasts: ok,
      error: ok.length === 0 ? preds[0]?.error : null,
    });
    setGeneratedAt(new Date());
    setRunning(false);
  };

  const resetFilters = () => {
    setSensorId(sensorsData?.[0]?.sensorId || '');
    setHorizon(360);
    setResult(null);
    setGeneratedAt(null);
  };

  const chart = result
    ? [
        ...result.history.map(m => ({ t: new Date(m.timestamp).getTime(), real: m.powerKw })),
        ...result.forecasts.map(f => ({
          t: new Date(
            f.forecast_time.endsWith('Z') ? f.forecast_time : `${f.forecast_time}Z`
          ).getTime(),
          pred: f.predicted_power_kw,
          band: f.confidence_interval
            ? [f.confidence_interval.lower, f.confidence_interval.upper]
            : undefined,
        })),
      ].sort((a, b) => a.t - b.t)
    : [];
  const last = result?.forecasts.at(-1);

  const activeFilters = [];
  if (sensorId) {
    const sensor = sensorsData?.find(s => s.sensorId === sensorId);
    if (sensor) activeFilters.push({ label: `Capteur: ${sensor.name}`, onRemove: () => {} });
  }
  const horizonLabel = HORIZONS.find(h => h.minutes === horizon)?.label;
  if (horizonLabel) activeFilters.push({ label: `Horizon: ${horizonLabel}`, onRemove: () => {} });

  return (
    <>
      <PageHead
        title="Prévision de la consommation"
        subtitle="Puissance estimée par le service IA (Random Forest) pour les prochaines heures"
        actions={
          <button className="icon-btn" onClick={() => refetchStatus()} title="Actualiser">
            <RefreshCw size={18} />
          </button>
        }
        isFetching={statusFetching}
      >
        {generatedAt && <span className="muted">Généré à {timeShort(generatedAt.toISOString())}</span>}
      </PageHead>

      <ErrorBox error={sensorsError} onRetry={() => refetchStatus()} />

      <Card>
        <form className="filters" onSubmit={generate}>
          <Field label="Capteur">
            <SensorSelect sensors={sensorsData} value={sensorId} onChange={setSensorId} />
          </Field>
          <Field label="Horizon">
            <select value={horizon} onChange={e => setHorizon(Number(e.target.value))}>
              {HORIZONS.map(h => (
                <option key={h.minutes} value={h.minutes}>
                  {h.label}
                </option>
              ))}
            </select>
          </Field>
          <button className="btn" disabled={!sensorId || running}>
            {running ? 'Calcul…' : 'Générer'}
          </button>
          <button type="button" className="btn ghost" onClick={resetFilters}>
            <RotateCcw size={14} /> Réinitialiser
          </button>
        </form>
      </Card>

      <div className="grid two-one">
        <Card title={`Prévision${result ? ` – ${result.sensorId}` : ''}`} icon={LineIcon}>
          {running && <CardSkeleton title lines={4} />}
          {!result && !running && (
            <EmptyState icon="brain" title="Prévision non générée" description="Choisissez un capteur et un horizon, puis cliquez sur « Générer »." />
          )}
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
            <>
              <FilterBar filters={activeFilters} onClear={resetFilters} />
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7ecf3" vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={v => timeShort(new Date(v).toISOString())}
                    tick={{ fontSize: 11 }}
                    minTickGap={40}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={v => dateTime(new Date(v).toISOString())}
                    formatter={(v, name) => [
                      Array.isArray(v) ? `${num(v[0])} – ${num(v[1])} kW` : `${num(v)} kW`,
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    dataKey="band"
                    name="Intervalle de confiance (95 %)"
                    fill="#fbbf24"
                    fillOpacity={0.2}
                    stroke="none"
                    connectNulls
                  />
                  <Line
                    dataKey="real"
                    name="Mesures (24 h)"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    dataKey="pred"
                    name="Prévision"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </Card>

        <div className="stack">
          <Card title="Résultats de la prévision" icon={Info}>
            {!last && <EmptyState icon="info" title="Pas encore de prévision" description="Générez une prévision pour voir les résultats." />}
            {last && (
              <dl className="kv">
                <dt>Puissance prévue (à {result.horizon / 60} h)</dt>
                <dd>{num(last.predicted_power_kw)} kW</dd>
                {last.confidence_interval && (
                  <>
                    <dt>Intervalle de confiance</dt>
                    <dd>
                      {num(last.confidence_interval.lower)} – {num(last.confidence_interval.upper)}{' '}
                      kW
                    </dd>
                  </>
                )}
                <dt>Instant prévu</dt>
                <dd>
                  {dateTime(
                    last.forecast_time.endsWith('Z') ? last.forecast_time : `${last.forecast_time}Z`
                  )}
                </dd>
                <dt>Version du modèle</dt>
                <dd>{last.model_version}</dd>
                <dt>Points calculés</dt>
                <dd>
                  {result.forecasts.length} / {STEPS}
                </dd>
              </dl>
            )}
          </Card>
          <Card title="Modèle de détection (service IA)" icon={Brain}>
            {statusLoading && <Loading />}
            {statusError && <ErrorBox error={statusError} onRetry={() => refetchStatus()} />}
            {modelStatus && (
              <dl className="kv">
                <dt>Modèle</dt>
                <dd>{modelStatus.model_name}</dd>
                <dt>Type</dt>
                <dd>{modelStatus.model_type}</dd>
                <dt>Statut</dt>
                <dd>{modelStatus.status}</dd>
                <dt>Version</dt>
                <dd>{modelStatus.version}</dd>
              </dl>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
