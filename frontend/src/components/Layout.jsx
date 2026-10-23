import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Bell, CalendarDays, Cpu, History, LayoutDashboard, LineChart, Search, Zap,
} from 'lucide-react'
import { api } from '../api/client'
import { recentAnomalies, useServices } from '../services'

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/capteurs', label: 'Capteurs', icon: Cpu },
  { to: '/historique', label: 'Historique', icon: History },
  { to: '/anomalies', label: 'Anomalies', icon: AlertTriangle, badge: true },
  { to: '/resume', label: 'Résumé quotidien', icon: CalendarDays },
  { to: '/prevision', label: 'Prévision', icon: LineChart },
]

export default function Layout() {
  const services = useServices()
  const [anomalyCount, setAnomalyCount] = useState(null)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api
      .sensors()
      .then(recentAnomalies)
      .then((list) => setAnomalyCount(list.length))
      .catch(() => setAnomalyCount(null))
  }, [])

  const core = services && ['collector', 'storage', 'analytics', 'mongodb', 'cassandra']
  const coreUp = core && core.every((k) => services[k])

  const submitSearch = (e) => {
    e.preventDefault()
    navigate(`/capteurs?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Zap size={22} fill="currentColor" />
          <span>
            SmartEnergy <b>Hub</b>
          </span>
        </div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={18} />
              <span>{label}</span>
              {badge && anomalyCount > 0 && <em className="nav-badge">{anomalyCount}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div>
            <i className={`dot ${services == null ? '' : coreUp ? 'ok' : 'ko'}`} />
            {services == null ? 'Vérification…' : coreUp ? 'Services en ligne' : 'Service indisponible'}
          </div>
          <small>Collector · Storage · Analytics · Cassandra · MongoDB</small>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <form className="search" onSubmit={submitSearch}>
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un capteur (ID, nom, bâtiment)…"
            />
          </form>
          <div className="top-right">
            <button className="icon-btn" onClick={() => navigate('/anomalies')} title="Anomalies des dernières 24 h">
              <Bell size={18} />
              {anomalyCount > 0 && <em>{anomalyCount}</em>}
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
