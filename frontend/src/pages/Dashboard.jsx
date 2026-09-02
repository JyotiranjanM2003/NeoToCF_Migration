import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import TenantListCard from '../components/tenant/TenantListCard.jsx';
import * as tenantApi from '../services/api/tenant.api';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sourceTenants, setSourceTenants] = useState(null);
  const [targetTenants, setTargetTenants] = useState(null);
  const [selectingId, setSelectingId] = useState(null);
  const [error, setError] = useState('');

  const notice = location.state?.notice;

  

  async function loadTenants() {
    const [sourceData, targetData] = await Promise.all([
      tenantApi.listSourceTenants(),
      tenantApi.listTargetTenants(),
    ]);
    setSourceTenants(sourceData.tenants);
    setTargetTenants(targetData.tenants);
  }

  useEffect(() => {
    loadTenants();
  }, []);

  async function handleSelectSource(id) {
    setSelectingId(id);
    setError('');
    try {
      await tenantApi.selectSourceTenant(id);
      await loadTenants();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to select tenant');
    } finally {
      setSelectingId(null);
    }
  }

  async function handleSelectTarget(id) {
    setSelectingId(id);
    setError('');
    try {
      await tenantApi.selectTargetTenant(id);
      await loadTenants();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to select tenant');
    } finally {
      setSelectingId(null);
    }
  }

  const [deletingId, setDeletingId] = useState(null);

async function handleDeleteSource(id) {
  setDeletingId(id);
  setError('');
  try {
    await tenantApi.deleteSourceTenant(id);
    await loadTenants();
  } catch (err) {
    setError(err.response?.data?.message || 'Failed to delete tenant');
  } finally {
    setDeletingId(null);
  }
}

async function handleDeleteTarget(id) {
  setDeletingId(id);
  setError('');
  try {
    await tenantApi.deleteTargetTenant(id);
    await loadTenants();
  } catch (err) {
    setError(err.response?.data?.message || 'Failed to delete tenant');
  } finally {
    setDeletingId(null);
  }
}

  const anySourceSelected = sourceTenants?.some((t) => t.selected);
  const anyTargetSelected = targetTenants?.some((t) => t.selected);

  // Step state: 1 = pick source, 2 = pick target, 3 = ready to migrate
  const currentStep = !anySourceSelected ? 1 : !anyTargetSelected ? 2 : 3;

  function stepClass(step) {
    if (step < currentStep) return 'step done';
    if (step === currentStep) return 'step current';
    return 'step';
  }


  

  return (
    <AppShell>
      {notice && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warn)' }}>
          <strong style={{ color: 'var(--warn)' }}>{notice}</strong>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {/* ---- Step indicator: tells a new user exactly where they are ---- */}
      <div className="stepper">
        <div className={stepClass(1)}>
          <div className="step-num">{currentStep > 1 ? '✓' : '1'}</div>
          <div className="step-label">Connect a source tenant</div>
        </div>
        <div className={stepClass(2)}>
          <div className="step-num">{currentStep > 2 ? '✓' : '2'}</div>
          <div className="step-label">Connect a target tenant</div>
        </div>
        <div className={stepClass(3)}>
          <div className="step-num">3</div>
          <div className="step-label">Browse & migrate</div>
        </div>
      </div>

      {/* ---- Step 1: Source ---- */}
      <section className="section-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Step 1 · Source tenant (SAP BTP Neo)</h3>
          <button className="btn btn-secondary" onClick={() => navigate('/connect/source')}>
            + Add source tenant
          </button>
        </div>
        <p>This is the Neo tenant you're migrating <strong>from</strong>. Add one or more, then pick which is active.</p>

        {!sourceTenants && <div className="empty-state">Loading…</div>}
        {sourceTenants?.length === 0 && (
          <div className="empty-state">
            No source tenants yet — click <strong>+ Add source tenant</strong> above to connect one.
          </div>
        )}
        {sourceTenants?.map((t) => (
  <TenantListCard
    key={t.sourceTenantId}
    tenant={{
      id: t.sourceTenantId,
      tenantName: t.tenantName,
      host: t.host,
      connectionStatus: t.connectionStatus,
      lastTestedAt: t.lastTestedAt,
      selected: t.selected,
    }}
    selecting={selectingId === t.sourceTenantId}
    deleting={deletingId === t.sourceTenantId}
    onReconfigure={() => navigate(`/connect/source/${t.sourceTenantId}`)}
    onSelect={() => handleSelectSource(t.sourceTenantId)}
    onDelete={() => handleDeleteSource(t.sourceTenantId)}
  />
))}
      </section>

      {/* ---- Step 2: Target ---- */}
      <section className="section-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Step 2 · Target tenant (SAP BTP Cloud Foundry)</h3>
          <button className="btn btn-secondary" onClick={() => navigate('/connect/target')}>
            + Add target tenant
          </button>
        </div>
        <p>This is the Cloud Foundry tenant you're migrating <strong>into</strong>. Add one or more, then pick which is active.</p>

        {!targetTenants && <div className="empty-state">Loading…</div>}
        {targetTenants?.length === 0 && (
          <div className="empty-state">
            No target tenants yet — click <strong>+ Add target tenant</strong> above to connect one.
          </div>
        )}
        {targetTenants?.map((t) => (
  <TenantListCard
    key={t.targetTenantId}
    tenant={{
      id: t.targetTenantId,
      tenantName: t.tenantName,
      host: t.host,
      connectionStatus: t.connectionStatus,
      lastTestedAt: t.lastTestedAt,
      selected: t.selected,
    }}
    selecting={selectingId === t.targetTenantId}
    deleting={deletingId === t.targetTenantId}
    onReconfigure={() => navigate(`/connect/target/${t.targetTenantId}`)}
    onSelect={() => handleSelectTarget(t.targetTenantId)}
    onDelete={() => handleDeleteTarget(t.targetTenantId)}
  />
))}
      </section>

      {/* ---- Step 3: Migrate ---- */}
      <section>
        <h3 style={{ marginBottom: 4 }}>Step 3 · Browse & migrate</h3>
        {anySourceSelected ? (
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>Packages</h2>
              <p style={{ marginBottom: 0 }}>
                {anyTargetSelected
                  ? 'Browse packages, inspect iFlows, and migrate to your selected target tenant.'
                  : 'You can browse packages now, but pick a target tenant in Step 2 before you can migrate anything.'}
              </p>
            </div>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/packages')}>
              Open Packages
            </button>
          </div>
        ) : (
          <div className="empty-state">Complete Step 1 above to unlock the Packages section.</div>
        )}
      </section>
    </AppShell>
  );
}