import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import StatusBadge from '../components/tenant/StatusBadge.jsx';
import * as tenantApi from '../services/api/tenant.api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadStatuses() {
    setLoading(true);
    const [s, t] = await Promise.all([tenantApi.getSourceStatus(), tenantApi.getTargetStatus()]);
    setSource(s);
    setTarget(t);
    setLoading(false);
  }

  useEffect(() => {
    loadStatuses();
  }, []);

  const bothConnected = source?.connectionStatus === 'CONNECTED' && target?.connectionStatus === 'CONNECTED';

  return (
    <AppShell>
      <section className="section-gap">
        <h3>Step 1 — Connect your tenants</h3>
        <p>Connect both the Neo source tenant and the Cloud Foundry target tenant before packages can be browsed.</p>

        {loading ? (
          <div className="empty-state">Checking tenant connections…</div>
        ) : (
          <div className="tenant-grid">
            <TenantCard
              label="Source — SAP BTP Neo"
              status={source}
              onConnect={() => navigate('/connect/source')}
            />
            <div className={`connector${bothConnected ? ' live' : ''}`} aria-hidden="true" />
            <TenantCard
              label="Target — SAP BTP Cloud Foundry"
              status={target}
              onConnect={() => navigate('/connect/target')}
            />
          </div>
        )}
      </section>

      <section>
        <h3>Step 2 — Browse & migrate</h3>
        {bothConnected ? (
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>Packages</h2>
              <p style={{ marginBottom: 0 }}>Browse packages, inspect iFlows, and migrate to your target tenant.</p>
            </div>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/packages')}>
              Open Packages
            </button>
          </div>
        ) : (
          <div className="empty-state">Connect both tenants above to unlock the Packages section.</div>
        )}
      </section>
    </AppShell>
  );
}

function TenantCard({ label, status, onConnect }) {
  const connectionStatus = status?.connectionStatus || 'DISCONNECTED';
  return (
    <div className="card tenant-card">
      <h2>
        {label}
        <StatusBadge status={connectionStatus} />
      </h2>
      {status?.host ? (
        <>
          <div className="host">{status.host}</div>
          {status.lastTestedAt && (
            <div className="helper-text">Last tested {new Date(status.lastTestedAt).toLocaleString()}</div>
          )}
        </>
      ) : (
        <p style={{ marginBottom: 16 }}>Not configured yet.</p>
      )}
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-secondary" onClick={onConnect}>
          {status?.host ? 'Reconfigure' : 'Connect'}
        </button>
      </div>
    </div>
  );
}
