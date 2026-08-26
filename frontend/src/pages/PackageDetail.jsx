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
  const [busy, setBusy] = useState(null); // 'validate' | 'download' | 'migrate' | 'migrate-selected' | null
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    packageApi
      .listArtifacts(packageId)
      .then((data) => setArtifacts(data.artifacts))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load artifacts'));
  }, [packageId]);

  function toggleSelect(artifactId, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(artifactId);
      else next.delete(artifactId);
      return next;
    });
  }

  function selectAllArtifacts() {
    setSelectedIds(new Set((artifacts || []).map((a) => a.id)));
  }

  function clearArtifactSelection() {
    setSelectedIds(new Set());
  }

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

  async function handleMigrateSelectedArtifacts() {
    setBusy('migrate-selected');
    try {
      const { migrationId } = await migrationApi.startMigration({
        packageId,
        artifactIds: Array.from(selectedIds),
      });
      navigate(`/migrations/${migrationId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start migration for the selected artifacts');
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <h2 style={{ marginBottom: 4 }}>{packageId}</h2>
      <p>Artifacts inside this package. Select one to view its configuration, select several to migrate just those, or act on the whole package below.</p>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
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

      {artifacts?.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div className="helper-text">
            {selectedIds.size === 0
              ? 'Select one or more artifacts below to migrate just those.'
              : `${selectedIds.size} artifact${selectedIds.size === 1 ? '' : 's'} selected`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={selectAllArtifacts} disabled={busy !== null}>
              Select all
            </button>
            <button
              className="btn btn-secondary"
              onClick={clearArtifactSelection}
              disabled={busy !== null || selectedIds.size === 0}
            >
              Clear
            </button>
            <button
              className="btn btn-primary"
              style={{ width: 'auto' }}
              onClick={handleMigrateSelectedArtifacts}
              disabled={busy !== null || selectedIds.size === 0}
            >
              {busy === 'migrate-selected' ? 'Starting…' : `Migrate selected (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {artifacts && (
        <ArtifactList
          artifacts={artifacts}
          packageId={packageId}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      )}
    </AppShell>
  );
}