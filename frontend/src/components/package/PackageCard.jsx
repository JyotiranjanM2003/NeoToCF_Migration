import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PackageCard({ pkg, selected = false, onToggleSelect }) {
  const navigate = useNavigate();

  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        border: selected ? '1px solid var(--accent)' : undefined,
        background: selected ? 'var(--accent-soft)' : undefined,
      }}
      onClick={() => navigate(`/packages/${encodeURIComponent(pkg.id)}`)}
    >
      <input
        type="checkbox"
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onToggleSelect?.(pkg.id, e.target.checked)}
        style={{ marginTop: 4, width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      <div style={{ flex: 1 }}>
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {pkg.name}
          <span className="helper-text mono">{pkg.version}</span>
        </h2>
        {pkg.description && <p style={{ marginBottom: 0 }}>{pkg.description}</p>}
      </div>
    </div>
  );
}