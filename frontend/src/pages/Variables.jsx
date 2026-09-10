import React, { useEffect, useRef, useState } from 'react';
import AppShell from '../components/layout/AppShell.jsx';
import MigrationProgress from '../components/migration/MigrationProgress.jsx';
import MigrationLogViewer from '../components/migration/MigrationLogViewer.jsx';
import * as variableApi from '../services/api/variableMigration.api';
import * as migrationApi from '../services/api/migration.api';

const TERMINAL_STATUSES = ['SUCCESS', 'PARTIAL', 'FAILED', 'BLOCKED'];
const POLL_INTERVAL_MS = 2500;

export default function Variables() {
  // ── Variable list state ───────────────────────────────────────────────────
  const [variables, setVariables] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState(() => new Set()); // "name::flow"

  // ── Specific-variable lookup form ─────────────────────────────────────────
  const [specificName, setSpecificName] = useState('');
  const [specificFlow, setSpecificFlow] = useState('');
  const [lookupError, setLookupError] = useState('');

  // ── Migration state ───────────────────────────────────────────────────────
  const [migrationId, setMigrationId] = useState(null);
  const [migStatus, setMigStatus] = useState(null);
  const [migReport, setMigReport] = useState(null);
  const [migError, setMigError] = useState('');
  const [starting, setStarting] = useState(false);
  const pollRef = useRef(null);

  // ── Load variables on mount ───────────────────────────────────────────────
  useEffect(() => {
    variableApi
      .listVariables()
      .then((data) => setVariables(data.variables))
      .catch((err) => {
        const code = err.response?.data?.code;
        if (code === 'NO_SOURCE_SELECTED' || code === 'SOURCE_NOT_CONNECTED') {
          setLoadError(err.response?.data?.message || 'Select a source tenant first to load variables.');
          return;
        }
        setLoadError(err.response?.data?.message || 'Failed to load variables');
      });
  }, []);

  // ── MPL polling for an active migration ──────────────────────────────────
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
          }
        }
         else {
          pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled){
            setMigError(
                err.response?.data?.message || 'Failed to load migration status'
            );
            setStarting(false);
        } 
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(pollRef.current);
    };
  }, [migrationId]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  function varKey(v) {
    return `${v.variableName}::${v.integrationFlow}`;
  }

  function toggleSelect(v) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const k = varKey(v);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleSelectAll() {
    const vis = visibleVariables;
    const allSelected = vis.length > 0 && vis.every((v) => selectedKeys.has(varKey(v)));
    if (allSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        vis.forEach((v) => next.delete(varKey(v)));
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        vis.forEach((v) => next.add(varKey(v)));
        return next;
      });
    }
  }

  const visibleVariables = (variables || []).filter((v) =>
    v.variableName.toLowerCase().includes(search.trim().toLowerCase())
  );

  const allVisibleSelected =
    visibleVariables.length > 0 && visibleVariables.every((v) => selectedKeys.has(varKey(v)));

  // ── Migration launchers ───────────────────────────────────────────────────
  async function handleMigrateSelected() {
    setStarting(true);
    setMigError('');
    setMigStatus(null);
    setMigReport(null);

    const vars = Array.from(selectedKeys).map((k) => {
      const [variableName, integrationFlow] = k.split('::');
      return { variableName, integrationFlow };
    });

    try {
      const { migrationId: id } = await variableApi.startVariableMigration(vars);
      setMigrationId(id);
    } catch (err) {
      setMigError(err.response?.data?.message || 'Failed to start migration');
      setStarting(false);
    }
  }

  async function handleMigrateAll() {
    setStarting(true);
    setMigError('');
    setMigStatus(null);
    setMigReport(null);
    try {
      const { migrationId: id } = await variableApi.startVariableMigration([]);
      setMigrationId(id);
    } catch (err) {
      setMigError(err.response?.data?.message || 'Failed to start migration');
      setStarting(false);
    }
  }

  async function handleMigrateSpecific() {
    if (!specificName.trim()) {
      setLookupError('Variable name is required');
      return;
    }
    setLookupError('');
    setStarting(true);
    setMigError('');
    setMigStatus(null);
    setMigReport(null);

    try {
      // Validate first
      await variableApi.lookupVariable(specificName.trim(), specificFlow.trim());
      const { migrationId: id } = await variableApi.startVariableMigration([
        { variableName: specificName.trim(), integrationFlow: specificFlow.trim() },
      ]);
      setMigrationId(id);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to start migration';
      if (err.response?.status === 404) {
        setLookupError(msg);
      } else {
        setMigError(msg);
      }
      setStarting(false);
    }
  }

  const migRunning = migStatus && !TERMINAL_STATUSES.includes(migStatus.migration?.STATUS);
  const canStart = !starting && !migRunning;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Variables</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            disabled={!canStart || selectedKeys.size === 0}
            onClick={handleMigrateSelected}
          >
            {starting && migRunning ? 'Migrating…' : `Migrate Selected (${selectedKeys.size})`}
          </button>
          <button
            className="btn"
            disabled={!canStart || !variables || variables.length === 0}
            onClick={handleMigrateAll}
            title="Migrate all variables from source to target"
          >
            Migrate All
          </button>
        </div>
      </div>

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

        {variables === null && !loadError && (
          <div className="empty-state">Loading variables…</div>
        )}

        {variables !== null && visibleVariables.length === 0 && (
          <div className="empty-state">No variables found{search ? ' matching filter' : ' on source tenant'}.</div>
        )}

        {visibleVariables.length > 0 && (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Variable Name</th>
                <th>Integration Flow</th>
                <th>Visibility</th>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Migration status ───────────────────────────────────────────────── */}
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
            <a
              href={`/migrations/${migrationId}`}
              style={{ fontSize: 13, color: 'var(--accent)' }}
            >
              Open full migration report →
            </a>
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
