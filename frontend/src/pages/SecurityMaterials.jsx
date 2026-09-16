import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell.jsx';
import TableSkeleton from '../components/common/TableSkeleton.jsx';
import MigrationStatusBadge from '../components/package/MigrationStatusBadge.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import SearchField from '../components/common/SearchField.jsx';
import StatusFilter, { matchesStatusFilter } from '../components/common/StatusFilter.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import SelectionBar from '../components/common/SelectionBar.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { getCache, setCache, invalidateCache } from '../utils/resourceCache.js';
import * as numberRangeApi from '../services/api/numberRange.api';

const NR_CACHE_KEY = 'numberranges';
const NR_CACHE_TTL = 5 * 60 * 1000;

const resultLabels = {
  migrated: 'Migrated successfully',
  already_exists: 'Already exists in target tenant',
  failed: 'Migration failed',
};

/** Number Ranges list (route: /number-ranges). */
export default function SecurityMaterials() {
  const [numberRanges, setNumberRanges] = useState(() => getCache(NR_CACHE_KEY) ?? null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 180);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [loadingError, setLoadingError] = useState('');
  const [migrationError, setMigrationError] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState([]);

  // ── Load (cache-first) ────────────────────────────────────────────────────
  function loadNumberRanges(force = false) {
    if (!force) {
      const cached = getCache(NR_CACHE_KEY);
      if (cached) { setNumberRanges(cached); return; }
    }
    setRefreshing(true);
    setLoadingError('');
    numberRangeApi
      .listNumberRanges()
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
      })
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    if (!getCache(NR_CACHE_KEY)) loadNumberRanges(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtering / selection ─────────────────────────────────────────────────
  const visibleRanges = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return (numberRanges || []).filter(
      (range) =>
        (range.name.toLowerCase().includes(q) || (range.description || '').toLowerCase().includes(q)) &&
        matchesStatusFilter(range, statusFilter)
    );
  }, [numberRanges, debouncedSearch, statusFilter]);

  const allVisibleSelected =
    visibleRanges.length > 0 && visibleRanges.every((range) => selected.has(range.name));

  function toggle(name) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name); else next.add(name);
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

  function toggleExpand(name, event) {
    event.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  // ── Migration (synchronous — no polling needed) ───────────────────────────
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

  /** Patch outcomes into state + cache right after migrate() returns. */
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
      const next = prev.map((range) =>
        outcomeMap[range.name] ? { ...range, ...outcomeMap[range.name] } : range
      );
      setCache(NR_CACHE_KEY, next, NR_CACHE_TTL);
      return next;
    });
    setSelected(new Set());
  }

  const isFiltering = Boolean(debouncedSearch.trim()) || statusFilter !== 'all';
  const migratedCount = (numberRanges || []).filter((r) =>
    ['MIGRATED', 'SUCCESS', 'UPDATED'].includes(r.migrationStatus)
  ).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <PageHeader
        title="Number Ranges"
        count={numberRanges ? numberRanges.length : undefined}
        subtitle={
          numberRanges
            ? `${migratedCount} of ${numberRanges.length} migrated to the selected target tenant`
            : 'Loading Number Ranges from the source tenant…'
        }
      >
        <button
          className="btn"
          onClick={() => { invalidateCache(NR_CACHE_KEY); loadNumberRanges(true); }}
          disabled={refreshing || migrating}
          title="Reload list from source tenant"
        >
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
        <button
          className="btn btn-primary"
          disabled={migrating || !numberRanges?.length}
          onClick={() => migrate([])}
          title="Migrate all Number Ranges from source to target"
        >
          {migrating && !selected.size ? 'Migrating…' : 'Migrate All'}
        </button>
      </PageHeader>

      {loadingError && <div className="error-banner">{loadingError}</div>}
      {migrationError && <div className="error-banner">{migrationError}</div>}

      {/* ── Number range list ─────────────────────────────────────────────── */}
      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Source Number Ranges</h3>
          <div className="panel-tools">
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
            <SearchField value={search} onChange={setSearch} placeholder="Search Number Ranges…" />
          </div>
        </div>

        {numberRanges === null && !loadingError && (
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-check" />
                <th className="col-narrow" />
                <th>Name</th>
                <th>Current</th>
                <th>Min</th>
                <th>Max</th>
                <th className="col-status">Status</th>
              </tr>
            </thead>
            <tbody><TableSkeleton rows={5} cols={6} hasCheckbox /></tbody>
          </table>
        )}

        {numberRanges !== null && visibleRanges.length === 0 && !loadingError && (
          <EmptyState
            title={isFiltering ? 'No matching Number Ranges' : 'No Number Ranges found'}
            message={
              isFiltering
                ? 'No Number Ranges match your current search or status filter.'
                : 'The selected source tenant has no Number Ranges defined.'
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

        {visibleRanges.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      aria-label="Select all visible Number Ranges"
                    />
                  </th>
                  <th className="col-narrow" />
                  <th>Name</th>
                  <th>Current</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th className="col-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRanges.map((range) => {
                  const isExpanded = expanded.has(range.name);
                  const isSelected = selected.has(range.name);
                  return (
                    <React.Fragment key={range.name}>
                      <tr
                        className={`selectable${isSelected ? ' is-selected' : ''}`}
                        onClick={() => toggle(range.name)}
                      >
                        <td className="col-check" onClick={(event) => event.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggle(range.name)} />
                        </td>
                        <td className="col-narrow" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            className="number-range-expand-btn"
                            onClick={(event) => toggleExpand(range.name, event)}
                            aria-label={isExpanded ? 'Hide details' : 'Show details'}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? '▾' : '▸'}
                          </button>
                        </td>
                        <td className="cell-name">{range.name}</td>
                        <td className="cell-num">{range.currentValue || '—'}</td>
                        <td className="cell-num">{range.minValue || '—'}</td>
                        <td className="cell-num">{range.maxValue || '—'}</td>
                        <td className="col-status">
                          <MigrationStatusBadge
                            status={range.migrationStatus}
                            lastMigratedAt={range.lastMigratedAt}
                            successLabel="✓ Migrated"
                            showIdle
                          />
                        </td>
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

        {visibleRanges.length > 0 && isFiltering && (
          <div className="panel-foot">
            Showing {visibleRanges.length} of {numberRanges.length} Number Ranges
          </div>
        )}
      </div>

      <SelectionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actionLabel={migrating ? 'Migrating…' : `Migrate ${selected.size} selected`}
        onAction={() => migrate([...selected])}
        disabled={migrating}
      />

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Migration Results</h3>
            <div className="panel-tools">
              <span className="count-pill">{results.length} processed</span>
            </div>
          </div>
          {results.map((result, index) => (
            <div className="result-row" key={`${result.name}-${result.status}-${index}`}>
              <span className="result-name">{result.name}</span>
              <span className={`number-range-result-status ${result.status}`}>
                {resultLabels[result.status] || result.status}
              </span>
              {result.message && result.status === 'failed' && (
                <span className="result-msg">{result.message}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
