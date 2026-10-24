import { AlertCircle, Inbox, Search } from 'lucide-react';

export default function EmptyState({ icon = 'inbox', title, description, action, onAction }) {
  const icons = {
    inbox: Inbox,
    search: Search,
    alert: AlertCircle,
  };

  const Icon = icons[icon] || Inbox;

  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={48} />
      </div>
      <h3>{title || 'Aucune donnée'}</h3>
      {description && <p>{description}</p>}
      {action && (
        <button className="btn" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
