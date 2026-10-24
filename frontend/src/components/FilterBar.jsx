import { X } from 'lucide-react';

export default function FilterBar({ filters = [], onClear, children }) {
  if (filters.length === 0 && !children) return null;

  return (
    <div className="filter-bar">
      {children}
      {filters.length > 0 && (
        <div className="chips">
          {filters.map((filter, index) => (
            <span key={index} className="chip">
              {filter.label}
              <button
                type="button"
                className="chip-close"
                onClick={() => filter.onRemove()}
                aria-label={`Supprimer ${filter.label}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {onClear && (
            <button type="button" className="link" onClick={onClear}>
              Effacer tout
            </button>
          )}
        </div>
      )}
    </div>
  );
}
