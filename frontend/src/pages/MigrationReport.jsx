import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import MigrationProgress from '../components/migration/MigrationProgress.jsx';
import MigrationLogViewer from '../components/migration/MigrationLogViewer.jsx';
import * as migrationApi from '../services/api/migration.api';

const TERMINAL_STATUSES = ['SUCCESS', 'PARTIAL', 'FAILED', 'BLOCKED'];
const POLL_INTERVAL_MS = 2000;

export default function MigrationReport() {
  const { id } = useParams();
  const [status, setStatus] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await migrationApi.getMigrationStatus(id);
        if (cancelled) return;
        setStatus(data);

        if (TERMINAL_STATUSES.includes(data.migration.STATUS)) {
          const full = await migrationApi.getMigrationReport(id);
          if (!cancelled) setReport(full);
        } else {
          pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load migration status');
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(pollRef.current);
    };
  }, [id]);

  return (
    <AppShell>
      <h2 style={{ marginBottom: 16 }}>Migration Report</h2>

      {error && <div className="error-banner">{error}</div>}

      {status && <MigrationProgress migration={status.migration} artifacts={status.artifacts} />}

      {!status && !error && <div className="empty-state">Loading migration…</div>}

      {report && (
        <>
          <h3 style={{ marginBottom: 10 }}>Log</h3>
          <MigrationLogViewer logs={report.logs} />
        </>
      )}

      {status && !TERMINAL_STATUSES.includes(status.migration.STATUS) && (
        <p className="helper-text" style={{ marginTop: 16 }}>
          Migration in progress — this page updates automatically.
        </p>
      )}
    </AppShell>
  );
}
