// import React, { useEffect, useState } from 'react';
// import { Link } from 'react-router-dom';
// import AppShell from '../components/layout/AppShell.jsx';
// import PackageCard from '../components/package/PackageCard.jsx';
// import * as packageApi from '../services/api/package.api';

// export default function Packages() {
//   const [packages, setPackages] = useState(null);
//   const [error, setError] = useState('');

//   useEffect(() => {
//     packageApi
//       .listPackages()
//       .then((data) => setPackages(data.packages))
//       .catch((err) => setError(err.response?.data?.message || 'Failed to load packages'));
//   }, []);

//   return (
//     <AppShell>
//       <h2 style={{ marginBottom: 16 }}>Packages</h2>

//       {error && (
//         <div className="error-banner">
//           {error}{' '}
//           <Link to="/dashboard" style={{ color: 'inherit', textDecoration: 'underline' }}>
//             Go connect your tenants
//           </Link>
//         </div>
//       )}

//       {!error && !packages && <div className="empty-state">Loading packages from source tenant…</div>}

//       {packages?.length === 0 && <div className="empty-state">No packages found on the source tenant.</div>}

//       {packages?.map((pkg) => (
//         <PackageCard key={pkg.id} pkg={pkg} />
//       ))}
//     </AppShell>
//   );
// }


import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import PackageCard from '../components/package/PackageCard.jsx';
import * as packageApi from '../services/api/package.api';
import * as migrationApi from '../services/api/migration.api';
import MigrationStatusBadge from '../components/package/MigrationStatusBadge.jsx';

export default function Packages() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState(null);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [starting, setStarting] = useState(false);
  const [activeBatch, setActiveBatch] = useState(null);
const [migrationInfo, setMigrationInfo] = useState(null); // { status, lastMigratedAt } | null

  useEffect(() => {
    packageApi
      .listPackages()
      .then((data) => setPackages(data.packages))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load packages'));

    // Resume support: if a batch migration is still running from an earlier
    // session, offer to jump straight to its report instead of starting over.
    migrationApi
      .getActiveBatch()
      .then((data) => setActiveBatch(data.batch))
      .catch(() => {}); // non-fatal — just means no "continue" banner
  }, []);

  function toggleSelect(packageId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(packageId)) next.delete(packageId);
      else next.add(packageId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set((packages || []).map((p) => p.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleMigrateSelected() {
    setStarting(true);
    setError('');
    try {
      const { batchId } = await migrationApi.startBatchMigration(Array.from(selectedIds));
      navigate(`/migrations/batch/${batchId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start migration');
      setStarting(false);
    }
  }

  const selectedCount = selectedIds.size;
  const alreadyMigratedCount = (packages || []).filter((p) => p.migrationStatus === 'SUCCESS').length;
  return (
    <AppShell>
      <h2 style={{ marginBottom: 16 }}>Packages</h2>

      {activeBatch && (
        <div
          className="card"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            borderColor: 'var(--accent)',
          }}
        >
          <div>
            <strong>A migration is still running.</strong>
            <div className="helper-text">Started {new Date(activeBatch.STARTEDAT).toLocaleString()}</div>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: 'auto' }}
            onClick={() => navigate(`/migrations/batch/${activeBatch.BATCHID}`)}
          >
            Continue watching migration
          </button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          {error}{' '}
          <Link to="/dashboard" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Go connect your tenants
          </Link>
        </div>
      )}

      {!error && !packages && <div className="empty-state">Loading packages from source tenant…</div>}

      {packages?.length === 0 && <div className="empty-state">No packages found on the source tenant.</div>}

      {/* {packages && packages.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <button className="btn btn-secondary" onClick={selectAll}>
            Select all
          </button>
          <button className="btn btn-secondary" onClick={deselectAll} disabled={selectedCount === 0}>
            Deselect all
          </button>
          {selectedCount > 0 && (
            <span className="badge badge-connected">
              <span className="dot" />
              {selectedCount} selected
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-primary"
            style={{ width: 'auto' }}
            onClick={handleMigrateSelected}
            disabled={selectedCount === 0 || starting}
          >
            {starting ? 'Starting…' : `Migrate selected packages (${selectedCount})`}
          </button>
        </div>
      )} */}
        {packages && packages.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <button className="btn btn-secondary" onClick={selectAll}>
            Select all
          </button>
          <button className="btn btn-secondary" onClick={deselectAll} disabled={selectedCount === 0}>
            Deselect all
          </button>
          {selectedCount > 0 && (
            <span className="badge badge-connected">
              <span className="dot" />
              {selectedCount} selected
            </span>
          )}
          {alreadyMigratedCount > 0 && (
            <span className="helper-text">
              {alreadyMigratedCount} of {packages.length} already migrated
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-primary"
            style={{ width: 'auto' }}
            onClick={handleMigrateSelected}
            disabled={selectedCount === 0 || starting}
          >
            {starting ? 'Starting…' : `Migrate selected packages (${selectedCount})`}
          </button>
        </div>
      )}

      {packages?.map((pkg) => (
        <PackageCard key={pkg.id} pkg={pkg} selected={selectedIds.has(pkg.id)} onToggleSelect={toggleSelect} />
      ))}
    </AppShell>
  );
}