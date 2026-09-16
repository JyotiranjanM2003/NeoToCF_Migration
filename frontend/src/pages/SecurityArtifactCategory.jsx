import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import TableSkeleton from '../components/common/TableSkeleton.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import SearchField from '../components/common/SearchField.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import * as securityApi from '../services/api/securityMigration.api';
import { SECURITY_ALIAS_STORAGE_KEY } from './SecurityArtifacts.jsx';
import { SubTypeIcon } from '../components/security/SecurityIcons.jsx';
import { getCache, setCache, invalidateCache } from '../utils/resourceCache.js';

const ENTRIES_CACHE_TTL = 5 * 60 * 1000; // 5 min
const CATEGORIES_CACHE_KEY = 'security:categories';
const entriesCacheKey = (key) => `security:entries:${key}`;

export default function SecurityArtifactCategory() {
  const { categoryKey } = useParams();
  const navigate = useNavigate();
  const alias = sessionStorage.getItem(SECURITY_ALIAS_STORAGE_KEY) || '';

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 180);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  useEffect(() => {
    if (!alias) {
      navigate('/security', { replace: true });
      return;
    }
    setData(null);
    setError('');
    setSearch('');
    securityApi
      .listCategoryEntries(categoryKey)
      .then(setData)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load Security Artifacts'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey]);

<<<<<<< HEAD
  const visibleEntries = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return (data?.entries || []).filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.subTypeLabel.toLowerCase().includes(q) ||
        (entry.detail || '').toLowerCase().includes(q)
=======

    return (
        <AppShell>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div>
                    <h2 style={{ margin: 0 }}>{data?.label || 'Security Artifacts'}</h2>
                    <p className="helper-text" style={{ margin: '4px 0 0' }}>
                        <Link to="/security">← Manage Security</Link>
                    </p>
                </div>
                {data?.entries?.length > 0 && (
                    <input
                        className="input"
                        placeholder="Search…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        style={{ width: 220 }}
                    />
                )}
            </div>

            {/* <div className="card" style={{ marginBottom: 16 }}>
                <p className="helper-text" style={{ margin: 0 }}>
                    SAP's Security Content Transport API (MIG090) migrates this category as one encrypted
                    package — individual credential values are never migrated one at a time, since SAP does
                    not expose them for reading back out. Where a category has multiple sub-types (e.g.
                    Security Material), selecting entries below scopes the transport to just those
                    sub-types; for single-type categories (Keystore, PGP Keys, JDBC Material) the checkboxes
                    are a review of what's on the source tenant — migration transports every entry shown.
                </p>
            </div> */}

            {error && <div className="error-banner">{error}</div>}
            {startError && <div className="error-banner">{startError}</div>}

            {!data && !error && (
                <table className="table simple-table" style={{ width: '100%' }}>
                    <tbody>
                        <TableSkeleton rows={5} cols={3} />
                    </tbody>
                </table>
            )}

            {data && !data.supported && (
                <div className="empty-state">This category isn't covered by the MIG090 Security Content Transport API yet.</div>
            )}

            {data && data.noListing && (
                <>
                    <div className="card" style={{ marginBottom: 16, padding: '16px 20px', borderLeft: '4px solid var(--accent, #0070f3)' }}>
                        <p style={{ margin: 0, color: 'var(--text-secondary, #555)' }}>
                            <strong>Note:</strong> SAP CPI does not expose JDBC Material entries via its OData API,
                            so individual entries cannot be listed here. Migration is still fully supported —
                            clicking <strong>Migrate All</strong> will transport all JDBC Data Sources to the target tenant
                            via the Security Content Transport API.
                        </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                        <button className="btn btn-primary" style={{ width: 'auto' }} disabled={starting} onClick={migrateAll}>
                            {starting ? 'Starting…' : 'Migrate All'}
                        </button>
                    </div>
                </>
            )}

            {data && data.supported && !data.noListing && data.entries.length === 0 && (
                <div className="empty-state">No {data.label} entries found on the source tenant.</div>
            )}

            {data && !data.noListing && data.entries.length > 0 && (
                <>
                    {/* <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={selectAll}>Select all</button>
            <button className="btn btn-secondary" onClick={deselectAll} disabled={selected.size === 0}>Deselect all</button>
            {selected.size > 0 && (
              <span className="badge badge-connected">
                <span className="dot" />
                {selected.size} selected
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button
              className="btn btn-primary"
              style={{ width: 'auto' }}
              disabled={selected.size === 0 || starting}
              onClick={() => migrate(false)}
            >
              {starting ? 'Starting…' : `Migrate selected (${selected.size})`}
            </button>
            <button className="btn" style={{ width: 'auto' }} disabled={starting} onClick={() => migrate(true)}>
              {starting ? 'Starting…' : 'Migrate All'}
            </button>
          </div> */}

                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ flex: 1 }} />
                        <button className="btn btn-primary" style={{ width: 'auto' }} disabled={starting} onClick={migrateAll}>
                            {starting ? 'Starting…' : 'Migrate All'}
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                       <table className="table simple-table" style={{ width: '100%' }}>
                            {/* <thead>
                <tr>
                  <th><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} /></th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => toggle(entry.id)}
                    style={{ cursor: 'pointer', background: selected.has(entry.id) ? 'var(--surface-sunken)' : undefined }}
                  >
                    <td onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggle(entry.id)} />
                    </td>
                    <td className="mono">{entry.name}</td>
                    <td>{entry.subTypeLabel}</td>
                    <td>{entry.detail || '—'}</td>
                  </tr>
                ))}
              </tbody> */}
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
                                        <td className="mono">{entry.name}</td>
                                        <td>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                <SubTypeIcon subTypeKey={entry.subTypeKey} />
                                                {entry.subTypeLabel}
                                            </span>
                                        </td>
                                        <td>{entry.detail || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </AppShell>
>>>>>>> origin
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
        {isListable && (
          <SearchField value={search} onChange={setSearch} placeholder="Search…" />
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
