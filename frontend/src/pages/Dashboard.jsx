import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, Cpu, Gauge, RefreshCw, Server, Thermometer, Zap } from 'lucide-react';
import { api, settle } from '../api/client';
import {
  Card,
  Empty,
  ErrorBox,
  Kpi,
  Loading,
  PageHead,
  SensorSelect,
  Status,
  CardSkeleton,
} from '../components/ui';
import EmptyState from '../components/EmptyState';
import { SERVICES, recentAnomalies, useServices } from '../services';
import {
  METHOD_LABELS,
  dateTime,
  explainAnomaly,
  last24h,
  num,
  relative,
  timeShort,
} from '../utils';

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

async function loadDashboard() {
  const sensors = await api.sensors();
  const active = sensors.filter(s => s.active);
  const latest = await Promise.all(active.map(s => settle(api.latest(s.sensorId))));
  const anomalies = await recentAnomalies(sensors);
  return {
    sensors,
    latest: latest.filter(r => r.ok).map(r => r.value),
    anomalies,
  };
}

const avg = values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export default function Dashboard() {
  const services = useServices();

  const {
    data: dashboardData,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: loadDashboard,
    staleTime: 60 * 1000, // 1 minute
  });

  const kpis = useMemo(() => {
    if (!dashboardData) return null;
    const p = dashboardData.latest.map(m => m.powerKw).filter(v => v != null);
    const v = dashboardData.latest.map(m => m.voltage).filter(x => x != null);
    const t = dashboardData.latest.map(m => m.temperature).filter(x => x != null);
    return {
      power: p.length ? p.reduce((a, b) => a + b, 0) : null,
      voltage: avg(v),
      temp: avg(t),
      count: dashboardData.latest.length,
      active: dashboardData.sensors.filter(s => s.active).length,
      total: dashboardData.sensors.length,
      latestTimestamp: dashboardData.latest.length
        ? Math.max(...dashboardData.latest.map(m => new Date(m.timestamp).getTime()))
        : null,
    };
  }, [dashboardData]);

  const byBuilding = useMemo(() => {
    if (!dashboardData) return [];
    const m = {};
    dashboardData.sensors.forEach(s => {
      m[s.building || 'Non renseigné'] = (m[s.building || 'Non renseigné'] || 0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [dashboardData]);

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const { from, to } = last24h();

  return (
    <>
      <PageHead
        title="Tableau de bord"
        subtitle="Aperçu de votre système énergétique"
        actions={
          <button className="icon-btn" onClick={() => refetch()} title="Actualiser">
            <RefreshCw size={18} />
          </button>
        }
        isFetching={isFetching}
      >
        {lastUpdate && (
          <span className="muted">
            Mis à jour à {timeShort(lastUpdate.toISOString())} ·{' '}
            {kpis?.latestTimestamp && (
              <span>Dernière mesure : {relative(kpis.latestTimestamp)}</span>
            )}
          </span>
        )}
      </PageHead>

      <ErrorBox error={error} onRetry={() => refetch()} />
      {isLoading && !dashboardData && (
        <div className="grid kpis">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {kpis && (
        <div className="grid kpis">
          <Kpi
            icon={Zap}
            color="green"
            label="Puissance totale"
            value={num(kpis.power)}
            unit="kW"
            sub={`Somme des dernières mesures (${kpis.count} capteur${kpis.count > 1 ? 's' : ''})`}
          />
          <Kpi
            icon={Gauge}
            color="blue"
            label="Tension moyenne"
            value={num(kpis.voltage, 1)}
            unit="V"
            sub="Moyenne des dernières mesures"
          />
          <Kpi
            icon={Thermometer}
            color="orange"
            label="Température moyenne"
            value={num(kpis.temp, 1)}
            unit="°C"
            sub="Moyenne des dernières mesures"
          />
          <Kpi
            icon={Cpu}
            color="teal"
            label="Capteurs actifs"
            value={`${kpis.active} / ${kpis.total}`}
            sub={`${kpis.total ? Math.round((kpis.active / kpis.total) * 100) : 0} % actifs`}
          />
        </div>
      )}

      {dashboardData && (
        <div className="grid two-one">
          <PowerChart sensors={dashboardData.sensors.filter(s => s.active)} period={{ from, to }} />
          <Card title="Répartition des capteurs par bâtiment" icon={Activity}>
            <div className="donut-wrap">
              <ResponsiveContainer width={170} height={170}>
                <PieChart>
                  <Pie
                    data={byBuilding}
                    dataKey="value"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {byBuilding.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <b>{dashboardData.sensors.length}</b>
                <span>capteurs</span>
              </div>
              <ul className="legend">
                {byBuilding.map((b, i) => (
                  <li key={b.name}>
                    <i style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span>{b.name}</span>
                    <b>{b.value}</b>
                    <em>{Math.round((b.value / dashboardData.sensors.length) * 100)} %</em>
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
            {SERVICES.map(s => (
              <div key={s.key} className="service">
                <Server size={16} />
                <div>
                  <b>
                    {s.label} <small>:{s.port}</small>
                  </b>
                  {services == null ? (
                    <span className="muted">…</span>
                  ) : (
                    <Status ok={services[s.key]} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title={
            dashboardData
              ? `${dashboardData.anomalies.length} anomalie${dashboardData.anomalies.length > 1 ? 's' : ''} (24 h)`
              : 'Anomalies (24 h)'
          }
          icon={AlertTriangle}
          actions={
            <Link to="/anomalies" className="link">
              Voir tout ›
            </Link>
          }
        >
          {dashboardData && dashboardData.anomalies.length === 0 && (
            <EmptyState icon="inbox" title="Aucune anomalie" description="Aucune anomalie détectée sur les dernières 24 heures." />
          )}
          <ul className="alerts">
            {dashboardData?.anomalies.slice(0, 4).map((a, i) => {
              const e = explainAnomaly(a);
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
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}

function PowerChart({ sensors, period }) {
  const [sensorId, setSensorId] = useState(sensors[0]?.sensorId || '');
  const sensor = sensors.find(s => s.sensorId === sensorId);

  const { data, isLoading, error } = useQuery({
    queryKey: ['power-chart', sensorId, period],
    queryFn: async () => {
      if (!sensorId) return [];
      const list = await api.history(sensorId, period.from, period.to, 5000);
      return list
        .slice()
        .reverse()
        .map(m => ({ t: m.timestamp, power: m.powerKw }));
    },
    enabled: !!sensorId,
    staleTime: 60 * 1000,
  });

  return (
    <Card
      title={`Évolution de la puissance (kW) – ${timeShort(period.from)} à ${timeShort(period.to)}`}
      icon={Activity}
      actions={<SensorSelect sensors={sensors} value={sensorId} onChange={setSensorId} />}
    >
      {isLoading && <Loading />}
      <ErrorBox error={error} />
      {data && data.length === 0 && (
        <EmptyState icon="search" title="Aucune mesure" description="Aucune mesure disponible pour cette période." />
      )}
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
            <Tooltip labelFormatter={dateTime} formatter={v => [`${num(v)} kW`, 'Puissance']} />
            {sensor?.maxPowerKw && (
              <ReferenceLine
                y={sensor.maxPowerKw}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{
                  value: `Pmax ${num(sensor.maxPowerKw)} kW`,
                  fontSize: 11,
                  fill: '#ef4444',
                  position: 'insideTopRight',
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="power"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gPower)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
