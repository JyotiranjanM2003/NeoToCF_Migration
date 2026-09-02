import React from 'react';
import StatusBadge from './StatusBadge.jsx';

/**
 * Generic — used for both source and target tenant lists. `tenant` is
 * normalized to { id, tenantName, host, connectionStatus, lastTestedAt,
 * selected } by the caller, so this component doesn't need to know whether
 * it's rendering a Neo or CF tenant.
 */
export default function TenantListCard({ tenant, onReconfigure, onSelect, selecting }) {
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
      </div>
    </div>
  );
}