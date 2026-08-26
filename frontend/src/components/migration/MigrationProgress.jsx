import React from 'react';

const STATUS_BADGE = {
  PENDING: 'badge-disconnected',
  RUNNING: 'badge-disconnected',
  VALIDATED: 'badge-disconnected',
  MIGRATED: 'badge-connected',
  SUCCESS: 'badge-connected',
  PARTIAL: 'badge-error',
  FAILED: 'badge-error',
  SKIPPED: 'badge-disconnected',
};

export default function MigrationProgress({ migration, artifacts }) {
  if (!migration) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 4 }}>
        Migration Status:{' '}
        <span className={`badge ${STATUS_BADGE[migration.STATUS] || 'badge-disconnected'}`}>
          <span className="dot" />
          {migration.STATUS}
        </span>
      </h3>
      <p className="helper-text" style={{ marginBottom: 16 }}>
        Started {new Date(migration.STARTEDAT).toLocaleString()}
        {migration.COMPLETEDAT && ` · Completed ${new Date(migration.COMPLETEDAT).toLocaleString()}`}
      </p>

            {artifacts?.map((a) => (
        <div
          key={a.ID}
          style={{
            padding: '8px 0',
            borderTop: '1px solid var(--border)',
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{a.ARTIFACTNAME}</span>
            <span className={`badge ${STATUS_BADGE[a.STATUS] || 'badge-disconnected'}`}>
              <span className="dot" />
              {a.STATUS}
            </span>
          </div>
          {a.STATUS === 'FAILED' && a.ERRORMESSAGE && (
            <div className="mono" style={{ marginTop: 4, color: 'var(--danger)', fontSize: 12 }}>
              {a.ERRORMESSAGE}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
