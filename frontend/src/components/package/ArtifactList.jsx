import React from 'react';
import { useNavigate } from 'react-router-dom';
import ArtifactTypeBadge from './ArtifactTypeBadge.jsx';

export default function ArtifactList({ artifacts, packageId, selectedIds, onToggleSelect }) {
  const navigate = useNavigate();
  const selectable = !!onToggleSelect;

  if (artifacts.length === 0) {
    return <div className="empty-state">No artifacts found in this package.</div>;
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {artifacts.map((a, i) => (
        <div
          key={a.id}
          onClick={() => navigate(`/packages/${encodeURIComponent(packageId)}/iflows/${encodeURIComponent(a.id)}`)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '14px 20px',
            borderBottom: i === artifacts.length - 1 ? 'none' : '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {selectable && (
              <input
                type="checkbox"
                checked={selectedIds?.has(a.id) || false}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onToggleSelect(a.id, e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            )}
            <div>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div className="helper-text mono">v{a.version}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ArtifactTypeBadge type={a.type} />
            <span className={`badge ${a.status === 'Active' ? 'badge-connected' : 'badge-disconnected'}`}>
              <span className="dot" />
              {a.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}