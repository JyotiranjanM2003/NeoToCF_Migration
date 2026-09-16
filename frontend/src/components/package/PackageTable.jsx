import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MigrationStatusBadge from './MigrationStatusBadge.jsx';
import EntityIcon from './EntityIcon.jsx';

/**
 * Pure presentation — all selection state and handlers still live in
 * Packages.jsx. This renders them with the shared `.data-table` styling
 * so Packages matches Variables / Data Stores / Number Ranges.
 *
 * Clicking a row opens the package; the checkbox cell stops propagation
 * so selecting never navigates.
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
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th className="col-check">
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                aria-label="Select all visible packages"
              />
            </th>
            <th className="col-narrow" />
            <th>Name</th>
            <th>Mode</th>
            <th>Version</th>
            <th>Description</th>
            <th className="col-status">Status</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((pkg) => {
            const isSelected = selectedIds.has(pkg.id);
            return (
              <tr
                key={pkg.id}
                className={`selectable${isSelected ? ' is-selected' : ''}`}
                onClick={() => navigate(`/packages/${encodeURIComponent(pkg.id)}`)}
                title="Open package"
              >
                <td className="col-check" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(pkg.id)}
                  />
                </td>
                <td className="col-narrow" style={{ color: 'var(--accent)' }}>
                  <EntityIcon type="package" />
                </td>
                <td style={{ fontWeight: 600 }}>{pkg.name}</td>
                <td className="cell-muted">{pkg.mode || '—'}</td>
                <td className="cell-num">{pkg.version || '—'}</td>
                <td className="cell-muted">{pkg.description || '—'}</td>
                <td className="col-status">
                  <MigrationStatusBadge
                    status={pkg.migrationStatus}
                    lastMigratedAt={pkg.lastMigratedAt}
                    showIdle
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
