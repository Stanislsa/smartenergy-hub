import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Activity, AlertTriangle, Cpu, Gauge, Server, Thermometer, Zap } from 'lucide-react'
import { api, settle } from '../api/client'
import { Card, Empty, ErrorBox, Kpi, Loading, PageHead, SensorSelect, Status } from '../components/ui'
import { SERVICES, recentAnomalies, useServices } from '../services'
import { METHOD_LABELS, dateTime, explainAnomaly, last24h, num, relative, timeShort, useAsync } from '../utils'

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

async function loadDashboard() {
  const sensors = await api.sensors()
  const active = sensors.filter((s) => s.active)
  const latest = await Promise.all(active.map((s) => settle(api.latest(s.sensorId))))
  const anomalies = await recentAnomalies(sensors)
  return {
    sensors,
    latest: latest.filter((r) => r.ok).map((r) => r.value),
    anomalies,
  }
}

const avg = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(loadDashboard, [])
  const services = useServices()

  const kpis = useMemo(() => {
    if (!data) return null
    const p = data.latest.map((m) => m.powerKw).filter((v) => v != null)
    const v = data.latest.map((m) => m.voltage).filter((x) => x != null)
    const t = data.latest.map((m) => m.temperature).filter((x) => x != null)
    return {
      power: p.length ? p.reduce((a, b) => a + b, 0) : null,
      voltage: avg(v),
      temp: avg(t),
      count: data.latest.length,
      active: data.sensors.filter((s) => s.active).length,
      total: data.sensors.length,
    }
  }, [data])

  const byBuilding = useMemo(() => {
    if (!data) return []
    const m = {}
    data.sensors.forEach((s) => {
      m[s.building || 'Non renseigné'] = (m[s.building || 'Non renseigné'] || 0) + 1
    })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  }, [data])

  const now = new Date()

  return (
    <>
      <PageHead title="Tableau de bord" subtitle="Aperçu de votre système énergétique">
        <span className="muted">
          {now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
          {timeShort(now.toISOString())}
        </span>
      </PageHead>

      <ErrorBox error={error} onRetry={reload} />
      {loading && !data && <Loading />}

      {kpis && (
        <div className="grid kpis">
          <Kpi icon={Zap} color="green" label="Puissance totale" value={num(kpis.power)} unit="kW"
            sub={`Somme des dernières mesures (${kpis.count} capteur${kpis.count > 1 ? 's' : ''})`} />
          <Kpi icon={Gauge} color="blue" label="Tension moyenne" value={num(kpis.voltage, 1)} unit="V"
            sub="Moyenne des dernières mesures" />
          <Kpi icon={Thermometer} color="orange" label="Température moyenne" value={num(kpis.temp, 1)} unit="°C"
            sub="Moyenne des dernières mesures" />
          <Kpi icon={Cpu} color="teal" label="Capteurs actifs" value={`${kpis.active} / ${kpis.total}`}
            sub={`${kpis.total ? Math.round((kpis.active / kpis.total) * 100) : 0} % actifs`} />
        </div>
      )}

      {data && (
        <div className="grid two-one">
          <PowerChart sensors={data.sensors.filter((s) => s.active)} />
          <Card title="Répartition des capteurs par bâtiment" icon={Activity}>
            <div className="donut-wrap">
              <ResponsiveContainer width={170} height={170}>
                <PieChart>
                  <Pie data={byBuilding} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                    {byBuilding.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <b>{data.sensors.length}</b>
                <span>capteurs</span>
              </div>
              <ul className="legend">
                {byBuilding.map((b, i) => (
                  <li key={b.name}>
                    <i style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span>{b.name}</span>
                    <b>{b.value}</b>
                    <em>{Math.round((b.value / data.sensors.length) * 100)} %</em>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      )}

      <div className="grid two">
        <Card title="État des services" icon={Server}>
          <div className="services">
            {SERVICES.map((s) => (
              <div key={s.key} className="service">
                <Server size={16} />
                <div>
                  <b>{s.label} <small>:{s.port}</small></b>
                  {services == null ? <span className="muted">…</span> : <Status ok={services[s.key]} />}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title={data ? `${data.anomalies.length} anomalie${data.anomalies.length > 1 ? 's' : ''} (24 h)` : 'Anomalies (24 h)'}
          icon={AlertTriangle}
          actions={<Link to="/anomalies" className="link">Voir tout ›</Link>}
        >
          {data && data.anomalies.length === 0 && <Empty>Aucune anomalie sur les dernières 24 h.</Empty>}
          <ul className="alerts">
            {data?.anomalies.slice(0, 4).map((a, i) => {
              const e = explainAnomaly(a)
              return (
                <li key={i}>
                  <span className={`alert-icon m-${a.method}`}>
                    <AlertTriangle size={14} />
                  </span>
                  <div>
                    <b>{a.sensorId}</b> · {METHOD_LABELS[a.method]}
                    <small>
                      {e.text} ({e.observed})
                    </small>
                  </div>
                  <time title={dateTime(a.timestamp)}>{relative(a.timestamp)}</time>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </>
  )
}

function PowerChart({ sensors }) {
  const [sensorId, setSensorId] = useState(sensors[0]?.sensorId || '')
  const sensor = sensors.find((s) => s.sensorId === sensorId)
  const { data, loading, error } = useAsync(async () => {
    if (!sensorId) return []
    const { from, to } = last24h()
    const list = await api.history(sensorId, from, to, 5000)
    return list
      .slice()
      .reverse()
      .map((m) => ({ t: m.timestamp, power: m.powerKw }))
  }, [sensorId])

  return (
    <Card
      title="Évolution de la puissance (kW) – 24 h"
      icon={Activity}
      actions={<SensorSelect sensors={sensors} value={sensorId} onChange={setSensorId} />}
    >
      {loading && <Loading />}
      <ErrorBox error={error} />
      {data && data.length === 0 && <Empty>Aucune mesure sur les dernières 24 h pour ce capteur.</Empty>}
      {data && data.length > 0 && (
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gPower" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7ecf3" vertical={false} />
            <XAxis dataKey="t" tickFormatter={timeShort} tick={{ fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={dateTime} formatter={(v) => [`${num(v)} kW`, 'Puissance']} />
            {sensor?.maxPowerKw && (
              <ReferenceLine y={sensor.maxPowerKw} stroke="#ef4444" strokeDasharray="4 4"
                label={{ value: `Pmax ${num(sensor.maxPowerKw)} kW`, fontSize: 11, fill: '#ef4444', position: 'insideTopRight' }} />
            )}
            <Area type="monotone" dataKey="power" stroke="#10b981" strokeWidth={2} fill="url(#gPower)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
