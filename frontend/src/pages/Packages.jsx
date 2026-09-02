import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import PackageTable from '../components/package/PackageTable.jsx';
import * as packageApi from '../services/api/package.api';
import * as migrationApi from '../services/api/migration.api';

export default function Packages() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState(null);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [starting, setStarting] = useState(false);
  const [activeBatch, setActiveBatch] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    packageApi
      .listPackages()
      .then((data) => setPackages(data.packages))
      .catch((err) => {
        const code = err.response?.data?.code;
        if (code === 'NO_SOURCE_SELECTED' || code === 'SOURCE_NOT_CONNECTED') {
          navigate('/dashboard', {
            replace: true,
            state: { notice: err.response.data.message || 'Select a source tenant to browse packages.' },
          });
          return;
        }
        setError(err.response?.data?.message || 'Failed to load packages');
      });

    migrationApi
      .getActiveBatch()
      .then((data) => setActiveBatch(data.batch))
      .catch(() => {});
  }, []);

  function toggleSelect(packageId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(packageId)) next.delete(packageId);
      else next.add(packageId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set((packages || []).map((p) => p.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  // Wires the table's header checkbox to the exact same selectedIds state —
  // no new selection logic, just applied to whatever's currently visible
  // under the search filter.
  function toggleSelectAll() {
    const allVisibleSelected = visiblePackages.length > 0 && visiblePackages.every((p) => selectedIds.has(p.id));
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visiblePackages.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visiblePackages.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }

  async function handleMigrateSelected() {
    setStarting(true);
    setError('');
    try {
      const { batchId } = await migrationApi.startBatchMigration(Array.from(selectedIds));
      navigate(`/migrations/batch/${batchId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start migration');
      setStarting(false);
    }
  }

  const selectedCount = selectedIds.size;

  // Client-side filter only — doesn't touch the packages state or selection
  // logic, so selections made before typing a search term are preserved.
  const visiblePackages = (packages || []).filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <AppShell>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h2 style={{ margin: 0 }}>Integration Packages{packages ? ` (${packages.length})` : ''}</h2>
        {packages && packages.length > 0 && (
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '7px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: 13,
              width: 220,
            }}
          />
        )}
      </div>

      {activeBatch && (
        <div
          className="card"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            borderColor: 'var(--accent)',
          }}
        >
          <div>
            <strong>A migration is still running.</strong>
            <div className="helper-text">Started {new Date(activeBatch.STARTEDAT).toLocaleString()}</div>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: 'auto' }}
            onClick={() => navigate(`/migrations/batch/${activeBatch.BATCHID}`)}
          >
            Continue watching migration
          </button>
        </div>
      )}

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

      {packages && packages.length > 0 && visiblePackages.length === 0 && (
        <div className="empty-state">No packages match "{search}".</div>
      )}

      {visiblePackages.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <button className="btn btn-secondary" onClick={selectAll}>
            Select all
          </button>
          <button className="btn btn-secondary" onClick={deselectAll} disabled={selectedCount === 0}>
            Deselect all
          </button>
          {selectedCount > 0 && (
            <span className="badge badge-connected">
              <span className="dot" />
              {selectedCount} selected
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-primary"
            style={{ width: 'auto' }}
            onClick={handleMigrateSelected}
            disabled={selectedCount === 0 || starting}
          >
            {starting ? 'Starting…' : `Migrate selected packages (${selectedCount})`}
          </button>
        </div>
      )}

      {visiblePackages.length > 0 && (
        <PackageTable
          packages={visiblePackages}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      )}
    </AppShell>
  );
}