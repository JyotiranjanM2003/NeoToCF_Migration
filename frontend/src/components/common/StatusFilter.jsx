import React from 'react';

export const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Not migrated' },
  { key: 'migrated', label: 'Migrated' },
  { key: 'failed', label: 'Failed' },
];

/**
 * Segmented control for filtering a resource list by its migration status.
 * Purely client-side — it filters the rows the page already has.
 */
export default function StatusFilter({ value, onChange }) {
  return (
    <div className="seg" role="group" aria-label="Filter by migration status">
      {STATUS_FILTERS.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className={value === filter.key ? 'active' : ''}
          onClick={() => onChange(filter.key)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

/** Shared predicate so every page filters status identically. */
export function matchesStatusFilter(row, filterKey) {
  const status = row.migrationStatus;
  if (filterKey === 'migrated') return status === 'MIGRATED' || status === 'SUCCESS' || status === 'UPDATED';
  if (filterKey === 'failed') return status === 'FAILED' || status === 'PARTIAL';
  if (filterKey === 'pending') return !status;
  return true;
}
