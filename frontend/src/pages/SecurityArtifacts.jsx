import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import MigrationStatusBadge from '../components/package/MigrationStatusBadge.jsx';
import * as securityApi from '../services/api/securityMigration.api';
import { CategoryIcon } from '../components/security/SecurityIcons.jsx';
import { getCache, setCache, invalidateCache } from '../utils/resourceCache.js';

const CATEGORIES_CACHE_KEY = 'security:categories';
const CATEGORIES_CACHE_TTL = 15 * 60 * 1000; // 5 min

export const SECURITY_ALIAS_STORAGE_KEY = 'securityTargetCertAlias';

export default function SecurityArtifacts() {
  const navigate = useNavigate();
  const [alias, setAlias] = useState(() => sessionStorage.getItem(SECURITY_ALIAS_STORAGE_KEY) || '');
  const [verifiedAlias, setVerifiedAlias] = useState(
    () => sessionStorage.getItem(SECURITY_ALIAS_STORAGE_KEY) || ''
  );
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [categories, setCategories] = useState(() => getCache(CATEGORIES_CACHE_KEY));
  const [categoriesError, setCategoriesError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (verifiedAlias && !getCache(CATEGORIES_CACHE_KEY)) loadCategories(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedAlias]);

  function loadCategories(force) {
    if (!force) {
      const cached = getCache(CATEGORIES_CACHE_KEY);
      if (cached) { setCategories(cached); return; }
    }
    setRefreshing(true);
    setCategoriesError('');
    securityApi
      .listCategories()
      .then((data) => {
        setCategories(data.categories);
        setCache(CATEGORIES_CACHE_KEY, data.categories, CATEGORIES_CACHE_TTL);
      })
      .catch((err) => {
        const code = err.response?.data?.code;
        if (code === 'NO_SOURCE_SELECTED') {
          setCategoriesError(err.response.data.message);
          return;
        }
        setCategoriesError(err.response?.data?.message || 'Failed to load Security Artifacts');
      })
      .finally(() => setRefreshing(false));
  }

  async function handleVerify(event) {
    event.preventDefault();
    if (!alias.trim()) {
      setVerifyError('Enter a target certificate alias');
      return;
    }
    setVerifying(true);
    setVerifyError('');
    try {
      const result = await securityApi.verifyTargetCertificateAlias(alias.trim());
      if (!result.valid) {
        setVerifyError(result.message || 'Certificate alias could not be verified on the target tenant');
        return;
      }
      sessionStorage.setItem(SECURITY_ALIAS_STORAGE_KEY, alias.trim());
      setVerifiedAlias(alias.trim());
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'NO_TARGET_SELECTED') {
        setVerifyError(err.response.data.message);
        return;
      }
      setVerifyError(err.response?.data?.message || 'Failed to verify certificate alias');
    } finally {
      setVerifying(false);
    }
  }

  function handleChangeAlias() {
    sessionStorage.removeItem(SECURITY_ALIAS_STORAGE_KEY);
    invalidateCache(CATEGORIES_CACHE_KEY);
    setVerifiedAlias('');
    setCategories(null);
  }

  // ── Gate: target certificate alias ──────────────────────────────────────
  if (!verifiedAlias) {
    return (
      <AppShell>
        <PageHeader
          title="Security Artifacts"
          subtitle="Unlock security content transport by verifying the target certificate."
        />

        <div className="panel" style={{ maxWidth: 520 }}>
          <div className="panel-head">
            <h3 className="panel-title">Target Certificate Alias</h3>
          </div>
          <div className="panel-body">
            <p className="helper-text" style={{ marginTop: 0, lineHeight: 1.6 }}>
              SAP encrypts Security Content transports with a certificate held in the target
              tenant&apos;s Keystore. Enter that certificate&apos;s alias — this is the same{' '}
              <span className="mono">targetCertificateAlias</span> variable used by the
              &quot;CPI MIG090 Security Artifacts&quot; Postman collection.
            </p>

            <form onSubmit={handleVerify}>
              <div className="field" style={{ marginBottom: 12 }}>
                <label htmlFor="cert-alias">Certificate alias</label>
                <input
                  id="cert-alias"
                  className="input"
                  placeholder="e.g. subject-alternative-name"
                  value={alias}
                  onChange={(event) => { setAlias(event.target.value); setVerifyError(''); }}
                  style={{ width: '100%' }}
                />
              </div>

              {verifyError && <div className="error-banner">{verifyError}</div>}

              <button className="btn btn-primary" type="submit" disabled={verifying}>
                {verifying ? 'Verifying…' : 'Verify & Continue'}
              </button>
            </form>
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Manage Security hub ─────────────────────────────────────────────────
  return (
    <AppShell>
      <PageHeader
        title="Manage Security"
        subtitle={
          <>
            Target certificate alias: <span className="mono">{verifiedAlias}</span>
          </>
        }
      >
        <button className="btn" onClick={() => loadCategories(true)} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
        <button className="btn" onClick={handleChangeAlias}>Change alias</button>
      </PageHeader>

      {categoriesError && <div className="error-banner">{categoriesError}</div>}

      {!categories && !categoriesError && (
        <div className="tile-grid">
          {Array.from({ length: 7 }).map((_, index) => (
            <div className="tile" key={index} aria-hidden="true" style={{ cursor: 'default' }}>
              <div className="skeleton-bar" style={{ width: '60%', height: 14 }} />
              <div className="skeleton-bar" style={{ width: '35%', height: 26, marginTop: 'auto' }} />
              <div className="skeleton-bar" style={{ width: '45%', height: 10 }} />
            </div>
          ))}
        </div>
      )}

      {categories && categories.length === 0 && (
        <EmptyState
          title="No security categories"
          message="The source tenant did not return any security artifact categories."
        />
      )}

      {categories && categories.length > 0 && (
        <div className="tile-grid">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.key}
              className={`tile${cat.supported ? '' : ' tile-disabled'}`}
              onClick={() => cat.supported && navigate(`/security/${cat.key}`)}
              disabled={!cat.supported}
              title={
                cat.supported
                  ? `Open ${cat.label}`
                  : 'Not covered by the MIG090 Security Content Transport API'
              }
            >
              <span className="tile-head">
                <CategoryIcon categoryKey={cat.key} />
                {cat.label}
              </span>
              <span className="tile-value">{cat.countLabel ? (cat.count ?? '—') : ''}</span>
              <span className="tile-foot">
                {cat.countLabel && <span className="tile-label">{cat.countLabel}</span>}
                {cat.migrationStatus && (
                  <MigrationStatusBadge
                    status={cat.migrationStatus}
                    lastMigratedAt={cat.lastMigratedAt}
                    successLabel="✓ Migrated"
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}