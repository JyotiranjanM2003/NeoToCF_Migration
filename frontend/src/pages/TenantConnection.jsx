import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import TenantListCard from '../components/tenant/TenantListCard.jsx';
import useConsoleSummary from '../hooks/useConsoleSummary.js';
import * as tenantApi from '../services/api/tenant.api';
import { invalidateAll } from '../utils/resourceCache.js';

/**
 * Tenant Connection — the single place to manage the Neo (source) and
 * Cloud Foundry (target) tenants this console migrates between.
 *
 * This is the tenant management that used to live on the Dashboard as a
 * three-step wizard. Same APIs, same TenantListCard, same cache
 * invalidation on select/delete — just its own section now that the
 * Dashboard is an overview rather than a setup screen.
 */
export default function TenantConnection() {
  const navigate = useNavigate();
  const { tenants, reload } = useConsoleSummary();

  const [busyId, setBusyId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const sourceTenants = tenants.sourceAll;
  const targetTenants = tenants.targetAll;

  async function run(action, id, setter) {
    setter(id);
    setError('');
    try {
      await action(id);
      invalidateAll(); // tenant pair changed → every cached list is from the wrong tenant
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setter(null);
    }
  }

  function renderSection({ side, title, blurb, list, addRoute, editRoute, selectFn, deleteFn, idKey }) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">{title}</h3>
          <div className="panel-tools">
            <button className="btn btn-primary btn-sm" onClick={() => navigate(addRoute)}>
              + Add {side} tenant
            </button>
          </div>
        </div>

        <div className="panel-body">
          <p className="helper-text" style={{ marginTop: 0, marginBottom: 14 }}>{blurb}</p>

          {!tenants.loaded && <div className="skeleton-bar" style={{ height: 68 }} />}

          {tenants.loaded && list?.length === 0 && (
            <EmptyState
              title={`No ${side} tenants yet`}
              message={`Add the ${side === 'source' ? 'Neo tenant you are migrating from' : 'Cloud Foundry tenant you are migrating into'}, then select it as active.`}
              action={
                <button className="btn btn-primary" onClick={() => navigate(addRoute)}>
                  Add {side} tenant
                </button>
              }
            />
          )}

          {list?.map((t) => (
            <TenantListCard
              key={t[idKey]}
              tenant={{
                id: t[idKey],
                tenantName: t.tenantName,
                host: t.host,
                connectionStatus: t.connectionStatus,
                lastTestedAt: t.lastTestedAt,
                selected: t.selected,
              }}
              selecting={busyId === t[idKey]}
              deleting={deletingId === t[idKey]}
              onReconfigure={() => navigate(`${editRoute}/${t[idKey]}`)}
              onSelect={() => run(selectFn, t[idKey], setBusyId)}
              onDelete={() => run(deleteFn, t[idKey], setDeletingId)}
            />
          ))}
        </div>
      </div>
    );
  }

  const bothReady = Boolean(tenants.source && tenants.target);

  return (
    <AppShell tenants={tenants}>
      <PageHeader
        title="Tenant Connection"
        subtitle="Manage the Neo and Cloud Foundry tenants this console migrates between."
      >
        <button className="btn" onClick={reload}>↻ Refresh</button>
      </PageHeader>

      {error && <div className="error-banner">{error}</div>}

      {tenants.loaded && !bothReady && (
        <div className="warn-banner">
          {!tenants.source && !tenants.target
            ? 'Select an active source and target tenant to unlock migration.'
            : !tenants.source
              ? 'Select an active source tenant to start browsing content.'
              : 'Select an active target tenant before migrating anything.'}
        </div>
      )}

      <div className="dash-grid">
        {renderSection({
          side: 'source',
          title: 'Source · SAP BTP Neo',
          blurb: "The Neo tenant you're migrating from. Add one or more, then pick which is active.",
          list: sourceTenants,
          addRoute: '/connect/source',
          editRoute: '/connect/source',
          selectFn: tenantApi.selectSourceTenant,
          deleteFn: tenantApi.deleteSourceTenant,
          idKey: 'sourceTenantId',
        })}

        {renderSection({
          side: 'target',
          title: 'Target · SAP BTP Cloud Foundry',
          blurb: "The Cloud Foundry tenant you're migrating into. Add one or more, then pick which is active.",
          list: targetTenants,
          addRoute: '/connect/target',
          editRoute: '/connect/target',
          selectFn: tenantApi.selectTargetTenant,
          deleteFn: tenantApi.deleteTargetTenant,
          idKey: 'targetTenantId',
        })}
      </div>

      {bothReady && (
        <div className="panel">
          <div className="panel-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong>Both tenants are connected.</strong>
              <div className="helper-text">Browse content and migrate it into your selected target tenant.</div>
            </div>
            <button className="btn" onClick={() => navigate('/dashboard')}>Open Dashboard</button>
            <button className="btn btn-primary" onClick={() => navigate('/packages')}>Browse Packages</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
