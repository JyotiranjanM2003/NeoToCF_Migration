import React from 'react';

export default function ConfigTable({ configuration }) {
  if (!configuration || configuration.length === 0) {
    return <div className="empty-state">No configuration parameters for this artifact.</div>;
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface-sunken)' }}>
            <th style={thStyle}>Parameter</th>
            <th style={thStyle}>Value</th>
            <th style={thStyle}>Type</th>
          </tr>
        </thead>
        <tbody>
          {configuration.map((row) => (
            <tr key={row.parameter} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={tdStyle} className="mono">
                {row.parameter}
              </td>
              <td style={tdStyle} className="mono">
                {row.value}
              </td>
              <td style={{ ...tdStyle, color: 'var(--ink-muted)' }}>{row.dataType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '10px 20px',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--ink-muted)',
};

const tdStyle = { padding: '10px 20px' };
