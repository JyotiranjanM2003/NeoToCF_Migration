import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import TableSkeleton from '../components/common/TableSkeleton.jsx';
import MigrationStatusBadge from '../components/package/MigrationStatusBadge.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { getCache, setCache, invalidateCache } from '../utils/resourceCache.js';
import * as migrationReportApi from '../services/api/migrationReport.api';

const REPORT_CACHE_KEY = 'migration-report';
const REPORT_CACHE_TTL = 2 * 60 * 1000;

const STATUS_CARDS = [
    { key: 'MIGRATED', label: 'Migrated', className: 'report-stat-success' },
    { key: 'FAILED', label: 'Failed', className: 'report-stat-danger' },
    { key: 'PARTIAL', label: 'Partial', className: 'report-stat-warn' },
    { key: 'RUNNING', label: 'Running', className: 'report-stat-info' },
];

const CATEGORIES = ['All', 'Package', 'Package Artifact', 'Variable', 'Data Store', 'Number Range', 'Security Material'];

export default function MigrationReportPage() {
    const navigate = useNavigate();
    const [report, setReport] = useState(() => getCache(REPORT_CACHE_KEY) ?? null);
    const [loadError, setLoadError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState(null); // null = all
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, 180);

    function load(force = false) {
        if (!force) {
            const cached = getCache(REPORT_CACHE_KEY);
            if (cached) { setReport(cached); return; }
        }
        setRefreshing(true);
        setLoadError('');
        migrationReportApi.getMigrationReport()
            .then((data) => {
                setReport(data);
                setCache(REPORT_CACHE_KEY, data, REPORT_CACHE_TTL);
            })
            .catch((err) => {
                const code = err.response?.data?.code;
                if (code === 'NO_SOURCE_SELECTED' || code === 'NO_TARGET_SELECTED') {
                    setLoadError(err.response.data.message);
                    return;
                }
                setLoadError(err.response?.data?.message || 'Failed to load migration report');
            })
            .finally(() => setRefreshing(false));
    }

    useEffect(() => {
        if (!getCache(REPORT_CACHE_KEY)) load(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredRows = useMemo(() => {
        if (!report) return [];
        return report.rows.filter((row) => {
            if (statusFilter && row.status !== statusFilter) return false;
            if (categoryFilter !== 'All' && row.category !== categoryFilter) return false;
            if (debouncedSearch.trim() && !row.name.toLowerCase().includes(debouncedSearch.trim().toLowerCase())) return false;
            return true;
        });
    }, [report, statusFilter, categoryFilter, debouncedSearch]);

    return (
        <AppShell>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                    <h2 style={{ margin: 0 }}>Migration Report</h2>
                    {report && (
                        <p className="helper-text" style={{ margin: '4px 0 0' }}>
                            <span className="mono">{report.sourceHost}</span> → <span className="mono">{report.targetHost}</span>
                        </p>
                    )}
                </div>
                <button
                    className="btn btn-secondary"
                    style={{ width: 'auto' }}
                    disabled={refreshing}
                    onClick={() => { invalidateCache(REPORT_CACHE_KEY); load(true); }}
                >
                    {refreshing ? '↻ Loading…' : '↻ Refresh'}
                </button>
            </div>

            {loadError && <div className="error-banner">{loadError}</div>}

            {!report && !loadError && (
                <table className="table report-table" style={{ width: '100%' }}>
                    <thead><tr><th>Category</th><th>Name</th><th>Type</th><th>Status</th><th>Last Run</th></tr></thead>
                    <tbody><TableSkeleton rows={6} cols={5} /></tbody>
                </table>
            )}

            {report && (
                <>
                    <div className="report-summary-grid">
                        {STATUS_CARDS.map((card) => (
                            <div
                                key={card.key}
                                className={`report-stat-card ${card.className} ${statusFilter === card.key ? 'active' : ''}`}
                                onClick={() => setStatusFilter(statusFilter === card.key ? null : card.key)}
                            >
                                <div className="report-stat-value">{report.summary[card.key] || 0}</div>
                                <div className="report-stat-label">{card.label}</div>
                            </div>
                        ))}
                        <div
                            className={`report-stat-card ${statusFilter === null ? 'active' : ''}`}
                            onClick={() => setStatusFilter(null)}
                        >
                            <div className="report-stat-value">{report.summary.total}</div>
                            <div className="report-stat-label">Total</div>
                        </div>
                    </div>

                    <div className="report-filter-bar">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                className={`report-chip ${categoryFilter === cat ? 'active' : ''}`}
                                onClick={() => setCategoryFilter(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                        <div style={{ flex: 1 }} />
                        <input
                            className="input"
                            placeholder="Search by name…"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            style={{ width: 220 }}
                        />
                    </div>

                    <div className="card" style={{ padding: 0 }}>
                        {filteredRows.length === 0 ? (
                            <div className="empty-state">No migrations match these filters.</div>
                        ) : (
                            <table className="table report-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>Category</th>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th>Last Run</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((row, index) => (
                                        <tr
                                            key={`${row.migrationId}-${row.category}-${row.name}-${index}`}
                                            className="report-row"
                                            onClick={() => navigate(`/migrations/${row.migrationId}`)}
                                        >
                                            <td>{row.category}</td>
                                            <td className="mono">{row.name}</td>
                                            <td>{row.type}</td>
                                            <td>
                                                <MigrationStatusBadge status={row.status} lastMigratedAt={row.completedAt || row.startedAt} successLabel="✓ Migrated" />
                                            </td>
                                            <td style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                                                {row.completedAt || row.startedAt ? new Date(row.completedAt || row.startedAt).toLocaleString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </AppShell>
    );
}