// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import AppShell from '../components/layout/AppShell.jsx';
// import TenantConnectForm from '../components/tenant/TenantConnectForm.jsx';
// import * as tenantApi from '../services/api/tenant.api';

// const FIELDS = [
//   { name: 'tenantName', label: 'Tenant name', placeholder: 'CF Prod', required: false },
//   {
//     name: 'host',
//     label: 'Host',
//     mono: true,
//     placeholder: 'abc-tmn.cfapps.eu10.hana.ondemand.com',
//     helper: 'The tenant management node host (targetHost).',
//   },
//   {
//     name: 'tokenHost',
//     label: 'Token host',
//     mono: true,
//     placeholder: 'abc.authentication.eu10.hana.ondemand.com',
//     helper: 'OAuth token endpoint host (targetTokenHost).',
//   },
//   { name: 'oauthClientId', label: 'OAuth client ID', mono: true },
//   { name: 'oauthClientSecret', label: 'OAuth client secret', secret: true },
//   { name: 'tgtDomain', label: 'CF domain (optional)', mono: true, required: false, placeholder: 'cf.eu10.hana.ondemand.com' },
//   { name: 'cfOrgId', label: 'CF org ID (optional)', mono: true, required: false },
//   { name: 'spaceName', label: 'CF space name (optional)', mono: true, required: false },
// ];

// export default function ConnectTargetTenant() {
//   const navigate = useNavigate();
//   const [submitting, setSubmitting] = useState(false);
//   const [result, setResult] = useState(null);

//   async function handleSubmit(values) {
//     setSubmitting(true);
//     setResult(null);
//     try {
//       const res = await tenantApi.connectTarget(values);
//       setResult({ ok: res.connectionStatus === 'CONNECTED', message: res.message });
//       if (res.connectionStatus === 'CONNECTED') {
//         setTimeout(() => navigate('/dashboard'), 900);
//       }
//     } catch (err) {
//       setResult({ ok: false, message: err.response?.data?.message || 'Connection failed' });
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   return (
//     <AppShell>
//       <h2>Connect target tenant — SAP BTP Cloud Foundry</h2>
//       <p>Credentials are encrypted at rest and used only to upload packages, iFlows, and configuration during migration.</p>

//       {result && (
//         <div className={result.ok ? 'helper-text' : 'error-banner'} style={result.ok ? { color: '#0F6E66', marginBottom: 16 } : {}}>
//           {result.ok ? 'Connected successfully. Redirecting…' : result.message}
//         </div>
//       )}

//       <div className="card" style={{ maxWidth: 480 }}>
//         <TenantConnectForm fields={FIELDS} onSubmit={handleSubmit} submitting={submitting} />
//       </div>
//     </AppShell>
//   );
// }



import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import TenantConnectForm from '../components/tenant/TenantConnectForm.jsx';
import * as tenantApi from '../services/api/tenant.api';

const FIELDS = [
  { name: 'tenantName', label: 'Tenant name', placeholder: 'CF Prod', required: false },
  {
    name: 'host',
    label: 'Host',
    mono: true,
    placeholder: 'abc-tmn.cfapps.eu10.hana.ondemand.com',
    helper: 'The tenant management node host (targetHost).',
  },
  {
    name: 'tokenHost',
    label: 'Token host',
    mono: true,
    placeholder: 'abc.authentication.eu10.hana.ondemand.com',
    helper: 'OAuth token endpoint host (targetTokenHost).',
  },
  { name: 'oauthClientId', label: 'OAuth client ID', mono: true },
  { name: 'oauthClientSecret', label: 'OAuth client secret', secret: true },
  { name: 'tgtDomain', label: 'CF domain (optional)', mono: true, required: false, placeholder: 'cf.eu10.hana.ondemand.com' },
  { name: 'cfOrgId', label: 'CF org ID (optional)', mono: true, required: false },
  { name: 'spaceName', label: 'CF space name (optional)', mono: true, required: false },
];

export default function ConnectTargetTenant() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [initialValues, setInitialValues] = useState(isEditing ? null : {});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isEditing) return;
    tenantApi
      .getTargetTenant(id)
      .then((t) => {
        setInitialValues({
          tenantName: t.tenantName || '',
          host: t.host || '',
          tokenHost: t.tokenHost || '',
          oauthClientId: t.oauthClientId || '',
          oauthClientSecret: '',
          tgtDomain: t.tgtDomain || '',
          cfOrgId: t.cfOrgId || '',
          spaceName: t.spaceName || '',
        });
      })
      .catch((err) => setLoadError(err.response?.data?.message || 'Failed to load tenant'));
  }, [id, isEditing]);

  async function handleSubmit(values) {
    setSubmitting(true);
    setResult(null);
    try {
      const res = isEditing
        ? await tenantApi.updateTargetTenant(id, values)
        : await tenantApi.createTargetTenant(values);
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
      <h2>{isEditing ? 'Reconfigure target tenant' : 'Add target tenant'} — SAP BTP Cloud Foundry</h2>
      <p>Credentials are encrypted at rest and used only to upload packages, iFlows, and configuration during migration.</p>

      {loadError && <div className="error-banner">{loadError}</div>}

      {result && (
        <div className={result.ok ? 'helper-text' : 'error-banner'} style={result.ok ? { color: '#0F6E66', marginBottom: 16 } : {}}>
          {result.ok ? 'Connected successfully. Redirecting…' : result.message}
        </div>
      )}

      {initialValues && (
        <div className="card" style={{ maxWidth: 480 }}>
          <TenantConnectForm fields={FIELDS} initialValues={initialValues} onSubmit={handleSubmit} submitting={submitting} />
        </div>
      )}
    </AppShell>
  );
}