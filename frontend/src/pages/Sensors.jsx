import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Cpu, Plus, PowerOff, X, XCircle } from 'lucide-react'
import { api, settle } from '../api/client'
import { Badge, Card, Empty, ErrorBox, Field, Kpi, Loading, PageHead, Status } from '../components/ui'
import { dateTime, num, useAsync } from '../utils'

async function loadSensors() {
  const sensors = await api.sensors()
  const latest = await Promise.all(sensors.map((s) => settle(api.latest(s.sensorId))))
  return sensors.map((s, i) => ({ ...s, last: latest[i].ok ? latest[i].value : null }))
}

const PAGE_SIZE = 10

export default function Sensors() {
  const { data, loading, error, reload } = useAsync(loadSensors, [])
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') || '').toLowerCase()
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)

  const filtered = useMemo(
    () =>
      (data || []).filter((s) =>
        [s.sensorId, s.name, s.building].some((v) => (v || '').toLowerCase().includes(q)),
      ),
    [data, q],
  )
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const stats = data && {
    total: data.length,
    active: data.filter((s) => s.active).length,
    inactive: data.filter((s) => !s.active).length,
    noData: data.filter((s) => s.active && !s.last).length,
  }

  return (
    <>
      <PageHead title="Gestion des capteurs" subtitle="Capteurs enregistrés dans MongoDB et leur dernière mesure">
        <button className="btn" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Ajouter un capteur
        </button>
      </PageHead>

      <ErrorBox error={error} onRetry={reload} />
      {loading && !data && <Loading />}

      {stats && (
        <div className="grid kpis">
          <Kpi icon={Cpu} color="blue" label="Total des capteurs" value={stats.total} />
          <Kpi icon={CheckCircle2} color="green" label="Actifs" value={stats.active} />
          <Kpi icon={PowerOff} color="red" label="Inactifs" value={stats.inactive} />
          <Kpi icon={XCircle} color="orange" label="Actifs sans mesure (7 j)" value={stats.noData} />
        </div>
      )}

      {data && (
        <Card pad={false}>
          {q && (
            <div className="filter-note">
              Recherche : « {params.get('q')} » ({filtered.length} résultat{filtered.length > 1 ? 's' : ''}){' '}
              <button className="link" onClick={() => setParams({})}>Effacer</button>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Bâtiment</th>
                  <th>Étage</th>
                  <th>Pmax</th>
                  <th>Tags</th>
                  <th>Statut</th>
                  <th>Dernière mesure</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.sensorId}>
                    <td className="mono">{s.sensorId}</td>
                    <td>{s.name}</td>
                    <td>{s.building}</td>
                    <td>{s.floor ?? '—'}</td>
                    <td>{num(s.maxPowerKw)} kW</td>
                    <td>{(s.tags || []).map((t) => <Badge key={t} tone="gray">{t}</Badge>)}</td>
                    <td>
                      <Status ok={s.active} okLabel="Actif" koLabel="Inactif" />
                    </td>
                    <td>
                      {s.last ? (
                        <>
                          {dateTime(s.last.timestamp)} <small className="muted">· {num(s.last.powerKw)} kW</small>
                        </>
                      ) : (
                        <span className="muted">Aucune (7 j)</span>
                      )}
                    </td>
                    <td>
                      <Link className="link" to={`/historique?sensor=${encodeURIComponent(s.sensorId)}`}>
                        Historique ›
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <Empty>Aucun capteur.</Empty>}
          </div>
          <div className="table-foot">
            <span>
              Affichage de {rows.length} sur {filtered.length} capteur{filtered.length > 1 ? 's' : ''}
            </span>
            <div className="pager">
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} className={page === i + 1 ? 'on' : ''} onClick={() => setPage(i + 1)}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {showForm && (
        <SensorForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            reload()
          }}
        />
      )}
    </>
  )
}

function SensorForm({ onClose, onCreated }) {
  const [form, setForm] = useState({ sensorId: '', name: '', building: '', floor: '', maxPowerKw: '', active: true, tags: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.createSensor({
        sensorId: form.sensorId.trim(),
        name: form.name.trim(),
        building: form.building.trim(),
        floor: form.floor === '' ? null : Number(form.floor),
        maxPowerKw: form.maxPowerKw === '' ? null : Number(form.maxPowerKw),
        active: form.active,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      onCreated()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header>
          <h3>Ajouter un capteur</h3>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="form-grid">
          <Field label="Identifiant *"><input value={form.sensorId} onChange={set('sensorId')} placeholder="SENSOR-004" required /></Field>
          <Field label="Nom *"><input value={form.name} onChange={set('name')} placeholder="Compteur chaufferie" required /></Field>
          <Field label="Bâtiment *"><input value={form.building} onChange={set('building')} placeholder="Bâtiment A" required /></Field>
          <Field label="Étage"><input type="number" value={form.floor} onChange={set('floor')} /></Field>
          <Field label="Puissance max (kW) *"><input type="number" step="0.1" min="0.1" value={form.maxPowerKw} onChange={set('maxPowerKw')} required /></Field>
          <Field label="Tags (séparés par des virgules)"><input value={form.tags} onChange={set('tags')} placeholder="critical, server-room" /></Field>
          <label className="check"><input type="checkbox" checked={form.active} onChange={set('active')} /> Capteur actif</label>
        </div>
        <ErrorBox error={error} />
        <footer>
          <button type="button" className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </footer>
      </form>
    </div>
  )
}
