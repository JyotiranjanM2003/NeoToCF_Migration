import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import TenantConnectForm from '../components/tenant/TenantConnectForm.jsx';
import * as tenantApi from '../services/api/tenant.api';

const FIELDS = [
  { name: 'tenantName', label: 'Tenant name', placeholder: 'Neo Prod', required: false },
  {
    name: 'host',
    label: 'Host',
    mono: true,
    placeholder: 'abc-tmn.hci.eu1.hana.ondemand.com',
    helper: 'The tenant management node host (sourceHost).',
  },
  {
    name: 'tokenHost',
    label: 'Token host',
    mono: true,
    placeholder: 'abc.authentication.eu1.hana.ondemand.com',
    helper: 'OAuth token endpoint host (sourceTokenHost).',
  },
  { name: 'oauthClientId', label: 'OAuth client ID', mono: true },
  { name: 'oauthClientSecret', label: 'OAuth client secret', secret: true },
  { name: 'srcDomain', label: 'Neo account domain (optional)', mono: true, required: false },
  { name: 'srcAccountId', label: 'Neo account ID (optional)', mono: true, required: false },
];

export default function ConnectSourceTenant() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(values) {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await tenantApi.connectSource(values);
      setResult({ ok: res.connectionStatus === 'CONNECTED', message: res.message });
      if (res.connectionStatus === 'CONNECTED') {
        setTimeout(() => navigate('/dashboard'), 900);
      }
    } catch (err) {
      setResult({ ok: false, message: err.response?.data?.message || 'Connection failed' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <h2>Connect source tenant — SAP BTP Neo</h2>
      <p>Credentials are encrypted at rest and used only to fetch packages, iFlows, and configuration for migration.</p>

      {result && (
        <div className={result.ok ? 'helper-text' : 'error-banner'} style={result.ok ? { color: '#0F6E66', marginBottom: 16 } : {}}>
          {result.ok ? 'Connected successfully. Redirecting…' : result.message}
        </div>
      )}

      <div className="card" style={{ maxWidth: 480 }}>
        <TenantConnectForm fields={FIELDS} onSubmit={handleSubmit} submitting={submitting} />
      </div>
    </AppShell>
  );
}
