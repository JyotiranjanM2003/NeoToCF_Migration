import React from 'react';

const CONFIG = {
  CONNECTED: { className: 'badge-connected', label: 'Connected' },
  DISCONNECTED: { className: 'badge-disconnected', label: 'Disconnected' },
  ERROR: { className: 'badge-error', label: 'Error' },
};

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.DISCONNECTED;
  return (
    <span className={`badge ${cfg.className}`}>
      <span className="dot" />
      {cfg.label}
    </span>
  );
}
