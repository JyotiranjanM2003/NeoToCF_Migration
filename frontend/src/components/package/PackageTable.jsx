import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MigrationStatusBadge from './MigrationStatusBadge.jsx';
import EntityIcon from './EntityIcon.jsx';

/**
 * Pure presentation — all selection state and handlers (toggleSelect,
 * selectAll, deselectAll, handleMigrateSelected) still live in Packages.jsx
 * exactly as before. This component only renders them as a table instead
 * of a stack of cards, and adds a header checkbox that calls the same
 * select-all/deselect-all toggle already defined there.
 */
export default function PackageTable({ packages, selectedIds, onToggleSelect, onToggleSelectAll }) {
  const navigate = useNavigate();
  const headerCheckboxRef = useRef(null);

  const allSelected = packages.length > 0 && packages.every((p) => selectedIds.has(p.id));
  const someSelected = packages.some((p) => selectedIds.has(p.id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  return (
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface-sunken)' }}>
                        <th style={{ ...thStyle, width: 36 }}>
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                style={checkboxStyle}
              />
            </th>
            <th style={{ ...thStyle, width: 48 }} />
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Mode</th>
            <th style={thStyle}>Version</th>
            <th style={thStyle}>Description</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((pkg) => (
            <tr
              key={pkg.id}
              onClick={() => navigate(`/packages/${encodeURIComponent(pkg.id)}`)}
              style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
            >
                            <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(pkg.id)}
                  onChange={() => onToggleSelect(pkg.id)}
                  style={checkboxStyle}
                />
              </td>
              <td style={tdStyle}>
                <EntityIcon type="package" />
              </td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  {pkg.name}
                  <MigrationStatusBadge status={pkg.migrationStatus} lastMigratedAt={pkg.lastMigratedAt} />
                </div>
              </td>
              <td style={{ ...tdStyle, color: 'var(--ink-muted)' }}>{pkg.mode || '—'}</td>
              <td style={tdStyle} className="mono">
                {pkg.version}
              </td>
              <td style={{ ...tdStyle, color: 'var(--ink-muted)' }}>{pkg.description || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--ink-muted)',
};

const tdStyle = { padding: '12px 16px', verticalAlign: 'top' };

const checkboxStyle = { width: 15, height: 15, cursor: 'pointer' };