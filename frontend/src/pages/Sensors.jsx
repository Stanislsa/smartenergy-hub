import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CheckCircle2, Cpu, Filter, Plus, PowerOff, RefreshCw, X, XCircle } from 'lucide-react';
import { api, settle } from '../api/client';
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  Field,
  Kpi,
  Loading,
  PageHead,
  Status,
  CardSkeleton,
} from '../components/ui';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import { dateTime, num, timeShort } from '../utils';

async function loadSensors() {
  const sensors = await api.sensors();
  const latest = await Promise.all(sensors.map(s => settle(api.latest(s.sensorId))));
  return sensors.map((s, i) => ({ ...s, last: latest[i].ok ? latest[i].value : null }));
}

const PAGE_SIZE = 10;

export default function Sensors() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').toLowerCase();
  const statusFilter = params.get('status') || 'all';
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [sortBy, setSortBy] = useState('sensorId');
  const [sortOrder, setSortOrder] = useState('asc');

  const {
    data: sensorsData,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['sensors'],
    queryFn: loadSensors,
    staleTime: 60 * 1000,
  });

  const filtered = useMemo(() => {
    let result = (sensorsData || []).filter(s =>
      [s.sensorId, s.name, s.building].some(v => (v || '').toLowerCase().includes(q))
    );

    if (statusFilter !== 'all') {
      result = result.filter(s => (statusFilter === 'active' ? s.active : !s.active));
    }

    return result.sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [sensorsData, q, statusFilter, sortBy, sortOrder]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const stats = sensorsData && {
    total: sensorsData.length,
    active: sensorsData.filter(s => s.active).length,
    inactive: sensorsData.filter(s => !s.active).length,
    noData: sensorsData.filter(s => s.active && !s.last).length,
  };

  const activeFilters = [];
  if (q) activeFilters.push({ label: `Recherche: "${params.get('q')}"`, onRemove: () => setParams({ status: statusFilter }) });
  if (statusFilter !== 'all')
    activeFilters.push({
      label: statusFilter === 'active' ? 'Actifs' : 'Inactifs',
      onRemove: () => setParams({ q: params.get('q') || '' }),
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
        title="Gestion des capteurs"
        subtitle="Capteurs enregistrés dans MongoDB et leur dernière mesure"
        actions={
          <button className="icon-btn" onClick={() => refetch()} title="Actualiser">
            <RefreshCw size={18} />
          </button>
        }
        isFetching={isFetching}
      >
        <button className="btn" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Ajouter un capteur
        </button>
      </PageHead>

      <ErrorBox error={error} onRetry={() => refetch()} />
      {isLoading && !sensorsData && (
        <div className="grid kpis">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {sensorsData && (
        <Card pad={false}>
          <FilterBar filters={activeFilters} onClear={() => setParams({})}>
            <div className="filter-row">
              <select
                value={statusFilter}
                onChange={e => setParams({ q: params.get('q') || '', status: e.target.value })}
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
              </select>
            </div>
          </FilterBar>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('sensorId')} className="sortable">
                    ID {sortBy === 'sensorId' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </th>
                  <th onClick={() => handleSort('name')} className="sortable">
                    Nom {sortBy === 'name' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </th>
                  <th onClick={() => handleSort('building')} className="sortable">
                    Bâtiment {sortBy === 'building' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </th>
                  <th>Étage</th>
                  <th>Pmax</th>
                  <th>Tags</th>
                  <th>Statut</th>
                  <th>Dernière mesure</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.sensorId}>
                    <td className="mono">{s.sensorId}</td>
                    <td>{s.name}</td>
                    <td>{s.building}</td>
                    <td>{s.floor ?? '—'}</td>
                    <td>{num(s.maxPowerKw)} kW</td>
                    <td>
                      {(s.tags || []).map(t => (
                        <Badge key={t} tone="gray">
                          {t}
                        </Badge>
                      ))}
                    </td>
                    <td>
                      <Status ok={s.active} okLabel="Actif" koLabel="Inactif" />
                    </td>
                    <td>
                      {s.last ? (
                        <>
                          {dateTime(s.last.timestamp)}{' '}
                          <small className="muted">· {num(s.last.powerKw)} kW</small>
                        </>
                      ) : (
                        <span className="muted">Aucune (7 j)</span>
                      )}
                    </td>
                    <td>
                      <Link
                        className="link"
                        to={`/historique?sensor=${encodeURIComponent(s.sensorId)}`}
                      >
                        Historique ›
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <EmptyState icon="search" title="Aucun capteur" description="Aucun capteur ne correspond aux filtres appliqués." />
            )}
          </div>
          <div className="table-foot">
            <span>
              Affichage de {rows.length} sur {filtered.length} capteur
              {filtered.length > 1 ? 's' : ''}
              {lastUpdate && ` · Mis à jour à ${timeShort(lastUpdate.toISOString())}`}
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

      {showForm && (
        <SensorForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}
    </>
  );
}

function SensorForm({ onClose, onCreated }) {
  const [form, setForm] = useState({
    sensorId: '',
    name: '',
    building: '',
    floor: '',
    maxPowerKw: '',
    active: true,
    tags: '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = k => e =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createSensor({
        sensorId: form.sensorId.trim(),
        name: form.name.trim(),
        building: form.building.trim(),
        floor: form.floor === '' ? null : Number(form.floor),
        maxPowerKw: form.maxPowerKw === '' ? null : Number(form.maxPowerKw),
        active: form.active,
        tags: form.tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
      });
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <header>
          <h3>Ajouter un capteur</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="form-grid">
          <Field label="Identifiant *">
            <input
              value={form.sensorId}
              onChange={set('sensorId')}
              placeholder="SENSOR-004"
              required
            />
          </Field>
          <Field label="Nom *">
            <input
              value={form.name}
              onChange={set('name')}
              placeholder="Compteur chaufferie"
              required
            />
          </Field>
          <Field label="Bâtiment *">
            <input
              value={form.building}
              onChange={set('building')}
              placeholder="Bâtiment A"
              required
            />
          </Field>
          <Field label="Étage">
            <input type="number" value={form.floor} onChange={set('floor')} />
          </Field>
          <Field label="Puissance max (kW) *">
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={form.maxPowerKw}
              onChange={set('maxPowerKw')}
              required
            />
          </Field>
          <Field label="Tags (séparés par des virgules)">
            <input value={form.tags} onChange={set('tags')} placeholder="critical, server-room" />
          </Field>
          <label className="check">
            <input type="checkbox" checked={form.active} onChange={set('active')} /> Capteur actif
          </label>
        </div>
        <ErrorBox error={error} />
        <footer>
          <button type="button" className="btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </footer>
      </form>
    </div>
  );
}
