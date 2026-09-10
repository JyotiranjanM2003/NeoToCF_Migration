import React from 'react';

const BASE_CONFIG = {
  SUCCESS: { className: 'badge-connected', label: 'Already migrated' },
  UPDATED: { className: 'badge-connected', label: 'Already migrated' },
  PARTIAL: { className: 'badge-error', label: 'Partially migrated' },
  FAILED:  { className: 'badge-error',  label: 'Migration failed' },
  RUNNING: { className: 'badge-disconnected', label: 'Migrating…' },
};

/**
 * Renders nothing when the resource has never been migrated (status is null).
 *
 * Props:
 *   status        – one of SUCCESS / UPDATED / PARTIAL / FAILED / RUNNING / null
 *   lastMigratedAt – ISO timestamp shown in the title tooltip
 *   successLabel   – optional override for the SUCCESS/UPDATED label text
 *                    (Packages shows "Already migrated"; Variables shows "✓ Migrated")
 */
export default function MigrationStatusBadge({ status, lastMigratedAt, successLabel }) {
  if (!status) return null;

  const base = BASE_CONFIG[status] || { className: 'badge-disconnected', label: status };

  const label =
    successLabel && (status === 'SUCCESS' || status === 'UPDATED') ? successLabel : base.label;

  return (
    <span
      className={`badge ${base.className}`}
      title={lastMigratedAt ? `Last run ${new Date(lastMigratedAt).toLocaleString()}` : undefined}
    >
      <span className="dot" />
      {label}
    </span>
  );
}
