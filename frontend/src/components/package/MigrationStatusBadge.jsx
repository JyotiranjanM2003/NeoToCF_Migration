import React from 'react';

const CONFIG = {
  SUCCESS: { className: 'badge-connected', label: 'Already migrated' },
  UPDATED: { className: 'badge-connected', label: 'Already migrated' },
  PARTIAL: { className: 'badge-error', label: 'Partially migrated' },
  FAILED: { className: 'badge-error', label: 'Migration failed' },
  RUNNING: { className: 'badge-disconnected', label: 'Migrating…' },
};

/** Renders nothing when the package has never been migrated (status is null). */
export default function MigrationStatusBadge({ status, lastMigratedAt }) {
  if (!status) return null;
  const cfg = CONFIG[status] || { className: 'badge-disconnected', label: status };

  return (
    <span
      className={`badge ${cfg.className}`}
      title={lastMigratedAt ? `Last run ${new Date(lastMigratedAt).toLocaleString()}` : undefined}
    >
      <span className="dot" />
      {cfg.label}
    </span>
  );
}