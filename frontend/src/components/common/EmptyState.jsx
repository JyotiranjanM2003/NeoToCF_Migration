import React from 'react';

/**
 * Consistent empty state for every list screen.
 *
 * Props:
 *   title    – short headline
 *   message  – one or two lines of explanation
 *   icon     – optional node rendered in the icon square
 *   action   – optional button node (e.g. "Clear filters")
 */
export default function EmptyState({ title, message, icon, action }) {
  return (
    <div className="empty-block">
      <div className="empty-icon">
        {icon || (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="4" width="14" height="12" rx="2" />
            <path d="M3 8h14" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <h4>{title}</h4>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
