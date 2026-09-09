import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import MigrationProgress from '../components/migration/MigrationProgress.jsx';
import MigrationLogViewer from '../components/migration/MigrationLogViewer.jsx';
import * as datastoreApi from '../services/api/datastoreMigration.api';
import * as migrationApi from '../services/api/migration.api';

const TERMINAL_STATUSES = ['SUCCESS', 'PARTIAL', 'FAILED', 'BLOCKED'];
const POLL_INTERVAL_MS = 2500;

export default function DataStores() {
  const navigate = useNavigate();

  // ── Data store list state ─────────────────────────────────────────────────
  const [dataStores, setDataStores] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState(() => new Set()); // "name::flow::type"

  // ── Specific-data-store lookup form ───────────────────────────────────────
  const [specificName, setSpecificName] = useState('');
  const [specificFlow, setSpecificFlow] = useState('');
  const [specificEntryId, setSpecificEntryId] = useState('');
  const [lookupError, setLookupError] = useState('');

  // ── Migration state ───────────────────────────────────────────────────────
  const [migrationId, setMigrationId] = useState(null);
  const [migStatus, setMigStatus] = useState(null);
  const [migReport, setMigReport] = useState(null);
  const [migError, setMigError] = useState('');
  const [starting, setStarting] = useState(false);
  const pollRef = useRef(null);

  // ── Duplicate-migration warning popup ─────────────────────────────────────
  // { duplicates: [{ dataStoreName, integrationFlow, lastMigratedAt }], pendingStores: [...] }
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // ── Load data stores on mount ─────────────────────────────────────────────
  useEffect(() => {
    datastoreApi
      .listDataStores()
      .then((data) => setDataStores(data.dataStores))
      .catch((err) => {
        const code = err.response?.data?.code;
        if (code === 'NO_SOURCE_SELECTED' || code === 'SOURCE_NOT_CONNECTED') {
          navigate('/dashboard', {
            replace: true,
            state: { notice: err.response.data.message || 'Select a source tenant first.' },
          });
          return;
        }
        setLoadError(err.response?.data?.message || 'Failed to load data stores');
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
    return () => {
      cancelled = true;
      clearTimeout(pollRef.current);
    };
  }, [migrationId]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  function dsKey(d) {
    return `${d.dataStoreName}::${d.integrationFlow}::${d.type || ''}`;
  }

  function toggleSelect(d) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const k = dsKey(d);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleSelectAll() {
    const vis = visibleDataStores;
    const allSelected = vis.length > 0 && vis.every((d) => selectedKeys.has(dsKey(d)));
    if (allSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        vis.forEach((d) => next.delete(dsKey(d)));
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        vis.forEach((d) => next.add(dsKey(d)));
        return next;
      });
    }
  }

  const visibleDataStores = (dataStores || []).filter((d) =>
    d.dataStoreName.toLowerCase().includes(search.trim().toLowerCase())
  );

  const allVisibleSelected =
    visibleDataStores.length > 0 && visibleDataStores.every((d) => selectedKeys.has(dsKey(d)));

  // ── Shared migration launcher (handles the duplicate-check popup) ────────
  async function launchMigration(storesPayload) {
    setStarting(true);
    setMigError('');
    setMigStatus(null);
    setMigReport(null);
    setDuplicateWarning(null);

    try {
      const { migrationId: id } = await datastoreApi.startDataStoreMigration(storesPayload, false);
      setMigrationId(id);
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.code === 'DUPLICATE_DATASTORES') {
        setStarting(false);
        setDuplicateWarning({
          duplicates: err.response.data.duplicates,
          pendingStores: storesPayload,
        });
        return;
      }
      setMigError(err.response?.data?.message || 'Failed to start migration');
      setStarting(false);
    }
  }

  async function confirmForcedMigration() {
    if (!duplicateWarning) return;
    const { pendingStores } = duplicateWarning;
    setDuplicateWarning(null);
    setStarting(true);
    setMigError('');
    setMigStatus(null);
    setMigReport(null);
    try {
      const { migrationId: id } = await datastoreApi.startDataStoreMigration(pendingStores, true);
      setMigrationId(id);
    } catch (err) {
      setMigError(err.response?.data?.message || 'Failed to start migration');
      setStarting(false);
    }
  }

  // ── Migration launchers ───────────────────────────────────────────────────
  async function handleMigrateSelected() {
    const stores = Array.from(selectedKeys).map((k) => {
      const [dataStoreName, integrationFlow, type] = k.split('::');
      return { dataStoreName, integrationFlow, type };
    });
    await launchMigration(stores);
  }

  async function handleMigrateAll() {
    await launchMigration([]);
  }

  async function handleMigrateSpecific() {
    if (!specificName.trim()) {
      setLookupError('Data store name is required');
      return;
    }
    setLookupError('');

    try {
      // Validate first (also previews retention settings)
      await datastoreApi.lookupDataStore(specificName.trim(), specificFlow.trim());
    } catch (err) {
      setLookupError(err.response?.data?.message || 'Data store not found on source');
      return;
    }

    await launchMigration([
      {
        dataStoreName: specificName.trim(),
        integrationFlow: specificFlow.trim(),
        entryId: specificEntryId.trim(),
      },
    ]);
  }

  const migRunning = migStatus && !TERMINAL_STATUSES.includes(migStatus.migration?.STATUS);
  const canStart = !starting && !migRunning;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Data Stores</h2>
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
            disabled={!canStart || !dataStores || dataStores.length === 0}
            onClick={handleMigrateAll}
            title="Migrate all data stores from source to target"
          >
            Migrate All
          </button>
        </div>
      </div>

      {loadError && <div className="error-banner">{loadError}</div>}
      {migError && <div className="error-banner">{migError}</div>}

      {/* ── Specific data store form ───────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Migrate a Specific Data Store</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="helper-text" style={{ margin: 0 }}>Data Store Name *</label>
            <input
              className="input"
              placeholder="e.g. MyDataStore"
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
              style={{ width: 220 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="helper-text" style={{ margin: 0 }}>Entry ID (empty = all entries)</label>
            <input
              className="input"
              placeholder="optional"
              value={specificEntryId}
              onChange={(e) => setSpecificEntryId(e.target.value)}
              style={{ width: 180 }}
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

      {/* ── Data store table ───────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Source Data Stores</h3>
          <input
            className="input"
            placeholder="Filter data stores…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
        </div>

        {dataStores === null && !loadError && (
          <div className="empty-state">Loading data stores…</div>
        )}

        {dataStores !== null && visibleDataStores.length === 0 && (
          <div className="empty-state">
            No data stores found{search ? ' matching filter' : ' on source tenant'}.
          </div>
        )}

        {visibleDataStores.length > 0 && (
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
                <th>Data Store Name</th>
                <th>Integration Flow</th>
                <th>Type</th>
                <th>Entries</th>
              </tr>
            </thead>
            <tbody>
              {visibleDataStores.map((d) => {
                const k = dsKey(d);
                return (
                  <tr
                    key={k}
                    onClick={() => toggleSelect(d)}
                    style={{ cursor: 'pointer', background: selectedKeys.has(k) ? 'var(--surface-hover)' : undefined }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(k)}
                        onChange={() => toggleSelect(d)}
                      />
                    </td>
                    <td className="mono" style={{ fontSize: 13 }}>{d.dataStoreName}</td>
                    <td style={{ fontSize: 13, color: d.integrationFlow ? undefined : 'var(--muted)' }}>
                      {d.integrationFlow || '(global)'}
                    </td>
                    <td style={{ fontSize: 13 }}>{d.type || '—'}</td>
                    <td style={{ fontSize: 13 }}>{d.totalEntries ?? '—'}</td>
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

      {/* ── Duplicate-migration warning popup ────────────────────────────── */}
      {duplicateWarning && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}
  >
    <div className="card" style={{ maxWidth: 340, width: '90%', padding: 20, textAlign: 'center' }}>
      <p style={{ fontSize: 14, margin: '0 0 16px 0' }}>
        {duplicateWarning.duplicates.length === 1
          ? `"${duplicateWarning.duplicates[0].dataStoreName}" is already migrated.`
          : `${duplicateWarning.duplicates.length} selected data stores are already migrated.`}
      </p>
      <button className="btn" onClick={() => setDuplicateWarning(null)}>
        OK
      </button>
    </div>
  </div>
)}
    </AppShell>
  );
}