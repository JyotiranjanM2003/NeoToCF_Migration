// // import React from 'react';
// // import { useNavigate } from 'react-router-dom';

// // export default function PackageCard({ pkg }) {
// //   const navigate = useNavigate();
// //   return (
// //     <div
// //       className="card"
// //       style={{ marginBottom: 12, cursor: 'pointer' }}
// //       onClick={() => navigate(`/packages/${encodeURIComponent(pkg.id)}`)}
// //     >
// //       <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
// //         {pkg.name}
// //         <span className="helper-text mono">{pkg.version}</span>
// //       </h2>
// //       {pkg.description && <p style={{ marginBottom: 0 }}>{pkg.description}</p>}
// //     </div>
// //   );
// // }


// import React from 'react';
// import { useNavigate } from 'react-router-dom';

// /**
//  * `selected` / `onToggleSelect` are optional — when omitted, no checkbox
//  * renders and clicking the card just navigates, same as before. Passing
//  * them (from the Packages page's selection state) turns on the checkbox.
//  */
// export default function PackageCard({ pkg, selected, onToggleSelect }) {
//   const navigate = useNavigate();
//   const selectable = typeof onToggleSelect === 'function';

//   function handleCardClick() {
//     navigate(`/packages/${encodeURIComponent(pkg.id)}`);
//   }

//   function handleCheckboxClick(e) {
//     e.stopPropagation(); // don't also trigger the card's navigate
//     onToggleSelect(pkg.id);
//   }

//   return (
//     <div
//       className="card"
//       style={{
//         marginBottom: 12,
//         cursor: 'pointer',
//         display: 'flex',
//         alignItems: 'flex-start',
//         gap: 12,
//         border: selected ? '1px solid var(--accent)' : undefined,
//       }}
//       onClick={handleCardClick}
//     >
//       {selectable && (
//         <input
//           type="checkbox"
//           checked={!!selected}
//           onClick={handleCheckboxClick}
//           onChange={() => {}}
//           style={{ marginTop: 4, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
//         />
//       )}
//       <div style={{ flex: 1 }}>
//         <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//           {pkg.name}
//           <span className="helper-text mono">{pkg.version}</span>
//         </h2>
//         {pkg.description && <p style={{ marginBottom: 0 }}>{pkg.description}</p>}
//       </div>
//     </div>
//   );
// }
import React from 'react';
import { useNavigate } from 'react-router-dom';
import MigrationStatusBadge from './MigrationStatusBadge.jsx';

/**
 * `selected` / `onToggleSelect` are optional — when omitted, no checkbox
 * renders and clicking the card just navigates. Passing them (from the
 * Packages page's selection state, if you have that feature) turns on the
 * checkbox; if you don't have multi-select, this still works fine with
 * both left undefined.
 */
export default function PackageCard({ pkg, selected, onToggleSelect }) {
  const navigate = useNavigate();
  const selectable = typeof onToggleSelect === 'function';

  function handleCardClick() {
    navigate(`/packages/${encodeURIComponent(pkg.id)}`);
  }

  function handleCheckboxClick(e) {
    e.stopPropagation();
    onToggleSelect(pkg.id);
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        border: selected ? '1px solid var(--accent)' : undefined,
      }}
      onClick={handleCardClick}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={!!selected}
          onClick={handleCheckboxClick}
          onChange={() => {}}
          style={{ marginTop: 4, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1 }}>
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {pkg.name}
            <MigrationStatusBadge status={pkg.migrationStatus} lastMigratedAt={pkg.lastMigratedAt} />
          </span>
          <span className="helper-text mono">{pkg.version}</span>
        </h2>
        {pkg.description && <p style={{ marginBottom: 0 }}>{pkg.description}</p>}
      </div>
    </div>
  );
}