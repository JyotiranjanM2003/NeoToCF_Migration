import React, { useState } from 'react';
import StatusBadge from './StatusBadge.jsx';

export default function TenantListCard({ tenant, onReconfigure, onSelect, onDelete, selecting, deleting }) {
  const [confirming, setConfirming] = useState(false);

  

  return (
    <div
      className="card"
      style={{
        marginBottom: 10,
        border: tenant.selected ? '1px solid var(--accent)' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            {tenant.tenantName || tenant.host}
            {tenant.selected && (
              <span className="badge badge-connected">
                <span className="dot" />
                Selected
              </span>
            )}
          </div>
          <div className="helper-text mono">{tenant.host}</div>
          {tenant.lastTestedAt && (
            <div className="helper-text">Last tested {new Date(tenant.lastTestedAt).toLocaleString()}</div>
          )}
        </div>
        <StatusBadge status={tenant.connectionStatus} />
      </div>

      {!confirming ? (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onReconfigure}>
            Reconfigure
          </button>
          <button
            className="btn btn-primary"
            style={{ width: 'auto' }}
            onClick={onSelect}
            disabled={tenant.selected || selecting}
          >
            {tenant.selected ? 'Selected' : selecting ? 'Selecting…' : 'Select tenant'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ marginLeft: 'auto', color: 'var(--danger)', borderColor: 'var(--danger-soft)' }}
            onClick={() => setConfirming(true)}
            disabled={deleting}
          >
            Delete
          </button>
        </div>
      ) : (
        <div className="error-banner" style={{ marginTop: 12, marginBottom: 0 }}>
          <div style={{ marginBottom: 8 }}>
            Delete <strong>{tenant.tenantName || tenant.host}</strong>? This also removes every migration
            that used this tenant. This can't be undone.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              style={{ width: 'auto' }}
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ width: 'auto', background: 'var(--danger)' }}
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}