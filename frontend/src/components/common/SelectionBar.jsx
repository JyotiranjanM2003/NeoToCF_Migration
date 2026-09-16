import React from 'react';

/**
 * Sticky bar that appears only when rows are selected, holding the
 * bulk actions for that list. Keeps the page header free of
 * permanently-disabled "Migrate Selected (0)" buttons.
 *
 * Props:
 *   count      – number of selected rows
 *   onClear    – clears the selection
 *   actionLabel – primary button label
 *   onAction   – primary button handler
 *   disabled   – disables the primary action
 */
export default function SelectionBar({ count, onClear, actionLabel, onAction, disabled }) {
  if (!count) return null;

  return (
    <div className="sel-bar">
      <span className="sel-count">
        {count} selected
      </span>
      <span className="sel-spacer" />
      <button type="button" className="btn" onClick={onClear}>
        Clear
      </button>
      <button type="button" className="btn btn-primary" onClick={onAction} disabled={disabled}>
        {actionLabel}
      </button>
    </div>
  );
}
