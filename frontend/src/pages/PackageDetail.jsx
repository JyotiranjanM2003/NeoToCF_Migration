import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import ArtifactList from '../components/package/ArtifactList.jsx';
import ValidationChecklist from '../components/iflow/ValidationChecklist.jsx';
import * as packageApi from '../services/api/package.api';
import * as validationApi from '../services/api/validation.api';
import * as migrationApi from '../services/api/migration.api';
import { saveBlob } from '../utils/downloadFile';

export default function PackageDetail() {
  const { packageId } = useParams();
  const navigate = useNavigate();

  const [artifacts, setArtifacts] = useState(null);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState(null);
  const [busy, setBusy] = useState(null); // 'validate' | 'download' | 'migrate' | null

  useEffect(() => {
    packageApi
      .listArtifacts(packageId)
      .then((data) => setArtifacts(data.artifacts))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load artifacts'));
  }, [packageId]);

  async function handleValidate() {
    setBusy('validate');
    try {
      const result = await validationApi.runValidation({ packageId });
      setValidation(result);
    } catch (err) {
      setError(err.response?.data?.message || 'Validation failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    setBusy('download');
    try {
      const blob = await packageApi.downloadPackage(packageId);
      saveBlob(blob, `${packageId}.zip`);
    } catch (err) {
      setError(err.response?.data?.message || 'Download failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleMigrate() {
    setBusy('migrate');
    try {
      const { migrationId } = await migrationApi.startMigration({ packageId });
      navigate(`/migrations/${migrationId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start migration');
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <h2 style={{ marginBottom: 4 }}>{packageId}</h2>
      <p>Artifacts inside this package. Select one to view its configuration, or act on the whole package below.</p>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className="btn btn-secondary" onClick={handleValidate} disabled={busy !== null}>
          {busy === 'validate' ? 'Validating…' : 'Validate package'}
        </button>
        <button className="btn btn-secondary" onClick={handleDownload} disabled={busy !== null}>
          {busy === 'download' ? 'Downloading…' : 'Download package (.zip)'}
        </button>
        <button
          className="btn btn-primary"
          style={{ width: 'auto' }}
          onClick={handleMigrate}
          disabled={busy !== null || (validation && validation.result !== 'READY')}
        >
          {busy === 'migrate' ? 'Starting…' : 'Migrate whole package'}
        </button>
      </div>

      <ValidationChecklist validation={validation} />

      {!artifacts && !error && <div className="empty-state">Loading artifacts…</div>}
      {artifacts && <ArtifactList artifacts={artifacts} packageId={packageId} />}
    </AppShell>
  );
}
