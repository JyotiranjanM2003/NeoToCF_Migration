import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import TableSkeleton from '../components/common/TableSkeleton.jsx';
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

    const [data, setData] = useState(() => getCache(entriesCacheKey(categoryKey)) ?? null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, 180);
    //const [selected, setSelected] = useState(() => new Set());
    const [starting, setStarting] = useState(false);
    const [startError, setStartError] = useState('');

    useEffect(() => {
        if (!alias) {
            navigate('/security', { replace: true });
            return;
        }
        // Serve from cache if still fresh
        const cached = getCache(entriesCacheKey(categoryKey));
        if (cached) {
            setData(cached);
            setError('');
            return;
        }
        setData(null);
        setError('');
        securityApi
            .listCategoryEntries(categoryKey)
            .then((result) => {
                setData(result);
                setCache(entriesCacheKey(categoryKey), result, ENTRIES_CACHE_TTL);
            })
            .catch((err) => setError(err.response?.data?.message || 'Failed to load Security Artifacts'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryKey]);

    const visibleEntries = useMemo(
        () =>
            (data?.entries || []).filter(
                (entry) =>
                    entry.name.toLowerCase().includes(debouncedSearch.trim().toLowerCase()) ||
                    entry.subTypeLabel.toLowerCase().includes(debouncedSearch.trim().toLowerCase())
            ),
        [data, debouncedSearch]
    );

    // const allVisibleSelected = visibleEntries.length > 0 && visibleEntries.every((e) => selected.has(e.id));

    //   function toggle(id) {
    //     setSelected((prev) => {
    //       const next = new Set(prev);
    //       next.has(id) ? next.delete(id) : next.add(id);
    //       return next;
    //     });
    //   }

    //   function toggleAll() {
    //     setSelected((prev) => {
    //       const next = new Set(prev);
    //       if (allVisibleSelected) visibleEntries.forEach((e) => next.delete(e.id));
    //       else visibleEntries.forEach((e) => next.add(e.id));
    //       return next;
    //     });
    //   }

    //   function selectAll() {
    //     setSelected(new Set((data?.entries || []).map((e) => e.id)));
    //   }

    //   function deselectAll() {
    //     setSelected(new Set());
    //   }

    //   async function migrate(useAllEntries) {
    //     setStarting(true);
    //     setStartError('');
    //     try {
    //       const entries = useAllEntries ? data?.entries || [] : (data?.entries || []).filter((e) => selected.has(e.id));
    //       const subTypeKeys = [...new Set(entries.map((e) => e.subTypeKey))];
    //       const { migrationId } = await securityApi.migrateSecurityCategory({
    //         targetCertificateAlias: alias,
    //         categoryKey,
    //         subTypeKeys,
    //       });
    //       navigate(`/migrations/${migrationId}`);
    //     } catch (err) {
    //       setStartError(err.response?.data?.message || 'Failed to start migration');
    //       setStarting(false);
    //     }
    //   }

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
            // Invalidate caches so the next visit re-fetches fresh counts
            invalidateCache(entriesCacheKey(categoryKey));
            invalidateCache(CATEGORIES_CACHE_KEY);
            navigate(`/migrations/${migrationId}`);
        } catch (err) {
            setStartError(err.response?.data?.message || 'Failed to start migration');
            setStarting(false);
        }
    }


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
    );
}