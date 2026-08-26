import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import PackageCard from '../components/package/PackageCard.jsx';
import * as packageApi from '../services/api/package.api';

export default function Packages() {
  const [packages, setPackages] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    packageApi
      .listPackages()
      .then((data) => setPackages(data.packages))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load packages'));
  }, []);

  return (
    <AppShell>
      <h2 style={{ marginBottom: 16 }}>Packages</h2>

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

      {packages?.map((pkg) => (
        <PackageCard key={pkg.id} pkg={pkg} />
      ))}
    </AppShell>
  );
}
