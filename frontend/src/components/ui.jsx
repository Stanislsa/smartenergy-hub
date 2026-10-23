import { AlertCircle, Loader2 } from 'lucide-react'

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
  )
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
  )
}

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-head-right">{children}</div>}
    </div>
  )
}

export function Loading({ label = 'Chargement…' }) {
  return (
    <div className="state">
      <Loader2 size={18} className="spin" /> {label}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  const msg = error.status === 0 ? 'Service injoignable : vérifiez qu’il est démarré.' : error.message
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
  )
}

export function Empty({ children }) {
  return <div className="state muted">{children}</div>
}

export function Status({ ok, okLabel = 'En ligne', koLabel = 'Hors ligne', warn, warnLabel }) {
  const cls = warn ? 'warn' : ok ? 'ok' : 'ko'
  return (
    <span className={`status ${cls}`}>
      <i />
      {warn ? warnLabel : ok ? okLabel : koLabel}
    </span>
  )
}

export function Badge({ tone = 'blue', children }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function SensorSelect({ sensors, value, onChange, allowAll = false }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowAll && <option value="">Tous les capteurs</option>}
      {(sensors || []).map((s) => (
        <option key={s.sensorId} value={s.sensorId}>
          {s.name} ({s.sensorId})
        </option>
      ))}
    </select>
  )
}
