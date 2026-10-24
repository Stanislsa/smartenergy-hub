import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, ArrowDown, ArrowUp, List, RefreshCw, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
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
import { dateTime, daysAgoIso, daysRange, num, todayIso, timeShort } from '../utils';

const METRICS = [
  { key: 'powerKw', label: 'Puissance (kW)', color: '#2563eb', digits: 2 },
  { key: 'voltage', label: 'Tension (V)', color: '#f59e0b', digits: 1 },
  { key: 'temperature', label: 'Température (°C)', color: '#10b981', digits: 1 },
  { key: 'current', label: 'Courant (A)', color: '#8b5cf6', digits: 2 },
  { key: 'frequency', label: 'Fréquence (Hz)', color: '#ef4444', digits: 2 },
];

const PAGE_SIZE = 50;

export default function History() {
  const [params] = useSearchParams();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  const { data: sensorsData, isLoading: sensorsLoading, error: sensorsError } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => api.sensors(),
    staleTime: 60 * 1000,
  });

  const [filters, setFilters] = useState({
    sensorId: params.get('sensor') || '',
    start: daysAgoIso(6),
    end: todayIso(),
    metric: 'all',
  });
  const [applied, setApplied] = useState(null);
  const [formError, setFormError] = useState(null);

  // Premier capteur par défaut, puis chargement initial
  useEffect(() => {
    if (sensorsData && !applied) {
      const sensorId = filters.sensorId || sensorsData[0]?.sensorId || '';
      const f = { ...filters, sensorId };
      setFilters(f);
      setApplied(f);
    }
  }, [sensorsData]);

  const {
    data: historyData,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['history', applied?.sensorId, applied?.start, applied?.end],
    queryFn: async () => {
      if (!applied?.sensorId) return null;
      const { from, to } = daysRange(applied.start, applied.end);
      return api.history(applied.sensorId, from, to, 5000);
    },
    enabled: !!applied?.sensorId,
    staleTime: 60 * 1000,
  });

  const submit = e => {
    e.preventDefault();
    const days = (new Date(filters.end) - new Date(filters.start)) / 86400000 + 1;
    if (days < 1)
      return setFormError('La date de fin doit être postérieure ou égale à la date de début.');
    if (days > 31)
      return setFormError('La période ne peut pas dépasser 31 jours (limite de l’API).');
    setFormError(null);
    setApplied({ ...filters });
    setPage(1);
  };

  const resetFilters = () => {
    const defaultFilters = {
      sensorId: sensorsData?.[0]?.sensorId || '',
      start: daysAgoIso(6),
      end: todayIso(),
      metric: 'all',
    };
    setFilters(defaultFilters);
    setApplied(defaultFilters);
    setPage(1);
  };

  const chart = useMemo(() => (historyData ? historyData.slice().reverse() : []), [historyData]);
  const shown = METRICS.filter(
    m =>
      (applied?.metric === 'all'
        ? ['powerKw', 'voltage', 'temperature'].includes(m.key)
        : m.key === applied?.metric) && chart.some(r => r[m.key] != null)
  );
  const sensor = sensorsData?.find(s => s.sensorId === applied?.sensorId);

  const sortedData = useMemo(() => {
    if (!historyData) return [];
    return [...historyData].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [historyData, sortBy, sortOrder]);

  const pages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const rows = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilters = [];
  if (sensor) activeFilters.push({ label: `Capteur: ${sensor.name}`, onRemove: () => {} });
  if (applied?.start && applied?.end)
    activeFilters.push({
      label: `Du ${applied.start} au ${applied.end}`,
      onRemove: () => {},
    });
  if (applied && applied.metric !== 'all')
    activeFilters.push({
      label: METRICS.find(m => m.key === applied.metric)?.label,
      onRemove: () => {},
    });

  const handleSort = column => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <>
      <PageHead
        title="Historique des mesures"
        subtitle="Évolution des mesures par capteur et par période (Cassandra)"
        actions={
          <button className="icon-btn" onClick={() => refetch()} title="Actualiser">
            <RefreshCw size={18} />
          </button>
        }
        isFetching={isFetching}
      >
        {lastUpdate && <span className="muted">Mis à jour à {timeShort(lastUpdate.toISOString())}</span>}
      </PageHead>

      <ErrorBox error={sensorsError} onRetry={() => refetch()} />

      <Card>
        <form className="filters" onSubmit={submit}>
          <Field label="Capteur">
            <SensorSelect
              sensors={sensorsData}
              value={filters.sensorId}
              onChange={v => setFilters({ ...filters, sensorId: v })}
            />
          </Field>
          <Field label="Du">
            <input
              type="date"
              value={filters.start}
              onChange={e => setFilters({ ...filters, start: e.target.value })}
            />
          </Field>
          <Field label="Au">
            <input
              type="date"
              value={filters.end}
              onChange={e => setFilters({ ...filters, end: e.target.value })}
            />
          </Field>
          <Field label="Métrique">
            <select
              value={filters.metric}
              onChange={e => setFilters({ ...filters, metric: e.target.value })}
            >
              <option value="all">Puissance, tension, température</option>
              {METRICS.map(m => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <button className="btn">Filtrer</button>
          <button type="button" className="btn ghost" onClick={resetFilters}>
            <RotateCcw size={14} /> Réinitialiser
          </button>
        </form>
        {formError && <div className="state error">{formError}</div>}
      </Card>

      <Card
        title={`Évolution des mesures${sensor ? ` – ${sensor.name} (${sensor.sensorId})` : ''}`}
        icon={Activity}
      >
        {isLoading && <CardSkeleton title lines={5} />}
        <ErrorBox error={error} onRetry={() => refetch()} />
        {historyData && historyData.length === 0 && (
          <EmptyState icon="search" title="Aucune mesure" description="Aucune mesure disponible sur cette période." />
        )}
        {chart.length > 0 && shown.length > 1 && shown.some(m => m.key === 'voltage') && (
          <p className="hint">Tension sur l’axe de droite.</p>
        )}
        {chart.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7ecf3" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={v => dateTime(v).slice(0, 5)}
                tick={{ fontSize: 11 }}
                minTickGap={50}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              {shown.some(m => m.key === 'voltage') && shown.length > 1 && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  domain={['auto', 'auto']}
                />
              )}
              <Tooltip labelFormatter={dateTime} formatter={(v, name) => [num(v), name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {shown.map(m => (
                <Line
                  key={m.key}
                  yAxisId={m.key === 'voltage' && shown.length > 1 ? 'right' : 'left'}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={chart.length < 60}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {historyData && historyData.length > 0 && (
        <Card
          title={`Mesures (${historyData.length}${historyData.length === 5000 ? ', limite atteinte' : ''})`}
          icon={List}
          pad={false}
        >
          <FilterBar filters={activeFilters} onClear={resetFilters} />
          <div className="table-wrap scroll">
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('timestamp')} className="sortable">
                    Date / heure {sortBy === 'timestamp' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </th>
                  <th>Capteur</th>
                  {METRICS.map(m => (
                    <th key={m.key} onClick={() => handleSort(m.key)} className="sortable">
                      {m.label} {sortBy === m.key && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(m => (
                  <tr key={m.timestamp}>
                    <td>{dateTime(m.timestamp)}</td>
                    <td className="mono">{m.sensorId}</td>
                    {METRICS.map(x => (
                      <td key={x.key}>{m[x.key] != null ? num(m[x.key], x.digits) : '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <EmptyState icon="search" title="Aucune mesure" description="Aucune mesure ne correspond aux critères." />
            )}
          </div>
          <div className="table-foot">
            <span>
              Affichage de {rows.length} sur {sortedData.length} mesure
              {sortedData.length > 1 ? 's' : ''}
            </span>
            <div className="pager">
              <button
                className="btn ghost sm"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Précédent
              </button>
              <span>
                Page {page} / {pages}
              </span>
              <button
                className="btn ghost sm"
                disabled={page === pages}
                onClick={() => setPage(p => Math.min(pages, p + 1))}
              >
                Suivant
              </button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
