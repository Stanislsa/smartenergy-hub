import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cpu,
  History,
  LayoutDashboard,
  LineChart,
  Menu,
  Search,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { recentAnomalies, useServices } from '../services';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/capteurs', label: 'Capteurs', icon: Cpu },
  { to: '/historique', label: 'Historique', icon: History },
  { to: '/anomalies', label: 'Anomalies', icon: AlertTriangle, badge: true },
  { to: '/resume', label: 'Résumé quotidien', icon: CalendarDays },
  { to: '/prevision', label: 'Prévision', icon: LineChart },
];

const BREADCRUMBS = {
  '/': 'Tableau de bord',
  '/capteurs': 'Capteurs',
  '/historique': 'Historique',
  '/anomalies': 'Anomalies',
  '/resume': 'Résumé quotidien',
  '/prevision': 'Prévisions',
};

export default function Layout() {
  const services = useServices();
  const [anomalyCount, setAnomalyCount] = useState(null);
  const [query, setQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api
      .sensors()
      .then(recentAnomalies)
      .then(list => setAnomalyCount(list.length))
      .catch(() => setAnomalyCount(null));
  }, []);

  const core = services && ['collector', 'storage', 'analytics', 'mongodb', 'cassandra'];
  const coreUp = core && core.every(k => services[k]);

  const submitSearch = e => {
    e.preventDefault();
    navigate(`/capteurs?q=${encodeURIComponent(query.trim())}`);
    setMobileMenuOpen(false);
  };

  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);
  const toggleMobileMenu = () => setMobileMenuOpen(prev => !prev);

  const currentBreadcrumb = BREADCRUMBS[location.pathname] || 'Page';

  return (
    <div className="app">
      <aside
        className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}
      >
        <div className="brand">
          <Zap size={22} fill="currentColor" />
          <span className={!sidebarCollapsed ? '' : 'hidden'}>
            SmartEnergy <b>Hub</b>
          </span>
        </div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => setMobileMenuOpen(false)}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon size={18} />
              <span className={!sidebarCollapsed ? '' : 'hidden'}>{label}</span>
              {badge && anomalyCount > 0 && <em className="nav-badge">{anomalyCount}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div>
            <i className={`dot ${services == null ? '' : coreUp ? 'ok' : 'ko'}`} />
            <span className={!sidebarCollapsed ? '' : 'hidden'}>
              {services == null
                ? 'Vérification…'
                : coreUp
                  ? 'Services en ligne'
                  : 'Service indisponible'}
            </span>
          </div>
          <small className={!sidebarCollapsed ? '' : 'hidden'}>
            Collector · Storage · Analytics · Cassandra · MongoDB
          </small>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="top-left">
            <button
              className="icon-btn sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
            <button
              className="icon-btn mobile-menu-toggle"
              onClick={toggleMobileMenu}
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <nav className="breadcrumb">
              <span className="breadcrumb-item">SmartEnergy Hub</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item current">{currentBreadcrumb}</span>
            </nav>
          </div>
          <form className="search" onSubmit={submitSearch}>
            <Search size={16} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un capteur (ID, nom, bâtiment)…"
            />
          </form>
          <div className="top-right">
            <button
              className="icon-btn"
              onClick={() => navigate('/anomalies')}
              title="Anomalies des dernières 24 h"
            >
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
  );
}
