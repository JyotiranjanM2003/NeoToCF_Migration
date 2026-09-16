import React from 'react';
import { Link } from 'react-router-dom';

function statusChip(status) {
  const connected = status === 'CONNECTED';
  return (
    <span className={`badge ${connected ? 'badge-connected' : 'badge-disconnected'}`}>
      <span className="dot" />
      {connected ? 'Connected' : status || 'Not tested'}
    </span>
  );
}

function RailCard({ side, tenant }) {
  const isSource = side === 'source';
  return (
    <div className={`rail-card rail-${side}`}>
      <div className="rail-main">
        <div className="rail-kicker">{isSource ? 'Source · Neo' : 'Target · Cloud Foundry'}</div>
        {tenant ? (
          <>
            <div className="rail-name">{tenant.tenantName || tenant.host}</div>
            <div className="rail-host mono" title={tenant.host}>{tenant.host}</div>
          </>
        ) : (
          <div className="rail-empty">
            No tenant selected — <Link to="/tenants">connect one</Link>
          </div>
        )}
      </div>
      {tenant && statusChip(tenant.connectionStatus)}
    </div>
  );
}

/**
 * Persistent source → target strip shown under the page title.
 * Every screen in this tool acts on "the selected source into the selected
 * target", so that pair stays visible instead of living only on one page.
 */
export default function TenantRail({ source, target }) {
  return (
    <div className="tenant-rail">
      <RailCard side="source" tenant={source} />
      <div className="rail-arrow" aria-hidden="true">→</div>
      <RailCard side="target" tenant={target} />
    </div>
  );
}
