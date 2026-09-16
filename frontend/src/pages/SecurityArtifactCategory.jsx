import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import TableSkeleton from '../components/common/TableSkeleton.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import SearchField from '../components/common/SearchField.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import MigrationStatusBadge from '../components/package/MigrationStatusBadge.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import * as securityApi from '../services/api/securityMigration.api';
import { SECURITY_ALIAS_STORAGE_KEY } from './SecurityArtifacts.jsx';
import { SubTypeIcon } from '../components/security/SecurityIcons.jsx';
import { getCache, setCache, invalidateCache } from '../utils/resourceCache.js';

const ENTRIES_CACHE_TTL = 5 * 60 * 1000; // 5 min
const entriesCacheKey = (key) => `security:entries:${key}`;

export default function SecurityArtifactCategory() {
  const { categoryKey } = useParams();
  const navigate = useNavigate();
  const alias = sessionStorage.getItem(SECURITY_ALIAS_STORAGE_KEY) || '';

  const [data, setData] = useState(() => getCache(entriesCacheKey(categoryKey)));
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 180);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  function loadEntries(force) {
    if (!force) {
      const cached = getCache(entriesCacheKey(categoryKey));
      if (cached) { setData(cached); return; }
    }
    setRefreshing(true);
    setError('');
    securityApi
      .listCategoryEntries(categoryKey)
      .then((result) => {
        setData(result);
        setCache(entriesCacheKey(categoryKey), result, ENTRIES_CACHE_TTL);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load Security Artifacts'))
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    if (!alias) {
      navigate('/security', { replace: true });
      return;
    }
    setError('');
    setSearch('');
    setStartError('');
    if (!getCache(entriesCacheKey(categoryKey))) {
      setData(null);
      loadEntries(false);
    } else {
      setData(getCache(entriesCacheKey(categoryKey)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey]);

  const visibleEntries = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return (data?.entries || []).filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.subTypeLabel.toLowerCase().includes(q) ||
        (entry.detail || '').toLowerCase().includes(q)
    );
  }, [data, debouncedSearch]);

  /**
   * MIG090 transports a category as one encrypted package — individual
   * credential values are never migrated one at a time, since SAP does not
   * expose them for reading back out. So this page is a review of what's on
   * the source, plus a single "Migrate All" action.
   */
  async function migrateAll() {
    setStarting(true);
    setStartError('');
    try {
      const entries = data?.entries || [];
      const subTypeKeys = [...new Set(entries.map((e) => e.subTypeKey))];
      const { migrationId } = await securityApi.migrateSecurityCategory({
        targetCertificateAlias: alias,
        categoryKey,
        subTypeKeys,
      });
      invalidateCache(entriesCacheKey(categoryKey));
      invalidateCache('security:categories');
      navigate(`/migrations/${migrationId}`);
    } catch (err) {
      setStartError(err.response?.data?.message || 'Failed to start migration');
      setStarting(false);
    }
  }

  const isListable = data?.supported && data.entries.length > 0;
  // Categories SAP's OData API can't enumerate (e.g. JDBC Material, PGP Keys)
  // still migrate fine — they just have nothing to list.
  const isTransportOnly = data?.supported && data.entries.length === 0;

  return (
    <AppShell>
      <PageHeader
        title={data?.label || 'Security Artifacts'}
        count={isListable ? data.entries.length : undefined}
        back={<Link className="back-link" to="/security">← Manage Security</Link>}
      >
        {data?.migrationStatus && (
          <MigrationStatusBadge
            status={data.migrationStatus}
            lastMigratedAt={data.lastMigratedAt}
            successLabel="✓ Migrated"
          />
        )}
        {isListable && (
          <SearchField value={search} onChange={setSearch} placeholder="Search…" />
        )}
        {data?.supported && (
          <button className="btn" onClick={() => loadEntries(true)} disabled={refreshing || starting}>
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
        )}
        {data?.supported && (
          <button className="btn btn-primary" disabled={starting} onClick={migrateAll}>
            {starting ? 'Starting…' : 'Migrate All'}
          </button>
        )}
      </PageHeader>

      {error && <div className="error-banner">{error}</div>}
      {startError && <div className="error-banner">{startError}</div>}

      {/* Loading */}
      {!data && !error && (
        <div className="panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody><TableSkeleton rows={6} cols={3} hasCheckbox={false} /></tbody>
          </table>
        </div>
      )}

      {/* Unsupported category */}
      {data && !data.supported && (
        <div className="panel">
          <EmptyState
            title="Not supported yet"
            message="This category isn't covered by the MIG090 Security Content Transport API."
          />
        </div>
      )}

      {/* Supported but not enumerable via OData (JDBC Material, PGP Keys) */}
      {isTransportOnly && (
        <div className="note-banner">
          <span>
            <strong>Note:</strong> SAP CPI does not expose {data.label} entries via its OData API, so
            individual entries cannot be listed here. Migration is still fully supported — clicking{' '}
            <strong>Migrate All</strong> transports every entry to the target tenant via the Security
            Content Transport API.
          </span>
        </div>
      )}

      {/* Entry list */}
      {isListable && (
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Source {data.label}</h3>
            <div className="panel-tools">
              <span className="count-pill">{data.entries.length} entries</span>
            </div>
          </div>

          {visibleEntries.length === 0 ? (
            <EmptyState
              title="No matching entries"
              message={`No ${data.label} entries match "${search}".`}
              action={<button className="btn" onClick={() => setSearch('')}>Clear search</button>}
            />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="cell-name">{entry.name}</td>
                      <td>
                        <span className="type-cell">
                          <SubTypeIcon subTypeKey={entry.subTypeKey} />
                          {entry.subTypeLabel}
                        </span>
                      </td>
                      <td className="cell-muted">{entry.detail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {visibleEntries.length > 0 && debouncedSearch.trim() && (
            <div className="panel-foot">
              Showing {visibleEntries.length} of {data.entries.length} entries
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}