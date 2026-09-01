import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import MigrationProgress from '../components/migration/MigrationProgress.jsx';
import MigrationLogViewer from '../components/migration/MigrationLogViewer.jsx';
import * as migrationApi from '../services/api/migration.api';

const TERMINAL_STATUSES = ['SUCCESS', 'PARTIAL', 'FAILED', 'BLOCKED'];
const POLL_INTERVAL_MS = 2000;

export default function BatchMigrationReport() {
  const { batchId } = useParams();
  const [status, setStatus] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await migrationApi.getBatchStatus(batchId);
        if (cancelled) return;
        setStatus(data);

        if (TERMINAL_STATUSES.includes(data.batch.STATUS)) {
          const full = await migrationApi.getBatchReport(batchId);
          if (!cancelled) setReport(full);
        } else {
          pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load batch status');
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(pollRef.current);
    };
  }, [batchId]);

  // Merge live artifact status (from `status`) with full log detail (from
  // `report`, only available once the batch has finished) per package.
  const perPackageLogs = new Map((report?.migrations || []).map((m) => [m.migration.MIGRATIONID, m.logs]));

  return (
    <AppShell>
      <h2 style={{ marginBottom: 4 }}>Migration Report</h2>
      <p>Batch of {status?.migrations?.length ?? '…'} package(s).</p>

      {error && <div className="error-banner">{error}</div>}

      {status && (
        <div
          className="card"
          style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div>
            <strong>Batch status: </strong>
            <span
              className={`badge ${
                status.batch.STATUS === 'SUCCESS'
                  ? 'badge-connected'
                  : status.batch.STATUS === 'RUNNING'
                  ? 'badge-disconnected'
                  : 'badge-error'
              }`}
            >
              <span className="dot" />
              {status.batch.STATUS}
            </span>
          </div>
          <div className="helper-text">
            Started {new Date(status.batch.STARTEDAT).toLocaleString()}
            {status.batch.COMPLETEDAT && ` · Completed ${new Date(status.batch.COMPLETEDAT).toLocaleString()}`}
          </div>
        </div>
      )}

      {!status && !error && <div className="empty-state">Loading batch…</div>}

      {status?.migrations?.map(({ migration, artifacts }) => (
        <div key={migration.MIGRATIONID} style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 8 }}>{migration.PACKAGENAME}</h3>
          <MigrationProgress migration={migration} artifacts={artifacts} />

          {perPackageLogs.get(migration.MIGRATIONID) && (
            <>
              <div className="helper-text" style={{ margin: '8px 0 6px' }}>
                Log
              </div>
              <MigrationLogViewer logs={perPackageLogs.get(migration.MIGRATIONID)} />
            </>
          )}
        </div>
      ))}

      {status && !TERMINAL_STATUSES.includes(status.batch.STATUS) && (
        <p className="helper-text" style={{ marginTop: 16 }}>
          Migration in progress — this page updates automatically.
        </p>
      )}
    </AppShell>
  );
}