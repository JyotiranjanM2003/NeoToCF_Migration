import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import MigrationStatusBadge from '../components/package/MigrationStatusBadge.jsx';
import useConsoleSummary, { CONTENT_TYPES } from '../hooks/useConsoleSummary.js';
import { SECURITY_ALIAS_STORAGE_KEY } from './SecurityArtifacts.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.notice;

  const { tenants, counts, report, loading, error, reload } = useConsoleSummary();

  // ── Roll-ups across every content type ──────────────────────────────────
  const totals = CONTENT_TYPES.reduce(
    (acc, type) => {
      const c = counts[type.key] || {};
      acc.total += c.total || 0;
      acc.migrated += c.migrated || 0;
      acc.failed += c.failed || 0;
      return acc;
    },
    { total: 0, migrated: 0, failed: 0 }
  );
  const pct = totals.total ? Math.round((totals.migrated / totals.total) * 100) : 0;
  const ready = Math.max(totals.total - totals.migrated - totals.failed, 0);

  const recentRuns = (report?.rows || []).slice(0, 4);
  const lastRun = recentRuns[0];
  const certAlias = sessionStorage.getItem(SECURITY_ALIAS_STORAGE_KEY) || '';

  const readiness = [
    {
      done: Boolean(tenants.source),
      title: 'Source Neo tenant connected',
      detail: tenants.source ? tenants.source.host : 'Required before any content can be read',
      action: tenants.source ? null : { label: 'Connect', to: '/tenants' },
    },
    {
      done: Boolean(tenants.target),
      title: 'Target Cloud Foundry tenant connected',
      detail: tenants.target ? tenants.target.host : 'Required before anything can be migrated',
      action: tenants.target ? null : { label: 'Connect', to: '/tenants' },
    },
    {
      done: Boolean(certAlias),
      title: 'Target certificate alias verified',
      detail: certAlias || 'Required before Security Materials can migrate',
      action: certAlias ? null : { label: 'Set up', to: '/security' },
    },
  ];

  return (
    <AppShell tenants={tenants}>
      {notice && <div className="warn-banner">{notice}</div>}
      {error && <div className="error-banner">{error}</div>}

      {/* ── Stat row ──────────────────────────────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-kicker">Overall progress</div>
          <div className="stat-value">{loading && !totals.total ? '—' : `${pct}%`}</div>
          <div className="stat-sub">{totals.migrated} of {totals.total} objects migrated</div>
          <div className="stat-bar"><i style={{ width: `${pct}%` }} /></div>
        </div>

        <div className="stat-card">
          <div className="stat-kicker">Ready to migrate</div>
          <div className="stat-value">{loading && !totals.total ? '—' : ready}</div>
          <div className="stat-sub">Across {CONTENT_TYPES.length} content types</div>
        </div>

        <div className="stat-card">
          <div className="stat-kicker">Needs attention</div>
          <div className="stat-value" style={{ color: totals.failed ? 'var(--danger)' : undefined }}>
            {loading && !totals.total ? '—' : totals.failed}
          </div>
          <div className="stat-sub">Failed in the last run</div>
        </div>

        <div className="stat-card">
          <div className="stat-kicker">Last activity</div>
          <div className="stat-value stat-value-sm">
            {lastRun
              ? new Date(lastRun.completedAt || lastRun.startedAt).toLocaleString(undefined, {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })
              : 'No runs yet'}
          </div>
          <div className="stat-sub">{lastRun ? `${lastRun.category} · ${lastRun.status}` : 'Migrate something to get started'}</div>
        </div>
      </div>

      <div className="dash-grid">
        {/* ── Content coverage ───────────────────────────────────────────── */}
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Content coverage</h3>
            <div className="panel-tools">
              <span className="helper-text" style={{ margin: 0 }}>Click a row to open that content type</span>
            </div>
          </div>

          {CONTENT_TYPES.map((type) => {
            const c = counts[type.key] || { total: 0, migrated: 0, failed: 0, loaded: false };
            const rowPct = c.total ? Math.round((c.migrated / c.total) * 100) : 0;
            return (
              <button
                type="button"
                key={type.key}
                className="coverage-row"
                onClick={() => navigate(type.route)}
              >
                <span className="coverage-main">
                  <span className="coverage-name">{type.label}</span>
                  <span className="coverage-sub">
                    {c.loaded ? `${c.total} object${c.total === 1 ? '' : 's'}` : 'Not loaded'}
                    {c.failed > 0 && <span className="coverage-fail"> · {c.failed} failed</span>}
                  </span>
                </span>
                <span className="coverage-bar"><i style={{ width: `${rowPct}%` }} /></span>
                <span className="coverage-count mono">{c.migrated}/{c.total}</span>
                <span className="coverage-chevron" aria-hidden="true">›</span>
              </button>
            );
          })}
        </div>

        <div>
          {/* ── Readiness ────────────────────────────────────────────────── */}
          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Migration readiness</h3>
              <div className="panel-tools">
                <button className="btn btn-sm" onClick={reload} disabled={loading}>
                  {loading ? 'Refreshing…' : '↻ Refresh'}
                </button>
              </div>
            </div>

            {readiness.map((item) => (
              <div className="check-row" key={item.title}>
                <span className={`check-mark ${item.done ? 'check-done' : 'check-todo'}`}>
                  {item.done ? '✓' : '!'}
                </span>
                <span className="check-main">
                  <span className="check-title">{item.title}</span>
                  <span className="check-detail mono">{item.detail}</span>
                </span>
                {item.action && (
                  <Link className="btn btn-sm" to={item.action.to}>{item.action.label}</Link>
                )}
              </div>
            ))}
          </div>

          {/* ── Recent runs ──────────────────────────────────────────────── */}
          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Recent runs</h3>
              <div className="panel-tools">
                <Link className="btn btn-sm" to="/migration-report">View all</Link>
              </div>
            </div>

            {recentRuns.length === 0 ? (
              <div className="empty-block" style={{ padding: '28px 20px' }}>
                <h4>No migrations yet</h4>
                <p>Runs you start from any content page will appear here.</p>
              </div>
            ) : (
              recentRuns.map((run, index) => (
                <button
                  type="button"
                  className="run-row"
                  key={`${run.migrationId}-${run.name}-${index}`}
                  onClick={() => navigate(`/migrations/${run.migrationId}`)}
                >
                  <span className="run-main">
                    <span className="run-name">{run.name}</span>
                    <span className="run-sub">
                      {run.category} ·{' '}
                      {new Date(run.completedAt || run.startedAt).toLocaleString(undefined, {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </span>
                  <MigrationStatusBadge
                    status={run.status}
                    lastMigratedAt={run.completedAt || run.startedAt}
                    successLabel="✓ Success"
                  />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
