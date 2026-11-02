import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDown, ArrowUp, Check, Download, FileCheck2, MessageSquare, Printer, RefreshCw, RotateCcw } from 'lucide-react';
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
  downloadCsv,
} from '../utils';

const TONES = {
  THRESHOLD: 'red',
  Z_SCORE: 'orange',
  POWER_VARIATION: 'yellow',
  VOLTAGE: 'blue',
  TEMPERATURE: 'purple',
};
const PAGE_SIZE = 15;
const WORKFLOW_KEY = 'smartenergy.anomaly-workflow';

function readWorkflow() {
  try { return JSON.parse(localStorage.getItem(WORKFLOW_KEY) || '{}'); } catch { return {}; }
}

export default function Anomalies() {
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  const { data: sensorsData, isLoading: sensorsLoading, error: sensorsError } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => api.sensors(),
    staleTime: 60 * 1000,
  });

  const [filters, setFilters] = useState(() => {
    const defaults = { sensorId: '', method: '', start: daysAgoIso(6), end: todayIso() };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('smartenergy.anomaly-filters') || '{}') }; }
    catch { return defaults; }
  });
  const [applied, setApplied] = useState(filters);
  const [formError, setFormError] = useState(null);
  const [page, setPage] = useState(1);
  const [workflow, setWorkflow] = useState(readWorkflow);
  const [noteFor, setNoteFor] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState('ALL');

  useEffect(() => {
    try { localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflow)); } catch { /* Le suivi reste disponible pendant cette session. */ }
  }, [workflow]);

  const updateWorkflow = (key, patch) => setWorkflow(current => ({
    ...current,
    [key]: { ...(current[key] || { status: 'OPEN', note: '' }), ...patch, updatedAt: new Date().toISOString() },
  }));

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
    localStorage.setItem('smartenergy.anomaly-filters', JSON.stringify(filters));
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
    localStorage.removeItem('smartenergy.anomaly-filters');
    setWorkflowFilter('ALL');
    setPage(1);
  };

  const list = useMemo(
    () => (anomaliesData?.list || []).filter(a => {
      if (applied.method && a.method !== applied.method) return false;
      if (workflowFilter === 'ALL') return true;
      const key = `${a.sensorId}|${a.timestamp}|${a.method}`;
      return (workflow[key]?.status || 'OPEN') === workflowFilter;
    }),
    [anomaliesData, applied, workflow, workflowFilter]
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
          <>
            <button className="btn ghost sm" disabled={!list.length} onClick={() => downloadCsv('anomalies.csv', list.map(a => { const explanation = explainAnomaly(a); const key = `${a.sensorId}|${a.timestamp}|${a.method}`; const state = workflow[key] || { status: 'OPEN' }; return { date: a.timestamp, capteur: a.sensorId, methode: METHOD_LABELS[a.method], observed: explanation.observed, seuil: explanation.limit, suivi: state.status, note: state.note }; }))}><Download size={14} /> CSV</button>
            <button className="btn ghost sm" onClick={() => window.print()}><Printer size={14} /> PDF</button>
            <button className="icon-btn" onClick={() => refetch()} title="Actualiser"><RefreshCw size={18} /></button>
          </>
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
      <div className="workflow-local-note"><MessageSquare size={15} /> Les statuts et notes de traitement sont enregistrés sur cet appareil.</div>

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
          <Field label="État de suivi">
            <select value={workflowFilter} onChange={event => setWorkflowFilter(event.target.value)}>
              <option value="ALL">Tous</option><option value="OPEN">À traiter</option><option value="ACKNOWLEDGED">En cours</option><option value="RESOLVED">Résolues</option>
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
                    <th>Suivi</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a, i) => {
                    const e = explainAnomaly(a);
                    const eventKey = `${a.sensorId}|${a.timestamp}|${a.method}`;
                    const state = workflow[eventKey] || { status: 'OPEN', note: '' };
                    return (
                      <Fragment key={`${a.sensorId}-${a.timestamp}-${a.method}-${i}`}>
                        <tr>
                          <td>{dateTime(a.timestamp)}</td>
                          <td className="mono">{a.sensorId}</td>
                          <td><Badge tone={TONES[a.method]}>{METHOD_LABELS[a.method]}</Badge></td>
                          <td><b>{e.observed}</b></td>
                          <td>{e.limit}</td>
                          <td className="explain">{e.text}</td>
                          <td><Badge tone={state.status === 'RESOLVED' ? 'green' : state.status === 'ACKNOWLEDGED' ? 'blue' : 'orange'}>{state.status === 'RESOLVED' ? 'Résolue' : state.status === 'ACKNOWLEDGED' ? 'En cours' : 'À traiter'}</Badge>{state.note && <small className="workflow-note-indicator">Note ajoutée</small>}</td>
                          <td className="workflow-actions">
                            {state.status !== 'RESOLVED' && <button className="btn ghost sm" onClick={() => updateWorkflow(eventKey, { status: state.status === 'ACKNOWLEDGED' ? 'OPEN' : 'ACKNOWLEDGED' })}><Check size={13} /> {state.status === 'ACKNOWLEDGED' ? 'Rouvrir' : 'Prendre en charge'}</button>}
                            <button className="icon-btn" title="Ajouter une note" aria-label="Ajouter une note" onClick={() => { setNoteFor(eventKey); setNoteDraft(state.note || ''); }}><MessageSquare size={15} /></button>
                            {state.status === 'RESOLVED' && <button className="icon-btn" title="Rouvrir l’anomalie" aria-label="Rouvrir l’anomalie" onClick={() => updateWorkflow(eventKey, { status: 'OPEN' })}><RotateCcw size={15} /></button>}
                            {state.status !== 'RESOLVED' && <button className="icon-btn resolve-action" title="Marquer comme résolue" aria-label="Marquer comme résolue" onClick={() => updateWorkflow(eventKey, { status: 'RESOLVED' })}><FileCheck2 size={15} /></button>}
                          </td>
                        </tr>
                        {noteFor === eventKey && <tr className="workflow-note-row"><td colSpan="8"><form onSubmit={event => { event.preventDefault(); updateWorkflow(eventKey, { note: noteDraft }); setNoteFor(null); }}><label htmlFor={`note-${i}`}>Note de traitement</label><textarea id={`note-${i}`} value={noteDraft} onChange={event => setNoteDraft(event.target.value)} rows="2" maxLength="500" placeholder="Décrivez la vérification ou l’intervention réalisée…" /><button className="btn sm">Enregistrer la note</button><button type="button" className="btn ghost sm" onClick={() => setNoteFor(null)}>Annuler</button></form></td></tr>}
                      </Fragment>
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
