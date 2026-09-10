import React from 'react';

/**
 * Renders N skeleton rows with M columns of shimmer bars.
 * Reuses the existing `.pulse-line` keyframe from index.css.
 *
 * Props:
 *   rows    – number of skeleton rows to show (default 6)
 *   cols    – number of columns (default 4)
 *   hasCheckbox – prepend a checkbox-width column (default true)
 */
export default function TableSkeleton({ rows = 6, cols = 4, hasCheckbox = true }) {
  const rowArr = Array.from({ length: rows });
  const colArr = Array.from({ length: cols });

  return (
    <>
      {rowArr.map((_, r) => (
        <tr key={r} aria-hidden="true">
          {hasCheckbox && (
            <td style={{ width: 32 }}>
              <div className="skeleton-bar" style={{ width: 14, height: 14, borderRadius: 3 }} />
            </td>
          )}
          {colArr.map((_, c) => (
            <td key={c}>
              <div
                className="skeleton-bar"
                style={{ width: `${55 + ((r * 13 + c * 17) % 35)}%`, height: 13 }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
