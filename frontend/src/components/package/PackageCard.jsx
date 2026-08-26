import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PackageCard({ pkg }) {
  const navigate = useNavigate();
  return (
    <div
      className="card"
      style={{ marginBottom: 12, cursor: 'pointer' }}
      onClick={() => navigate(`/packages/${encodeURIComponent(pkg.id)}`)}
    >
      <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {pkg.name}
        <span className="helper-text mono">{pkg.version}</span>
      </h2>
      {pkg.description && <p style={{ marginBottom: 0 }}>{pkg.description}</p>}
    </div>
  );
}
