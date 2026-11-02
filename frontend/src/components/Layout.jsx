import { Fragment, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import LogoutButton from './LogoutButton';
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
  Building2,
  Sparkles,
  UserRound,
  Settings as SettingsIcon,
} from 'lucide-react';
import { api } from '../api/client';
import { recentAnomalies, useServices } from '../services';

const NAV = [
  { to: '/', label: 'Vue d’ensemble', icon: LayoutDashboard, end: true, section: 'ESPACE' },
  { to: '/capteurs', label: 'Capteurs', icon: Cpu, section: 'PILOTAGE' },
  { to: '/historique', label: 'Historique', icon: History, section: 'PILOTAGE' },
  { to: '/anomalies', label: 'Anomalies', icon: AlertTriangle, badge: true, section: 'PILOTAGE' },
  { to: '/resume', label: 'Résumé quotidien', icon: CalendarDays, section: 'ANALYSE' },
  { to: '/prevision', label: 'Prévisions IA', icon: LineChart, section: 'ANALYSE' },
  { to: '/parametres', label: 'Paramètres', icon: SettingsIcon, section: 'COMPTE' },
];

const BREADCRUMBS = {
  '/': 'Tableau de bord',
  '/capteurs': 'Capteurs',
  '/historique': 'Historique',
  '/anomalies': 'Anomalies',
  '/resume': 'Résumé quotidien',
  '/prevision': 'Prévisions',
  '/parametres': 'Paramètres',
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

  const core = services && ['collector', 'storage', 'analytics', 'ai', 'mongodb', 'cassandra'];
  const coreUp = core && core.every(k => services[k]);

  const submitSearch = e => {
    e.preventDefault();
    navigate(`/capteurs?q=${encodeURIComponent(query.trim())}`);
    setMobileMenuOpen(false);
  };

  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);
  const toggleMobileMenu = () => setMobileMenuOpen(prev => !prev);

  const currentBreadcrumb = location.pathname.startsWith('/capteurs/')
    ? 'Détail du capteur'
    : BREADCRUMBS[location.pathname] || 'Page';
  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className="app">
      <aside
        className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}
      >
        <div className="brand">
          <span className="brand-mark">
            <Zap size={19} fill="currentColor" />
          </span>
          <span className={!sidebarCollapsed ? 'brand-name' : 'hidden'}>
            smartenergy<span>hub</span>
          </span>
        </div>
        {!sidebarCollapsed && (
          <div className="workspace-switcher">
            <span className="workspace-icon">
              <Building2 size={16} />
            </span>
            <span className="workspace-copy">
              <small>ESPACE DE TRAVAIL</small>
              <b>Mon organisation</b>
            </span>
          </div>
        )}
        <nav>
          {NAV.map(({ to, label, icon: Icon, end, badge, section }, index) => (
            <Fragment key={to}>
              {!sidebarCollapsed && (index === 0 || NAV[index - 1].section !== section) && (
                <span className="nav-section">{section}</span>
              )}
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={() => setMobileMenuOpen(false)}
                title={sidebarCollapsed ? label : undefined}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span className={!sidebarCollapsed ? '' : 'hidden'}>{label}</span>
                {badge && anomalyCount > 0 && <em className="nav-badge">{anomalyCount}</em>}
              </NavLink>
            </Fragment>
          ))}
        </nav>
        <div className="side-foot">
          <div className="system-status">
            <i className={`dot ${services == null ? '' : coreUp ? 'ok' : 'ko'}`} />
            <span className={!sidebarCollapsed ? '' : 'hidden'}>
              {services == null ? 'Connexion aux services…' : coreUp ? 'Tous les systèmes actifs' : 'Incident détecté'}
            </span>
          </div>
          {!sidebarCollapsed && <div className="sidebar-version"><Sparkles size={14} /> Supervision énergétique</div>}
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
              <span className="breadcrumb-item">Espace de travail</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item current">{currentBreadcrumb}</span>
            </nav>
          </div>
          <form className="search" onSubmit={submitSearch}>
            <Search size={16} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un capteur…"
            />
            <kbd>↵</kbd>
          </form>
          <div className="top-right">
            <span className="top-date">{formattedDate}</span>
            <span
              className={`connection-pill ${coreUp ? 'is-online' : services == null ? 'is-checking' : 'is-offline'}`}
            >
              <i /> {coreUp ? 'Opérationnel' : services == null ? 'Connexion…' : 'À vérifier'}
            </span>
            <button
              className="icon-btn"
              onClick={() => navigate('/anomalies')}
              title="Anomalies des dernières 24 h"
            >
              <Bell size={18} /> 
              {anomalyCount > 0 && <em>{anomalyCount}</em>}
            </button>
            <span className="account-avatar" aria-hidden="true">
              <UserRound size={15} />
            </span>
            <LogoutButton />
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
