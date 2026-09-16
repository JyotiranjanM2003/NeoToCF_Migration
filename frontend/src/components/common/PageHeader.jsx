import React from 'react';

/**
 * Standard page header used by every resource screen.
 *
 * Props:
 *   title    – page title text
 *   count    – optional number rendered as a pill next to the title
 *   subtitle – optional line under the title
 *   backTo   – optional { label, onClick } rendered above the title
 *   children – right-hand action buttons
 */
export default function PageHeader({ title, count, subtitle, back, children }) {
  return (
    <div className="page-head">
      <div className="page-head-main">
        {back}
        <h2>
          {title}
          {typeof count === 'number' && <span className="count-pill">{count}</span>}
        </h2>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}
