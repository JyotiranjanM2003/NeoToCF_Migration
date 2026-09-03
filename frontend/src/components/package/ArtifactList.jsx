import React from 'react';
import { useNavigate } from 'react-router-dom';
import ArtifactTypeBadge from './ArtifactTypeBadge.jsx';
import EntityIcon from './EntityIcon.jsx';

export default function ArtifactList({ artifacts, packageId }) {
  const navigate = useNavigate();

  if (artifacts.length === 0) {
    return <div className="empty-state">No artifacts found in this package.</div>;
  }

  return (
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface-sunken)' }}>
            <th style={{ ...thStyle, width: 48 }} />
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Version</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {artifacts.map((a) => (
            <tr
              key={a.id}
              onClick={() => navigate(`/packages/${encodeURIComponent(packageId)}/iflows/${encodeURIComponent(a.id)}`)}
              style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <td style={tdStyle}>
                <EntityIcon type={a.type} />
              </td>
              <td style={tdStyle}>
                <div style={{ fontWeight: 600 }}>{a.name}</div>
              </td>
              <td style={tdStyle}>
                <ArtifactTypeBadge type={a.type} />
              </td>
              <td style={tdStyle} className="mono">
                {a.version}
              </td>
              <td style={tdStyle}>
                <span className={`badge ${a.status === 'Active' ? 'badge-connected' : 'badge-disconnected'}`}>
                  <span className="dot" />
                  {a.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--ink-muted)',
};

const tdStyle = { padding: '12px 16px', verticalAlign: 'top' };