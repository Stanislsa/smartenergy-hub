import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDown, ArrowUp, RefreshCw, RotateCcw } from 'lucide-react';
import { api, settle } from '../api/client';
import {
  Badge,
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
import {
  METHOD_LABELS,
  dateTime,
  daysAgoIso,
  daysRange,
  explainAnomaly,
  todayIso,
  timeShort,
} from '../utils';

const TONES = {
  THRESHOLD: 'red',
  Z_SCORE: 'orange',
  POWER_VARIATION: 'yellow',
  VOLTAGE: 'blue',
  TEMPERATURE: 'purple',
};
const PAGE_SIZE = 15;

export default function Anomalies() {
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  const { data: sensorsData, isLoading: sensorsLoading, error: sensorsError } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => api.sensors(),
    staleTime: 60 * 1000,
  });

  const [filters, setFilters] = useState({
    sensorId: '',
    method: '',
    start: daysAgoIso(6),
    end: todayIso(),
  });
  const [applied, setApplied] = useState(filters);
  const [formError, setFormError] = useState(null);
  const [page, setPage] = useState(1);

  const {
    data: anomaliesData,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['anomalies', applied?.sensorId, applied?.start, applied?.end],
    queryFn: async () => {
      if (!sensorsData) return null;
      const { from, to } = daysRange(applied.start, applied.end);
      const targets = applied.sensorId
        ? sensorsData.filter(s => s.sensorId === applied.sensorId)
        : sensorsData;
      const results = await Promise.all(
        targets.map(s => settle(api.anomalies(s.sensorId, from, to)))
      );
      const list = [];
      const failed = [];
      results.forEach((r, i) => {
        if (r.ok) {
          r.value.anomalies.forEach(a => list.push({ ...a, sensorId: targets[i].sensorId, sensorName: targets[i].name }));
        } else {
          failed.push({ sensorId: targets[i].sensorId, error: r.error });
        }
      });
      return { list, failed };
    },
    enabled: !!sensorsData,
    staleTime: 60 * 1000,
  });

  useEffect(() => setPage(1), [applied]);

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
      sensorId: '',
      method: '',
      start: daysAgoIso(6),
      end: todayIso(),
    };
    setFilters(defaultFilters);
    setApplied(defaultFilters);
    setPage(1);
  };

  const list = useMemo(
    () => (anomaliesData?.list || []).filter(a => !applied.method || a.method === applied.method),
    [anomaliesData, applied]
  );
  const counts = useMemo(() => {
    const c = {};
    (anomaliesData?.list || []).forEach(a => (c[a.method] = (c[a.method] || 0) + 1));
    return c;
  }, [anomaliesData]);

  const sortedList = useMemo(() => {
    return [...list].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [list, sortBy, sortOrder]);

  const pages = Math.max(1, Math.ceil(sortedList.length / PAGE_SIZE));
  const rows = sortedList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilters = [];
  if (applied.sensorId) {
    const sensor = sensorsData?.find(s => s.sensorId === applied.sensorId);
    if (sensor) activeFilters.push({ label: `Capteur: ${sensor.name}`, onRemove: () => {} });
  }
  if (applied.start && applied.end)
    activeFilters.push({
      label: `Du ${applied.start} au ${applied.end}`,
      onRemove: () => {},
    });
  if (applied.method)
    activeFilters.push({
      label: METHOD_LABELS[applied.method],
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
        title="Alertes et anomalies"
        subtitle="Anomalies détectées par analytics-service (seuil, z-score, variation, tension, température)"
        actions={
          <button className="icon-btn" onClick={() => refetch()} title="Actualiser">
            <RefreshCw size={18} />
          </button>
        }
        isFetching={isFetching}
      >
        {anomaliesData && (
          <span className="pill red">
            <AlertTriangle size={14} /> {anomaliesData.list.length} anomalie
            {anomaliesData.list.length > 1 ? 's' : ''} sur la période
          </span>
        )}
        {lastUpdate && <span className="muted">Mis à jour à {timeShort(lastUpdate.toISOString())}</span>}
      </PageHead>

      <ErrorBox error={sensorsError} onRetry={() => refetch()} />

      <Card>
        <form className="filters" onSubmit={submit}>
          <Field label="Capteur">
            <SensorSelect
              allowAll
              sensors={sensorsData}
              value={filters.sensorId}
              onChange={v => setFilters({ ...filters, sensorId: v })}
            />
          </Field>
          <Field label="Méthode">
            <select
              value={filters.method}
              onChange={e => setFilters({ ...filters, method: e.target.value })}
            >
              <option value="">Toutes les méthodes</option>
              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
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
          <button className="btn">Filtrer</button>
          <button type="button" className="btn ghost" onClick={resetFilters}>
            <RotateCcw size={14} /> Réinitialiser
          </button>
        </form>
        {formError && <div className="state error">{formError}</div>}
        {anomaliesData && (
          <div className="chips">
            {Object.entries(METHOD_LABELS).map(([k, v]) => (
              <Badge key={k} tone={TONES[k]}>
                {v} : {counts[k] || 0}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card pad={false}>
        {isLoading && <CardSkeleton title lines={8} />}
        <ErrorBox error={error} onRetry={() => refetch()} />
        {anomaliesData?.failed.length > 0 && (
          <div className="state error">Capteurs non analysés : {anomaliesData.failed.join(' ; ')}</div>
        )}
        {anomaliesData && sortedList.length === 0 && (
          <EmptyState icon="alert-triangle" title="Aucune anomalie" description="Aucune anomalie détectée sur cette période." />
        )}
        {rows.length > 0 && (
          <>
            <FilterBar filters={activeFilters} onClear={resetFilters} />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('timestamp')} className="sortable">
                      Date / heure {sortBy === 'timestamp' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                    </th>
                    <th>Capteur</th>
                    <th onClick={() => handleSort('method')} className="sortable">
                      Méthode {sortBy === 'method' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                    </th>
                    <th>Valeur observée</th>
                    <th>Seuil</th>
                    <th>Explication</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a, i) => {
                    const e = explainAnomaly(a);
                    return (
                      <tr key={`${a.sensorId}-${a.timestamp}-${a.method}-${i}`}>
                        <td>{dateTime(a.timestamp)}</td>
                        <td className="mono">{a.sensorId}</td>
                        <td>
                          <Badge tone={TONES[a.method]}>{METHOD_LABELS[a.method]}</Badge>
                        </td>
                        <td>
                          <b>{e.observed}</b>
                        </td>
                        <td>{e.limit}</td>
                        <td className="explain">{e.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {sortedList.length > 0 && (
          <div className="table-foot">
            <span>
              Affichage de {rows.length} sur {sortedList.length} anomalie
              {sortedList.length > 1 ? 's' : ''}
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
        )}
      </Card>
    </>
  );
}
