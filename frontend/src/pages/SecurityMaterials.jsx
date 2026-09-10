import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell.jsx';
import TableSkeleton from '../components/common/TableSkeleton.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { getCache, setCache } from '../utils/resourceCache.js';
import * as numberRangeApi from '../services/api/numberRange.api';

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

  async function migrate(names) {
    setMigrating(true);
    setMigrationError('');
    setResults([]);
    try {
      const response = await numberRangeApi.migrateNumberRanges(names);
      setResults(response.results || []);
    } catch (err) {
      setMigrationError(err.response?.data?.message || 'Failed to migrate Number Ranges');
    } finally {
      setMigrating(false);
    }
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
            <thead><tr><th /><th>Name</th><th>Description</th><th>Current Value</th><th>Min Value</th><th>Max Value</th><th>Rotate</th><th>Field Length</th></tr></thead>
            <tbody><TableSkeleton rows={5} cols={7} hasCheckbox /></tbody>
          </table>
        )}
        {numberRanges !== null && visibleRanges.length === 0 && <div className="empty-state">No Number Ranges found{search ? ' matching filter' : ' on source tenant'}.</div>}
        {visibleRanges.length > 0 && (
          <div className="number-range-table-wrap"><table className="table number-range-table"><colgroup>
            <col className="number-range-select-column" /><col className="number-range-name-column" /><col className="number-range-description-column" />
            <col className="number-range-value-column" /><col className="number-range-value-column" /><col className="number-range-value-column" />
            <col className="number-range-rotate-column" /><col className="number-range-length-column" />
          </colgroup><thead><tr>
            <th><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} /></th><th>Name</th><th>Description</th><th>Current Value</th><th>Min Value</th><th>Max Value</th><th>Rotate</th><th>Field Length</th>
          </tr></thead><tbody>{visibleRanges.map((range) => <tr key={range.name} onClick={() => toggle(range.name)} style={{ cursor: 'pointer', background: selected.has(range.name) ? 'var(--surface-sunken)' : undefined }}>
            <td onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.has(range.name)} onChange={() => toggle(range.name)} /></td><td className="mono">{range.name}</td><td>{range.description || '—'}</td><td>{range.currentValue || '—'}</td><td>{range.minValue || '—'}</td><td>{range.maxValue || '—'}</td><td>{range.rotate === '' ? '—' : String(range.rotate)}</td><td>{range.fieldLength || '—'}</td>
          </tr>)}</tbody></table></div>
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
