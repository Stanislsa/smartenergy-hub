import { useEffect, useMemo, useState } from 'react';
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
  { label: '48 heures', minutes: 2880 },
  { label: '3 jours', minutes: 4320 },
  { label: '7 jours', minutes: 10080 },
];
const MODELS = [
  { label: 'Random Forest (court terme)', value: 'rf', description: 'Précisions à court terme (1-24h)' },
  { label: 'LSTM (long terme)', value: 'lstm', description: 'Prévisions à long terme (jusqu\'à 7 jours)' },
];

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
  const [model, setModel] = useState('rf');
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
    const forecastFn = model === 'lstm' ? api.forecastLSTM : api.forecast;
    const [history, forecast] = await Promise.all([
      settle(api.history(sensorId, from, to, 5000)),
      settle(forecastFn(sensorId, horizon)),
    ]);
    setResult({
      sensorId,
      horizon,
      model,
      history: history.ok ? history.value.slice().reverse() : [],
      forecast: forecast.ok ? forecast.value : null,
      error: forecast.error || history.error,
    });
    setGeneratedAt(new Date());
    setRunning(false);
  };

  const resetFilters = () => {
    setSensorId(sensorsData?.[0]?.sensorId || '');
    setHorizon(360);
    setModel('rf');
    setResult(null);
    setGeneratedAt(null);
  };

  const chart = useMemo(() => {
    if (!result?.forecast) return [];
    
    const historyData = result.history.map(m => ({ t: new Date(m.timestamp).getTime(), real: m.powerKw }));
    const forecastData = result.forecast.forecast_series.map(f => {
      const ci = f.confidence_interval;
      const bandWidth = ci ? ci.upper - ci.lower : 0;
      const predValue = f.predicted_power_kw;
      const relativeWidth = predValue > 0 ? (bandWidth / predValue) * 100 : 0;
      
      let bandColor = '#fbbf24';
      if (relativeWidth < 10) bandColor = '#10b981';
      else if (relativeWidth > 25) bandColor = '#ef4444';
      
      return {
        t: new Date(f.timestamp).getTime(),
        pred: f.predicted_power_kw,
        band: ci ? [ci.lower, ci.upper] : undefined,
        bandColor,
        bandWidth,
        relativeWidth,
      };
    });
    
    return [...historyData, ...forecastData].sort((a, b) => a.t - b.t);
  }, [result?.forecast, result?.history]);
  
  const last = result?.forecast?.forecast_series?.at(-1);

  const activeFilters = [];
  if (sensorId) {
    const sensor = sensorsData?.find(s => s.sensorId === sensorId);
    if (sensor) activeFilters.push({ label: `Capteur: ${sensor.name}`, onRemove: () => {} });
  }
  const horizonLabel = HORIZONS.find(h => h.minutes === horizon)?.label;
  if (horizonLabel) activeFilters.push({ label: `Horizon: ${horizonLabel}`, onRemove: () => {} });
  const modelLabel = MODELS.find(m => m.value === model)?.label;
  if (modelLabel) activeFilters.push({ label: `Modèle: ${modelLabel}`, onRemove: () => {} });

  return (
    <>
      <PageHead
        title="Prévision de la consommation"
        subtitle="Puissance estimée par le service IA (Random Forest ou LSTM) pour les prochaines heures"
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
          <Field label="Modèle">
            <select value={model} onChange={e => setModel(e.target.value)}>
              {MODELS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {model === 'lstm' && <p className="hint">Nécessite 7 jours d\'historique (168h)</p>}
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
                  ? result.model === 'lstm'
                    ? 'Le modèle LSTM n\'est pas encore entraîné (fichier du modèle absent dans ai-service).'
                    : 'Le modèle de prévision n\'est pas encore entraîné (fichier du modèle absent dans ai-service).'
                  : result.error.status === 422 && result.model === 'lstm'
                    ? 'Données insuffisantes pour LSTM : besoin de 7 jours (168h) d\'historique.'
                    : result.error.status === 0
                      ? 'Le service IA (port 8085) ne répond pas : vérifiez qu\'il est démarré.'
                      : 'Le service IA a renvoyé une erreur : voir ses logs.'}
              </p>
            </>
          )}
          {result && !result.error && result.forecast && chart.length > 0 && (
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
            {!result?.forecast && <EmptyState icon="info" title="Pas encore de prévision" description="Générez une prévision pour voir les résultats." />}
            {result?.forecast && (
              <>
                <dl className="kv">
                  <dt>Points de prévision</dt>
                  <dd>{result.forecast.forecast_series.length} heures</dd>
                  <dt>Horizon total</dt>
                  <dd>{result.horizon / 60} heures</dd>
                  <dt>Puissance moyenne prévue</dt>
                  <dd>
                    {num(result.forecast.forecast_series.reduce((sum, f) => sum + f.predicted_power_kw, 0) / result.forecast.forecast_series.length)} kW
                  </dd>
                  <dt>Puissance max prévue</dt>
                  <dd>{num(Math.max(...result.forecast.forecast_series.map(f => f.predicted_power_kw)))} kW</dd>
                  <dt>Puissance min prévue</dt>
                  <dd>{num(Math.min(...result.forecast.forecast_series.map(f => f.predicted_power_kw)))} kW</dd>
                  <dt>Version du modèle</dt>
                  <dd>{result.forecast.model_version}</dd>
                </dl>
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Intervalles de confiance par heure</h4>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '12px' }}>
                    {result.forecast.forecast_series.map((f, i) => {
                      const ci = f.confidence_interval;
                      const bandWidth = ci ? ci.upper - ci.lower : 0;
                      const predValue = f.predicted_power_kw;
                      const relativeWidth = predValue > 0 ? (bandWidth / predValue) * 100 : 0;
                      let color = '#fbbf24';
                      if (relativeWidth < 10) color = '#10b981';
                      else if (relativeWidth > 25) color = '#ef4444';
                      const time = new Date(f.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ color: '#6b7280' }}>{time}</span>
                          <span style={{ fontWeight: 500 }}>{num(f.predicted_power_kw)} kW</span>
                          <span style={{ color }}>
                            [{num(ci?.lower)} – {num(ci?.upper)}] ({relativeWidth.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
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
