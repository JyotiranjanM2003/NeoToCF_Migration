import React from 'react';

const BASE_CONFIG = {
  SUCCESS:  { className: 'badge-connected',    label: 'Migrated' },
  MIGRATED: { className: 'badge-connected',    label: 'Migrated' },
  UPDATED:  { className: 'badge-connected',    label: 'Migrated' },
  PARTIAL:  { className: 'badge-error',        label: 'Partial' },
  FAILED:   { className: 'badge-error',        label: 'Failed' },
  RUNNING:  { className: 'badge-disconnected', label: 'Migrating…' },
};

const SUCCESS_STATUSES = ['SUCCESS', 'MIGRATED', 'UPDATED'];

/**
 * Migration status pill shown in every resource list.
 *
 * Props:
 *   status         – SUCCESS / MIGRATED / UPDATED / PARTIAL / FAILED / RUNNING / null
 *   lastMigratedAt – ISO timestamp shown in the tooltip
 *   successLabel   – optional override for the migrated label text
 *   showIdle       – when true, renders a neutral "Not migrated" pill instead of
 *                    nothing for rows that have never been migrated. Lists pass
 *                    this so the Status column is never visually empty; inline
 *                    usages (e.g. package cards) can leave it off.
 */
export default function MigrationStatusBadge({ status, lastMigratedAt, successLabel, showIdle = false }) {
  if (!status) {
    if (!showIdle) return null;
    return (
      <span className="badge badge-disconnected" title="Not migrated to the selected target tenant yet">
        <span className="dot" />
        Not migrated
      </span>
    );
  }

  const base = BASE_CONFIG[status] || { className: 'badge-disconnected', label: status };
  const label = successLabel && SUCCESS_STATUSES.includes(status) ? successLabel : base.label;

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
