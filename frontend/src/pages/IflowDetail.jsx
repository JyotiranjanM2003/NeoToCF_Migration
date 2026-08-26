import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import ConfigTable from '../components/iflow/ConfigTable.jsx';
import ValidationChecklist from '../components/iflow/ValidationChecklist.jsx';
import ArtifactTypeBadge from '../components/package/ArtifactTypeBadge.jsx';
import * as iflowApi from '../services/api/iflow.api';
import * as validationApi from '../services/api/validation.api';
import * as migrationApi from '../services/api/migration.api';
import { saveBlob } from '../utils/downloadFile';

export default function IflowDetail() {
  const { packageId, id } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    iflowApi
      .getIflowDetail(id, packageId)
      .then(setDetail)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load artifact'));
  }, [id, packageId]);

  async function handleValidate() {
    setBusy('validate');
    try {
      const result = await validationApi.runValidation({ packageId, artifactId: id });
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
      const blob = await iflowApi.downloadIflow(id);
      saveBlob(blob, `${id}.zip`);
    } catch (err) {
      setError(err.response?.data?.message || 'Download failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleMigrate() {
    setBusy('migrate');
    try {
      const { migrationId } = await migrationApi.startMigration({ packageId, artifactId: id });
      navigate(`/migrations/${migrationId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start migration');
      setBusy(null);
    }
  }

  if (error) {
    return (
      <AppShell>
        <div className="error-banner">{error}</div>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell>
        <div className="empty-state">Loading iFlow detail…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {detail.name}
          <ArtifactTypeBadge type={detail.type} />
        </h2>
        <dl style={dlStyle}>
          <dt>Version</dt>
          <dd className="mono">{detail.version}</dd>
          <dt>Status</dt>
          <dd>
            <span className={`badge ${detail.status === 'Active' ? 'badge-connected' : 'badge-disconnected'}`}>
              <span className="dot" />
              {detail.status}
            </span>
          </dd>
          <dt>Package</dt>
          <dd>{detail.package}</dd>
        </dl>
      </div>

      <h3 style={{ marginBottom: 10 }}>Configuration</h3>
      <div style={{ marginBottom: 20 }}>
        <ConfigTable configuration={detail.configuration} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className="btn btn-secondary" onClick={handleValidate} disabled={busy !== null}>
          {busy === 'validate' ? 'Validating…' : 'Validate'}
        </button>
        <button className="btn btn-secondary" onClick={handleDownload} disabled={busy !== null}>
          {busy === 'download' ? 'Downloading…' : 'Download'}
        </button>
        <button
          className="btn btn-primary"
          style={{ width: 'auto' }}
          onClick={handleMigrate}
          disabled={busy !== null || (validation && validation.result !== 'READY')}
        >
          {busy === 'migrate' ? 'Starting…' : 'Migrate'}
        </button>
      </div>

      <ValidationChecklist validation={validation} />
    </AppShell>
  );
}

const dlStyle = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  rowGap: 8,
  fontSize: 13,
  margin: '16px 0 0',
};
