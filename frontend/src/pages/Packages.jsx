import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import PackageTable from '../components/package/PackageTable.jsx';
import TableSkeleton from '../components/common/TableSkeleton.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import SearchField from '../components/common/SearchField.jsx';
import StatusFilter, { matchesStatusFilter } from '../components/common/StatusFilter.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import SelectionBar from '../components/common/SelectionBar.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { getCache, setCache, invalidateCache } from '../utils/resourceCache.js';
import * as packageApi from '../services/api/package.api';
import * as migrationApi from '../services/api/migration.api';

const PKG_CACHE_KEY = 'packages';
const PKG_CACHE_TTL = 15 * 60 * 1000;

export default function Packages() {
  const navigate = useNavigate();

  const [packages, setPackages] = useState(() => getCache(PKG_CACHE_KEY) ?? null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [starting, setStarting] = useState(false);
  const [activeBatch, setActiveBatch] = useState(null);
  const [activeMigration, setActiveMigration] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 180);
  const [statusFilter, setStatusFilter] = useState('all');

  // ── Load (cache-first) ────────────────────────────────────────────────────
  function loadPackages(force = false) {
    if (!force) {
      const cached = getCache(PKG_CACHE_KEY);
      if (cached) { setPackages(cached); return; }
    }
    setRefreshing(true);
    setError('');
    packageApi
      .listPackages()
      .then((data) => {
        setPackages(data.packages);
        setCache(PKG_CACHE_KEY, data.packages, PKG_CACHE_TTL);
      })
      .catch((err) => {
        const code = err.response?.data?.code;
        if (code === 'NO_SOURCE_SELECTED' || code === 'SOURCE_NOT_CONNECTED') {
          setError(err.response?.data?.message || 'Select a source tenant to browse packages.');
          return;
        }
        setError(err.response?.data?.message || 'Failed to load packages');
      })
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    if (!getCache(PKG_CACHE_KEY)) loadPackages(false);

    migrationApi.getActiveBatch().then((data) => setActiveBatch(data.batch)).catch(() => {});
    migrationApi.getActiveMigration().then((data) => setActiveMigration(data.migration)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────
  function toggleSelect(packageId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(packageId)) next.delete(packageId);
      else next.add(packageId);
      return next;
    });
  }

  function toggleSelectAll() {
    const allVisibleSelected =
      visiblePackages.length > 0 && visiblePackages.every((p) => selectedIds.has(p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visiblePackages.forEach((p) => next.delete(p.id));
      else visiblePackages.forEach((p) => next.add(p.id));
      return next;
    });
  }

  // Client-side filter only — selections survive typing a search term.
  const visiblePackages = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return (packages || []).filter(
      (p) =>
        (p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)) &&
        matchesStatusFilter(p, statusFilter)
    );
  }, [packages, debouncedSearch, statusFilter]);

  async function handleMigrateSelected() {
    setStarting(true);
    setError('');
    try {
      const { batchId } = await migrationApi.startBatchMigration(Array.from(selectedIds));
      invalidateCache(PKG_CACHE_KEY);
      navigate(`/migrations/batch/${batchId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start migration');
      setStarting(false);
    }
  }

  const isFiltering = Boolean(debouncedSearch.trim()) || statusFilter !== 'all';
  const migratedCount = (packages || []).filter((p) =>
    ['MIGRATED', 'SUCCESS', 'UPDATED'].includes(p.migrationStatus)
  ).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <PageHeader
        title="Integration Packages"
        count={packages ? packages.length : undefined}
        subtitle={
          packages
            ? `${migratedCount} of ${packages.length} migrated to the selected target tenant`
            : 'Loading packages from the source tenant…'
        }
      >
        <button
          className="btn"
          onClick={() => { invalidateCache(PKG_CACHE_KEY); loadPackages(true); }}
          disabled={refreshing}
          title="Reload list from source tenant"
        >
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </PageHeader>

      {/* ── Resume banners ────────────────────────────────────────────────── */}
      {activeBatch && (
        <div className="note-banner" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>A migration is still running.</strong>
            <div className="helper-text">Started {new Date(activeBatch.STARTEDAT).toLocaleString()}</div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/migrations/batch/${activeBatch.BATCHID}`)}
          >
            Continue watching
          </button>
        </div>
      )}

      {activeMigration && (
        <div className="note-banner" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>A migration of "{activeMigration.PACKAGENAME}" is still running.</strong>
            <div className="helper-text">Started {new Date(activeMigration.STARTEDAT).toLocaleString()}</div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/migrations/${activeMigration.MIGRATIONID}`)}
          >
            Continue watching
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

      {/* ── Package list ──────────────────────────────────────────────────── */}
      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Source Packages</h3>
          <div className="panel-tools">
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
            <SearchField value={search} onChange={setSearch} placeholder="Filter packages…" />
          </div>
        </div>

        {packages === null && !error && (
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-check" />
                <th>Name</th>
                <th>Mode</th>
                <th>Version</th>
                <th>Description</th>
                <th className="col-status">Status</th>
              </tr>
            </thead>
            <tbody><TableSkeleton rows={6} cols={5} hasCheckbox /></tbody>
          </table>
        )}

        {packages !== null && visiblePackages.length === 0 && !error && (
          <EmptyState
            title={isFiltering ? 'No matching packages' : 'No packages found'}
            message={
              isFiltering
                ? 'No packages match your current search or status filter.'
                : 'The selected source tenant has no integration packages.'
            }
            action={
              isFiltering ? (
                <button className="btn" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
                  Clear filters
                </button>
              ) : null
            }
          />
        )}

        {visiblePackages.length > 0 && (
          <PackageTable
            packages={visiblePackages}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />
        )}

        {visiblePackages.length > 0 && isFiltering && (
          <div className="panel-foot">
            Showing {visiblePackages.length} of {packages.length} packages
          </div>
        )}
      </div>

      <SelectionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        actionLabel={starting ? 'Starting…' : `Migrate ${selectedIds.size} selected`}
        onAction={handleMigrateSelected}
        disabled={starting}
      />
    </AppShell>
  );
}
