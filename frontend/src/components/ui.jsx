import { AlertCircle, Loader2 } from 'lucide-react';

export function Card({ title, icon: Icon, actions, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <h3>
            {Icon && <Icon size={16} />}
            {title}
          </h3>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  );
}

export function Kpi({ icon: Icon, color = 'blue', label, value, unit, sub, children }) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <span className={`kpi-icon ${color}`}>
          <Icon size={20} />
        </span>
        <div>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value">
            {value}
            {unit && <small> {unit}</small>}
          </div>
          {sub && <div className="kpi-sub">{sub}</div>}
        </div>
      </div>
      {children && <div className="kpi-spark">{children}</div>}
    </div>
  );
}

export function PageHead({ title, subtitle, children, actions, isFetching = false }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="page-head-right">
        {isFetching && (
          <span className="fetching-indicator" title="Actualisation en cours">
            <Loader2 size={16} className="spin" />
          </span>
        )}
        {actions && <div className="card-actions">{actions}</div>}
        {children}
      </div>
    </div>
  );
}

export function Loading({ label = 'Chargement…' }) {
  return (
    <div className="state loading-wrapper">
      <div className="spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className = '', height = '20px', width = '100%' }) {
  return (
    <div className={`skeleton ${className}`} style={{ height, width }}>
      <div className="skeleton-shimmer"></div>
    </div>
  );
}

export function CardSkeleton({ title = false, lines = 3 }) {
  return (
    <section className="card skeleton-card">
      {title && (
        <header className="card-head">
          <Skeleton width="150px" height="20px" />
        </header>
      )}
      <div className="card-body">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} height="16px" style={{ marginBottom: i < lines - 1 ? '12px' : '0' }} />
        ))}
      </div>
    </section>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  const msg =
    error.status === 0 ? 'Service injoignable : vérifiez qu’il est démarré.' : error.message;
  return (
    <div className="state error">
      <AlertCircle size={18} />
      <span>
        {error.status ? <b>Erreur {error.status} : </b> : null}
        {msg}
      </span>
      {onRetry && (
        <button className="btn ghost sm" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="state muted">{children}</div>;
}

export function Status({ ok, okLabel = 'En ligne', koLabel = 'Hors ligne', warn, warnLabel }) {
  const cls = warn ? 'warn' : ok ? 'ok' : 'ko';
  return (
    <span className={`status ${cls}`}>
      <i />
      {warn ? warnLabel : ok ? okLabel : koLabel}
    </span>
  );
}

export function Badge({ tone = 'blue', children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function SensorSelect({ sensors, value, onChange, allowAll = false }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {allowAll && <option value="">Tous les capteurs</option>}
      {(sensors || []).map(s => (
        <option key={s.sensorId} value={s.sensorId}>
          {s.name} ({s.sensorId})
        </option>
      ))}
    </select>
  );
}
