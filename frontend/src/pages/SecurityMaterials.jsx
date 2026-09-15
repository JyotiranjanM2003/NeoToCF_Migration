import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell.jsx';
import TableSkeleton from '../components/common/TableSkeleton.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { getCache, setCache } from '../utils/resourceCache.js';
import * as numberRangeApi from '../services/api/numberRange.api';
import MigrationStatusBadge from '../components/package/MigrationStatusBadge.jsx';

const NR_CACHE_KEY = 'numberranges';
const NR_CACHE_TTL = 5 * 60 * 1000;

const resultLabels = {
  migrated: 'Migrated successfully',
  already_exists: 'Already exists in target tenant',
  failed: 'Migration failed',
};

export default function SecurityMaterials() {
  const [numberRanges, setNumberRanges] = useState(() => getCache(NR_CACHE_KEY) ?? null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 180);
  const [selected, setSelected] = useState(() => new Set());
  const [loadingError, setLoadingError] = useState('');
  const [migrationError, setMigrationError] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [results, setResults] = useState([]);

  const [expanded, setExpanded] = useState(() => new Set());

  function toggleExpand(name, event) {
    event.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }
  useEffect(() => {
    const cached = getCache(NR_CACHE_KEY);
    if (cached) { setNumberRanges(cached); return; }

    numberRangeApi.listNumberRanges()
      .then(({ numberRanges: ranges }) => {
        setNumberRanges(ranges);
        setCache(NR_CACHE_KEY, ranges, NR_CACHE_TTL);
      })
      .catch((err) => {
        if (err.response?.data?.code === 'NO_SOURCE_SELECTED') {
          setLoadingError(err.response.data.message || 'Select a source tenant first to load Number Ranges.');
          return;
        }
        setLoadingError(err.response?.data?.message || 'Failed to load Number Ranges');
      });
  }, []);

  const visibleRanges = useMemo(() => (numberRanges || []).filter((range) =>
    range.name.toLowerCase().includes(debouncedSearch.trim().toLowerCase())
  ), [numberRanges, debouncedSearch]);
  const allVisibleSelected = visibleRanges.length > 0 && visibleRanges.every((range) => selected.has(range.name));

  function toggle(name) {
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleAll() {
    setSelected((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected) visibleRanges.forEach((range) => next.delete(range.name));
      else visibleRanges.forEach((range) => next.add(range.name));
      return next;
    });
  }

  // async function migrate(names) {
  //   setMigrating(true);
  //   setMigrationError('');
  //   setResults([]);
  //   try {
  //     const response = await numberRangeApi.migrateNumberRanges(names);
  //     setResults(response.results || []);
  //   } catch (err) {
  //     setMigrationError(err.response?.data?.message || 'Failed to migrate Number Ranges');
  //   } finally {
  //     setMigrating(false);
  //   }
  // }

  async function migrate(names) {
    setMigrating(true);
    setMigrationError('');
    setResults([]);
    try {
      const response = await numberRangeApi.migrateNumberRanges(names);
      const migrationResults = response.results || [];
      setResults(migrationResults);
      applyMigrationOutcomes(migrationResults);
    } catch (err) {
      setMigrationError(err.response?.data?.message || 'Failed to migrate Number Ranges');
    } finally {
      setMigrating(false);
    }
  }

  /**
   * Patches migrationStatus/lastMigratedAt directly into state (and the
   * cache) right after a migrate() call returns — no polling needed since
   * Number Range migration is synchronous.
   */
  function applyMigrationOutcomes(migrationResults) {
    if (!migrationResults.length) return;
    const now = new Date().toISOString();
    const outcomeMap = {};
    for (const result of migrationResults) {
      outcomeMap[result.name] = {
        migrationStatus: result.status === 'failed' ? 'FAILED' : 'MIGRATED',
        lastMigratedAt: now,
      };
    }
    setNumberRanges((prev) => {
      if (!prev) return prev;
      const next = prev.map((range) => (outcomeMap[range.name] ? { ...range, ...outcomeMap[range.name] } : range));
      setCache(NR_CACHE_KEY, next, NR_CACHE_TTL);
      return next;
    });
  }

  return (
    <AppShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div><h2 style={{ margin: 0 }}>Number Ranges</h2><p style={{ margin: '4px 0 0' }}>Security Materials migration</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" disabled={migrating || selected.size === 0} onClick={() => migrate([...selected])}>
            {migrating ? 'Migrating…' : `Migrate Selected (${selected.size})`}
          </button>
          <button className="btn" disabled={migrating || !numberRanges?.length} onClick={() => migrate([])}>Migrate All</button>
        </div>
      </div>

      {loadingError && <div className="error-banner">{loadingError}</div>}
      {migrationError && <div className="error-banner">{migrationError}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Source Number Ranges</h3>
          <input className="input" placeholder="Search Number Ranges…" value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: 220 }} />
        </div>
        {numberRanges === null && !loadingError && (
          <table className="table number-range-table" style={{ width: '100%' }}>
            <thead><tr><th /><th /><th>Name</th><th>Current Value</th><th>Min Value</th><th>Max Value</th><th>Status</th></tr></thead>
            <tbody><TableSkeleton rows={5} cols={6} hasCheckbox /></tbody>
          </table>
        )}
        {numberRanges !== null && visibleRanges.length === 0 && <div className="empty-state">No Number Ranges found{search ? ' matching filter' : ' on source tenant'}.</div>}
        {visibleRanges.length > 0 && (
          <div className="number-range-table-wrap">
            <table className="table number-range-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} /></th>
                  <th />
                  <th>Name</th>
                  <th>Current Value</th>
                  <th>Min Value</th>
                  <th>Max Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRanges.map((range) => {
                  const isExpanded = expanded.has(range.name);
                  return (
                    <React.Fragment key={range.name}>
                      <tr
                        onClick={() => toggle(range.name)}
                        style={{ cursor: 'pointer', background: selected.has(range.name) ? 'var(--surface-sunken)' : undefined }}
                      >
                        <td onClick={(event) => event.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(range.name)} onChange={() => toggle(range.name)} />
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            className="number-range-expand-btn"
                            onClick={(event) => toggleExpand(range.name, event)}
                            aria-label={isExpanded ? 'Hide details' : 'Show details'}
                          >
                            {isExpanded ? '▾' : '▸'}
                          </button>
                        </td>
                        <td className="mono">{range.name}</td>
                        <td>{range.currentValue || '—'}</td>
                        <td>{range.minValue || '—'}</td>
                        <td>{range.maxValue || '—'}</td>
                        <td><MigrationStatusBadge status={range.migrationStatus} lastMigratedAt={range.lastMigratedAt} successLabel="✓ Migrated" /></td>
                      </tr>
                      {isExpanded && (
                        <tr className="number-range-detail-row">
                          <td colSpan={7}>
                            <dl className="number-range-detail-grid">
                              <div className="number-range-detail-item">
                                <dt>Description</dt>
                                <dd>{range.description || '—'}</dd>
                              </div>
                              <div className="number-range-detail-item">
                                <dt>Rotate</dt>
                                <dd>{range.rotate === '' ? '—' : String(range.rotate)}</dd>
                              </div>
                              <div className="number-range-detail-item">
                                <dt>Field Length</dt>
                                <dd>{range.fieldLength || '—'}</dd>
                              </div>
                            </dl>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {results.length > 0 && <div className="card"><div className="number-range-results-heading"><h3 style={{ margin: 0 }}>Migration Results</h3><span className="helper-text" style={{ margin: 0 }}>{results.length} processed</span></div>
        {results.map((result, index) => <div className="number-range-result" key={`${result.name}-${result.status}-${index}`}>
          <span className="mono">{result.name}</span><span className={`number-range-result-status ${result.status}`}>{resultLabels[result.status] || result.status}</span>{result.message && result.status === 'failed' ? <span className="helper-text">{result.message}</span> : null}
        </div>)}
      </div>}
    </AppShell>
  );
}
