import React from 'react';

const STATUS_COLOR = {
  STARTED: 'var(--ink-muted)',
  SUCCESS: 'var(--accent)',
  WARNING: 'var(--warn)',
  ERROR: 'var(--danger)',
};

export default function MigrationLogViewer({ logs }) {
  if (!logs || logs.length === 0) {
    return <div className="empty-state">No log entries yet.</div>;
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {logs.map((l) => (
        <div
          key={l.ID}
          style={{
            display: 'flex',
            gap: 12,
            padding: '10px 20px',
            borderBottom: '1px solid var(--border)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span style={{ color: 'var(--ink-muted)', minWidth: 150 }}>
            {new Date(l.TIMESTAMP).toLocaleTimeString()}
          </span>
          <span style={{ minWidth: 130, fontWeight: 600 }}>{l.STEP}</span>
          <span style={{ color: STATUS_COLOR[l.STATUS] || 'var(--ink)', minWidth: 70 }}>{l.STATUS}</span>
          <span style={{ color: 'var(--ink-muted)' }}>{l.MESSAGE}</span>
        </div>
      ))}
    </div>
  );
}
