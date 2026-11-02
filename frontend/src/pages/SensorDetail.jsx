import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowLeft, Building2, Cpu, Pencil, Power, RefreshCw, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, settle } from '../api/client';
import { Badge, Card, ErrorBox, Field, PageHead, Status } from '../components/ui';
import { dateTime, last24h, num, timeShort } from '../utils';

export default function SensorDetail() {
  const { sensorId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [notice, setNotice] = useState('');
  const query = useQuery({
    queryKey: ['sensor-detail', sensorId],
    queryFn: async () => {
      const sensor = await api.sensor(sensorId);
      const { from, to } = last24h();
      const [latest, history, summary] = await Promise.all([
        settle(api.latest(sensorId)),
        settle(api.history(sensorId, from, to, 1000)),
        settle(api.summary(sensorId, from, to)),
      ]);
      return { sensor, latest: latest.ok ? latest.value : null, history: history.ok ? history.value : [], summary: summary.ok ? summary.value : null };
    },
    staleTime: 60_000,
  });

  const save = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateSensor(sensorId, {
        name: String(form.get('name')).trim(),
        building: String(form.get('building')).trim(),
        floor: form.get('floor') === '' ? null : Number(form.get('floor')),
        maxPowerKw: Number(form.get('maxPowerKw')),
        active: form.get('active') === 'on',
        tags: String(form.get('tags')).split(',').map(tag => tag.trim()).filter(Boolean),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sensor-detail', sensorId] }),
        queryClient.invalidateQueries({ queryKey: ['sensors'] }),
      ]);
      setEditing(false);
      setNotice('Les informations du capteur ont été enregistrées.');
      window.setTimeout(() => setNotice(''), 3500);
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const sensor = query.data?.sensor;
  const points = (query.data?.history || []).slice().reverse();

  return (
    <>
      <PageHead
        title={sensor?.name || 'Détail du capteur'}
        subtitle={sensor ? `${sensor.sensorId} · ${sensor.building || 'Bâtiment non renseigné'}` : 'Chargement des informations du capteur'}
        actions={
          <>
            <button className="btn ghost" onClick={() => navigate('/capteurs')}><ArrowLeft size={15} /> Tous les capteurs</button>
            <button className="icon-btn" onClick={() => query.refetch()} title="Actualiser"><RefreshCw size={17} /></button>
            {sensor && <button className="btn" onClick={() => setEditing(value => !value)}><Pencil size={15} /> Modifier</button>}
          </>
        }
        isFetching={query.isFetching}
      />
      <ErrorBox error={query.error} onRetry={() => query.refetch()} />
      {notice && <div className="state success-notice" role="status">{notice}</div>}
      {sensor && (
        <>
          <div className="grid kpis">
            <div className="card kpi"><div className="kpi-top"><span className="kpi-icon green"><Zap size={19} /></span><div><div className="kpi-label">Dernière puissance</div><div className="kpi-value">{num(query.data.latest?.powerKw)} <small>kW</small></div><div className="kpi-sub">{query.data.latest ? dateTime(query.data.latest.timestamp) : 'Aucune mesure récente'}</div></div></div></div>
            <div className="card kpi"><div className="kpi-top"><span className="kpi-icon blue"><Activity size={19} /></span><div><div className="kpi-label">Énergie sur 24 h</div><div className="kpi-value">{num(query.data.summary?.energyKwh, 1)} <small>kWh</small></div><div className="kpi-sub">{query.data.summary?.measurementCount ?? 0} mesures reçues</div></div></div></div>
            <div className="card kpi"><div className="kpi-top"><span className="kpi-icon orange"><Cpu size={19} /></span><div><div className="kpi-label">Puissance maximale</div><div className="kpi-value">{num(query.data.summary?.maxPowerKw ?? sensor.maxPowerKw)} <small>kW</small></div><div className="kpi-sub">Limite configurée : {num(sensor.maxPowerKw)} kW</div></div></div></div>
            <div className="card kpi"><div className="kpi-top"><span className="kpi-icon teal"><Building2 size={19} /></span><div><div className="kpi-label">État du capteur</div><div className="kpi-value"><Status ok={sensor.active} okLabel="Actif" koLabel="Inactif" /></div><div className="kpi-sub">{sensor.building || 'Bâtiment non renseigné'}{sensor.floor != null ? ` · étage ${sensor.floor}` : ''}</div></div></div></div>
          </div>
          <div className="grid two-one">
            <Card title="Puissance mesurée · 24 dernières heures" icon={Activity}>
              {points.length ? (
                <ResponsiveContainer width="100%" height={290}>
                  <AreaChart data={points} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
                    <defs><linearGradient id="sensor-power-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#18a875" stopOpacity={0.24} /><stop offset="100%" stopColor="#18a875" stopOpacity={0.01} /></linearGradient></defs>
                    <CartesianGrid stroke="#edf1f5" vertical={false} />
                    <XAxis dataKey="timestamp" tickFormatter={timeShort} tick={{ fontSize: 10 }} minTickGap={40} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip labelFormatter={dateTime} formatter={value => [`${num(value)} kW`, 'Puissance']} />
                    <Area type="monotone" dataKey="powerKw" stroke="#18a875" strokeWidth={2} fill="url(#sensor-power-fill)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="state muted">Aucune mesure disponible sur les dernières 24 heures.</div>}
            </Card>
            <Card title="Configuration" icon={Cpu}>
              <dl className="kv">
                <dt>Identifiant</dt><dd className="mono">{sensor.sensorId}</dd>
                <dt>Bâtiment</dt><dd>{sensor.building || '—'}</dd>
                <dt>Étage</dt><dd>{sensor.floor ?? '—'}</dd>
                <dt>Seuil de puissance</dt><dd>{num(sensor.maxPowerKw)} kW</dd>
                <dt>État</dt><dd><Status ok={sensor.active} okLabel="Actif" koLabel="Inactif" /></dd>
                <dt>Dernière mesure</dt><dd>{query.data.latest ? dateTime(query.data.latest.timestamp) : '—'}</dd>
              </dl>
              <div className="sensor-tags">{(sensor.tags || []).length ? sensor.tags.map(tag => <Badge key={tag} tone="gray">{tag}</Badge>) : <span className="muted">Aucun tag</span>}</div>
              <Link className="link sensor-history-link" to={`/historique?sensor=${encodeURIComponent(sensor.sensorId)}`}>Ouvrir l’historique complet →</Link>
            </Card>
          </div>
          {editing && (
            <Card title="Modifier le capteur" icon={Pencil}>
              <form className="filters" onSubmit={save}>
                <Field label="Nom"><input name="name" defaultValue={sensor.name} required /></Field>
                <Field label="Bâtiment"><input name="building" defaultValue={sensor.building} required /></Field>
                <Field label="Étage"><input name="floor" type="number" defaultValue={sensor.floor ?? ''} /></Field>
                <Field label="Seuil maximal (kW)"><input name="maxPowerKw" type="number" min="0.1" step="0.1" defaultValue={sensor.maxPowerKw} required /></Field>
                <Field label="Tags (séparés par des virgules)"><input name="tags" defaultValue={(sensor.tags || []).join(', ')} /></Field>
                <label className="sensor-active-field"><input type="checkbox" name="active" defaultChecked={sensor.active} /> <Power size={14} /> Capteur actif</label>
                <div className="sensor-edit-actions"><button type="button" className="btn ghost" onClick={() => setEditing(false)}>Annuler</button><button className="btn" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
                <ErrorBox error={saveError} />
              </form>
            </Card>
          )}
        </>
      )}
    </>
  );
}
