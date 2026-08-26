import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import PackageCard from '../components/package/PackageCard.jsx';
import * as packageApi from '../services/api/package.api';
import * as migrationApi from '../services/api/migration.api';

export default function Packages() {
  const [packages, setPackages] = useState(null);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [migrating, setMigrating] = useState(false);
  const [batchResult, setBatchResult] = useState(null); // [{ packageId, migrationId }]

  useEffect(() => {
    packageApi
      .listPackages()
      .then((data) => setPackages(data.packages))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load packages'));
  }, []);

  function toggleSelect(packageId, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(packageId);
      else next.delete(packageId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set((packages || []).map((p) => p.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleMigrateSelected() {
    setMigrating(true);
    setError('');
    setBatchResult(null);
    try {
      const { migrations } = await migrationApi.startBatchMigration({ packageIds: Array.from(selectedIds) });
      setBatchResult(migrations);
      clearSelection();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start migration for the selected packages');
    } finally {
      setMigrating(false);
    }
  }

  return (
    <AppShell>
      <h2 style={{ marginBottom: 16 }}>Packages</h2>

      {error && (
        <div className="error-banner">
          {error}{' '}
          <Link to="/dashboard" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Go connect your tenants
          </Link>
        </div>
      )}

      {!error && !packages && <div className="empty-state">Loading packages from source tenant…</div>}

      {packages?.length === 0 && <div className="empty-state">No packages found on the source tenant.</div>}

      {packages?.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div className="helper-text">
            {selectedIds.size === 0
              ? 'Select one or more packages to migrate together.'
              : `${selectedIds.size} package${selectedIds.size === 1 ? '' : 's'} selected`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={selectAll} disabled={migrating}>
              Select all
            </button>
            <button className="btn btn-secondary" onClick={clearSelection} disabled={migrating || selectedIds.size === 0}>
              Clear
            </button>
            <button
              className="btn btn-primary"
              style={{ width: 'auto' }}
              onClick={handleMigrateSelected}
              disabled={migrating || selectedIds.size === 0}
            >
              {migrating ? 'Starting…' : `Migrate selected (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {batchResult && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Migrations started</h3>
          {batchResult.map((m) => (
            <div key={m.migrationId} style={{ marginBottom: 4 }}>
              <Link to={`/migrations/${m.migrationId}`}>{m.packageId}</Link>
            </div>
          ))}
        </div>
      )}

      {packages?.map((pkg) => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          selected={selectedIds.has(pkg.id)}
          onToggleSelect={toggleSelect}
        />
      ))}
    </AppShell>
  );
}