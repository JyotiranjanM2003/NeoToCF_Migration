import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import MigrationProgress from '../components/migration/MigrationProgress.jsx';
import MigrationLogViewer from '../components/migration/MigrationLogViewer.jsx';
import MigrationStatusBadge from '../components/package/MigrationStatusBadge.jsx';
import TableSkeleton from '../components/common/TableSkeleton.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import SearchField from '../components/common/SearchField.jsx';
import StatusFilter, { matchesStatusFilter } from '../components/common/StatusFilter.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import SelectionBar from '../components/common/SelectionBar.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { getCache, setCache, invalidateCache } from '../utils/resourceCache.js';
import * as variableApi from '../services/api/variableMigration.api';
import * as migrationApi from '../services/api/migration.api';

const TERMINAL_STATUSES = ['SUCCESS', 'PARTIAL', 'FAILED', 'BLOCKED'];
const POLL_INTERVAL_MS = 2500;
const CACHE_KEY = 'variables';
const CACHE_TTL_MS = 3 * 60 * 1000;

export default function Variables() {
  // ── List state ────────────────────────────────────────────────────────────
  const [variables, setVariables] = useState(() => getCache(CACHE_KEY) ?? null);
  const [hasTarget, setHasTarget] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ── Search / filter ───────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 180);
  const [statusFilter, setStatusFilter] = useState('all');

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());

  // ── Active migration ──────────────────────────────────────────────────────
  const [migrationId, setMigrationId] = useState(null);
  const [migStatus, setMigStatus] = useState(null);
  const [migReport, setMigReport] = useState(null);
  const [migError, setMigError] = useState('');
  const [starting, setStarting] = useState(false);
  const pollRef = useRef(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  function loadVariables(force = false) {
    if (!force) {
      const cached = getCache(CACHE_KEY);
      if (cached) { setVariables(cached); return; }
    }
    setRefreshing(true);
    setLoadError('');
    variableApi
      .listVariables()
      .then((data) => {
        setVariables(data.variables);
        setHasTarget(data.hasTarget ?? true);
        setCache(CACHE_KEY, data.variables, CACHE_TTL_MS);
      })
      .catch((err) => {
        const code = err.response?.data?.code;
        if (code === 'NO_SOURCE_SELECTED' || code === 'SOURCE_NOT_CONNECTED') {
          setLoadError(err.response?.data?.message || 'Select a source tenant first to load variables.');
          return;
        }
        setLoadError(err.response?.data?.message || 'Failed to load variables');
      })
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    if (!getCache(CACHE_KEY)) loadVariables(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Poll active migration ─────────────────────────────────────────────────
  useEffect(() => {
    if (!migrationId) return;
    let cancelled = false;

    async function poll() {
      try {
        const data = await migrationApi.getMigrationStatus(migrationId);
        if (cancelled) return;
        setMigStatus(data);

        if (TERMINAL_STATUSES.includes(data.migration.STATUS)) {
          const full = await migrationApi.getMigrationReport(migrationId);
          if (!cancelled) {
            setMigReport(full);
            setStarting(false);
            applyMigrationOutcomes(data.artifacts);
          }
        } else {
          pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) {
          setMigError(err.response?.data?.message || 'Failed to load migration status');
          setStarting(false);
        }
      }
    }

    poll();
    return () => { cancelled = true; clearTimeout(pollRef.current); };
  }, [migrationId]);

  /**
   * Patch per-variable outcomes into state + cache so the Status column
   * updates as soon as the run finishes, without a re-fetch.
   */
  function applyMigrationOutcomes(artifacts) {
    if (!artifacts?.length) return;

    const outcomeMap = {};
    for (const a of artifacts) {
      outcomeMap[a.ARTIFACTID] = {
        migrationStatus: a.STATUS,
        lastMigratedAt: a.COMPLETEDAT || a.STARTEDAT || new Date().toISOString(),
      };
    }

    setVariables((prev) => {
      if (!prev) return prev;
      const next = prev.map((v) => {
        const key = `${v.variableName}::${v.integrationFlow}`;
        return outcomeMap[key] ? { ...v, ...outcomeMap[key] } : v;
      });
      setCache(CACHE_KEY, next, CACHE_TTL_MS);
      return next;
    });
    setSelectedKeys(new Set());
  }

  // ── Selection helpers ─────────────────────────────────────────────────────
  function varKey(v) { return `${v.variableName}::${v.integrationFlow}`; }

  function toggleSelect(v) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const k = varKey(v);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  function toggleSelectAll() {
    const allSel = visibleVariables.length > 0 && visibleVariables.every((v) => selectedKeys.has(varKey(v)));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSel) visibleVariables.forEach((v) => next.delete(varKey(v)));
      else visibleVariables.forEach((v) => next.add(varKey(v)));
      return next;
    });
  }

  const visibleVariables = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return (variables || []).filter(
      (v) =>
        (v.variableName.toLowerCase().includes(q) || (v.integrationFlow || '').toLowerCase().includes(q)) &&
        matchesStatusFilter(v, statusFilter)
    );
  }, [variables, debouncedSearch, statusFilter]);

  const allVisibleSelected =
    visibleVariables.length > 0 && visibleVariables.every((v) => selectedKeys.has(varKey(v)));

  // ── Migration launchers ───────────────────────────────────────────────────
  function resetMigState() {
    setMigError(''); setMigStatus(null); setMigReport(null);
  }

  async function handleMigrateSelected() {
    setStarting(true); resetMigState();
    const vars = Array.from(selectedKeys).map((k) => {
      const [variableName, integrationFlow] = k.split('::');
      return { variableName, integrationFlow };
    });
    try {
      const { migrationId: id } = await variableApi.startVariableMigration(vars);
      invalidateCache(CACHE_KEY);
      setMigrationId(id);
    } catch (err) {
      setMigError(err.response?.data?.message || 'Failed to start migration');
      setStarting(false);
    }
  }

  async function handleMigrateAll() {
    setStarting(true); resetMigState();
    try {
      const { migrationId: id } = await variableApi.startVariableMigration([]);
      invalidateCache(CACHE_KEY);
      setMigrationId(id);
    } catch (err) {
      setMigError(err.response?.data?.message || 'Failed to start migration');
      setStarting(false);
    }
  }

  const migRunning = migStatus && !TERMINAL_STATUSES.includes(migStatus.migration?.STATUS);
  const canStart = !starting && !migRunning && hasTarget;
  const isFiltering = Boolean(debouncedSearch.trim()) || statusFilter !== 'all';
  const migratedCount = (variables || []).filter((v) =>
    ['MIGRATED', 'SUCCESS', 'UPDATED'].includes(v.migrationStatus)
  ).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <PageHeader
        title="Variables"
        count={variables ? variables.length : undefined}
        subtitle={
          variables
            ? `${migratedCount} of ${variables.length} migrated to the selected target tenant`
            : 'Loading variables from the source tenant…'
        }
      >
        <button
          className="btn"
          onClick={() => { invalidateCache(CACHE_KEY); loadVariables(true); }}
          disabled={refreshing}
          title="Reload list from source tenant"
        >
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
        <button
          className="btn btn-primary"
          disabled={!canStart || !variables?.length}
          onClick={handleMigrateAll}
          title="Migrate every variable from source to target"
        >
          {starting && !selectedKeys.size ? 'Starting…' : 'Migrate All'}
        </button>
      </PageHeader>

      {!hasTarget && (
        <div className="warn-banner">
          <span>No target tenant selected — migration is disabled.</span>
          <Link to="/dashboard" style={{ color: 'inherit', fontWeight: 700 }}>Go to Dashboard →</Link>
        </div>
      )}
      {loadError && <div className="error-banner">{loadError}</div>}
      {migError && <div className="error-banner">{migError}</div>}

      {/* ── Variable list ─────────────────────────────────────────────────── */}
      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Source Variables</h3>
          <div className="panel-tools">
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
            <SearchField value={search} onChange={setSearch} placeholder="Filter variables…" />
          </div>
        </div>

        {/* First-load skeleton — only when there was no cache hit */}
        {variables === null && !loadError && (
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-check" />
                <th>Variable Name</th>
                <th>Integration Flow</th>
                <th>Visibility</th>
                <th className="col-status">Status</th>
              </tr>
            </thead>
            <tbody><TableSkeleton rows={6} cols={4} hasCheckbox /></tbody>
          </table>
        )}

        {variables !== null && visibleVariables.length === 0 && !loadError && (
          <EmptyState
            title={isFiltering ? 'No matching variables' : 'No variables found'}
            message={
              isFiltering
                ? 'No variables match your current search or status filter.'
                : 'The selected source tenant has no variables defined.'
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

        {visibleVariables.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all visible variables"
                    />
                  </th>
                  <th>Variable Name</th>
                  <th>Integration Flow</th>
                  <th>Visibility</th>
                  <th className="col-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleVariables.map((v) => {
                  const k = varKey(v);
                  const isSelected = selectedKeys.has(k);
                  return (
                    <tr
                      key={k}
                      className={`selectable${isSelected ? ' is-selected' : ''}`}
                      onClick={() => toggleSelect(v)}
                    >
                      <td className="col-check" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(v)} />
                      </td>
                      <td className="cell-name">{v.variableName}</td>
                      <td className={v.integrationFlow ? '' : 'cell-muted'}>
                        {v.integrationFlow || '(global)'}
                      </td>
                      <td className="cell-muted">{v.visibility || '—'}</td>
                      <td className="col-status">
                        <MigrationStatusBadge
                          status={v.migrationStatus}
                          lastMigratedAt={v.lastMigratedAt}
                          successLabel="✓ Migrated"
                          showIdle
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {visibleVariables.length > 0 && isFiltering && (
          <div className="panel-foot">
            Showing {visibleVariables.length} of {variables.length} variables
          </div>
        )}
      </div>

      <SelectionBar
        count={selectedKeys.size}
        onClear={() => setSelectedKeys(new Set())}
        actionLabel={starting ? 'Starting…' : `Migrate ${selectedKeys.size} selected`}
        onAction={handleMigrateSelected}
        disabled={!canStart}
      />

      {/* ── Migration progress ────────────────────────────────────────────── */}
      {migStatus && (
        <div className="panel">
          <div className="panel-head"><h3 className="panel-title">Migration Status</h3></div>
          <div className="panel-body">
            <MigrationProgress migration={migStatus.migration} artifacts={migStatus.artifacts} />
          </div>
        </div>
      )}

      {migReport && (
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Migration Log</h3>
            <div className="panel-tools">
              <Link className="btn" to={`/migrations/${migrationId}`}>Open full report →</Link>
            </div>
          </div>
          <div className="panel-body">
            <MigrationLogViewer logs={migReport.logs} />
          </div>
        </div>
      )}

      {migRunning && (
        <p className="helper-text">Migration in progress — this page updates automatically.</p>
      )}
    </AppShell>
  );
}
