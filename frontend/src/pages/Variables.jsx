import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import MigrationProgress from '../components/migration/MigrationProgress.jsx';
import MigrationLogViewer from '../components/migration/MigrationLogViewer.jsx';
import MigrationStatusBadge from '../components/package/MigrationStatusBadge.jsx';
import TableSkeleton from '../components/common/TableSkeleton.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { getCache, setCache, invalidateCache } from '../utils/resourceCache.js';
import * as variableApi from '../services/api/variableMigration.api';
import * as migrationApi from '../services/api/migration.api';

const TERMINAL_STATUSES = ['SUCCESS', 'PARTIAL', 'FAILED', 'BLOCKED'];
const POLL_INTERVAL_MS = 2500;
const CACHE_KEY = 'variables';
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 min — shorter than packages since values change

export default function Variables() {
  // ── Variable list state ───────────────────────────────────────────────────
  const [variables, setVariables] = useState(() => getCache(CACHE_KEY) ?? null);
  const [hasTarget, setHasTarget] = useState(true); // optimistic; corrected on load
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ── Search / filter (debounced so 500+ rows don't lag) ────────────────────
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 180);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedKeys, setSelectedKeys] = useState(() => new Set()); // "name::flow"

  // ── Specific-variable lookup form ─────────────────────────────────────────
  const [specificName, setSpecificName] = useState('');
  const [specificFlow, setSpecificFlow] = useState('');
  const [lookupError, setLookupError] = useState('');

  // ── Active migration ──────────────────────────────────────────────────────
  const [migrationId, setMigrationId] = useState(null);
  const [migStatus, setMigStatus] = useState(null);
  const [migReport, setMigReport] = useState(null);
  const [migError, setMigError] = useState('');
  const [starting, setStarting] = useState(false);
  const pollRef = useRef(null);

  // ── Load variables ────────────────────────────────────────────────────────
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
    // If we have a cache hit, paint immediately and bail (no spinner, no request).
    // The 3-min TTL acts as the safety net for staleness.
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
            // Patch migration status into local state + cache so the Status column
            // updates immediately without a full re-fetch.
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
   * After a migration completes, patch the per-variable migrationStatus/lastMigratedAt
   * directly into state (and update the cache) so the Status column reflects the
   * outcome without a network round-trip.
   */
  function applyMigrationOutcomes(artifacts) {
    if (!artifacts?.length) return;

    // Build a map: "variableName::integrationFlow" → artifact outcome
    const outcomeMap = {};
    for (const a of artifacts) {
      // ArtifactId is stored as "variableName::integrationFlow" by the service
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
      // Write the updated list back to cache so the next navigation also sees it
      setCache(CACHE_KEY, next, CACHE_TTL_MS);
      return next;
    });
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
    const vis = visibleVariables;
    const allSel = vis.length > 0 && vis.every((v) => selectedKeys.has(varKey(v)));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSel) vis.forEach((v) => next.delete(varKey(v)));
      else vis.forEach((v) => next.add(varKey(v)));
      return next;
    });
  }

  const visibleVariables = (variables || []).filter((v) =>
    v.variableName.toLowerCase().includes(debouncedSearch.trim().toLowerCase())
  );
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
      invalidateCache(CACHE_KEY); // will be repopulated optimistically on completion
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

  async function handleMigrateSpecific() {
    if (!specificName.trim()) { setLookupError('Variable name is required'); return; }
    setLookupError(''); setStarting(true); resetMigState();
    try {
      await variableApi.lookupVariable(specificName.trim(), specificFlow.trim());
      const { migrationId: id } = await variableApi.startVariableMigration([
        { variableName: specificName.trim(), integrationFlow: specificFlow.trim() },
      ]);
      invalidateCache(CACHE_KEY);
      setMigrationId(id);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to start migration';
      if (err.response?.status === 404) setLookupError(msg);
      else setMigError(msg);
      setStarting(false);
    }
  }

  const migRunning = migStatus && !TERMINAL_STATUSES.includes(migStatus.migration?.STATUS);
  const canStart = !starting && !migRunning && hasTarget;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>
          Variables{variables ? ` (${variables.length})` : ''}
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={() => { invalidateCache(CACHE_KEY); loadVariables(true); }}
            disabled={refreshing}
            title="Reload list from source tenant"
            style={{ width: 'auto' }}
          >
            {refreshing ? '↻ Loading…' : '↻ Refresh'}
          </button>
          <button
            className="btn"
            disabled={!canStart || selectedKeys.size === 0}
            onClick={handleMigrateSelected}
          >
            {starting ? 'Starting…' : `Migrate Selected (${selectedKeys.size})`}
          </button>
          <button
            className="btn"
            disabled={!canStart || !variables?.length}
            onClick={handleMigrateAll}
            title="Migrate all variables from source to target"
          >
            Migrate All
          </button>
        </div>
      </div>

      {/* ── Banners ────────────────────────────────────────────────────────── */}
      {!hasTarget && (
        <div className="error-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>No target tenant selected — migration is disabled.</span>
          <Link to="/dashboard" style={{ color: 'inherit', fontWeight: 600, marginLeft: 16 }}>
            Go to Dashboard →
          </Link>
        </div>
      )}
      {loadError && <div className="error-banner">{loadError}</div>}
      {migError && <div className="error-banner">{migError}</div>}

      {/* ── Specific variable form ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Migrate a Specific Variable</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="helper-text" style={{ margin: 0 }}>Variable Name *</label>
            <input
              className="input"
              placeholder="e.g. MyVariable"
              value={specificName}
              onChange={(e) => { setSpecificName(e.target.value); setLookupError(''); }}
              style={{ width: 200 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="helper-text" style={{ margin: 0 }}>Integration Flow (empty = global)</label>
            <input
              className="input"
              placeholder="e.g. MyFlow (or leave empty)"
              value={specificFlow}
              onChange={(e) => setSpecificFlow(e.target.value)}
              style={{ width: 240 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="helper-text" style={{ margin: 0 }}>&nbsp;</label>
            <button className="btn" disabled={!canStart} onClick={handleMigrateSpecific}>
              Migrate
            </button>
          </div>
        </div>
        {lookupError && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{lookupError}</div>
        )}
      </div>

      {/* ── Variable table ─────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Source Variables</h3>
          <input
            className="input"
            placeholder="Filter variables…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
        </div>

        {/* True first-load skeleton — only shown when variables is null (no cache hit) */}
        {variables === null && !loadError && (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>Variable Name</th>
                <th>Integration Flow</th>
                <th>Visibility</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <TableSkeleton rows={6} cols={4} hasCheckbox />
            </tbody>
          </table>
        )}

        {variables !== null && visibleVariables.length === 0 && !loadError && (
          <div className="empty-state">
            No variables found{debouncedSearch ? ' matching filter' : ' on source tenant'}.
          </div>
        )}

        {visibleVariables.length > 0 && (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
                </th>
                <th>Variable Name</th>
                <th>Integration Flow</th>
                <th>Visibility</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleVariables.map((v) => {
                const k = varKey(v);
                return (
                  <tr
                    key={k}
                    onClick={() => toggleSelect(v)}
                    style={{ cursor: 'pointer', background: selectedKeys.has(k) ? 'var(--surface-hover)' : undefined }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(k)}
                        onChange={() => toggleSelect(v)}
                      />
                    </td>
                    <td className="mono" style={{ fontSize: 13 }}>{v.variableName}</td>
                    <td style={{ fontSize: 13, color: v.integrationFlow ? undefined : 'var(--muted)' }}>
                      {v.integrationFlow || '(global)'}
                    </td>
                    <td style={{ fontSize: 13 }}>{v.visibility || '—'}</td>
                    <td>
                      <MigrationStatusBadge
                        status={v.migrationStatus}
                        lastMigratedAt={v.lastMigratedAt}
                        successLabel="✓ Migrated"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Migration status ──────────────────────────────────────────────── */}
      {migStatus && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Migration Status</h3>
          <MigrationProgress migration={migStatus.migration} artifacts={migStatus.artifacts} />
        </div>
      )}

      {migReport && (
        <>
          <h3 style={{ marginBottom: 8 }}>Migration Log</h3>
          <MigrationLogViewer logs={migReport.logs} />
          <div style={{ marginTop: 12 }}>
            <Link to={`/migrations/${migrationId}`} style={{ fontSize: 13, color: 'var(--accent)' }}>
              Open full migration report →
            </Link>
          </div>
        </>
      )}

      {migRunning && (
        <p className="helper-text" style={{ marginTop: 12 }}>
          Migration in progress — this page updates automatically.
        </p>
      )}
    </AppShell>
  );
}
