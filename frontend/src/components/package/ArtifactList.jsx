import React from 'react';
import { useNavigate } from 'react-router-dom';
import ArtifactTypeBadge from './ArtifactTypeBadge.jsx';

export default function ArtifactList({ artifacts, packageId }) {
  const navigate = useNavigate();

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
            padding: '14px 20px',
            borderBottom: i === artifacts.length - 1 ? 'none' : '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>{a.name}</div>
            <div className="helper-text mono">v{a.version}</div>
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
