import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import * as securityApi from '../services/api/securityMigration.api';
import { CategoryIcon } from '../components/security/SecurityIcons.jsx';


export const SECURITY_ALIAS_STORAGE_KEY = 'securityTargetCertAlias';

export default function SecurityArtifacts() {
    const navigate = useNavigate();
    const [alias, setAlias] = useState(() => sessionStorage.getItem(SECURITY_ALIAS_STORAGE_KEY) || '');
    const [verifiedAlias, setVerifiedAlias] = useState(() => sessionStorage.getItem(SECURITY_ALIAS_STORAGE_KEY) || '');
    const [verifying, setVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState('');
    const [categories, setCategories] = useState(null);
    const [categoriesError, setCategoriesError] = useState('');

    useEffect(() => {
        if (verifiedAlias) loadCategories();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verifiedAlias]);

    function loadCategories() {
        setCategories(null);
        setCategoriesError('');
        securityApi
            .listCategories()
            .then((data) => setCategories(data.categories))
            .catch((err) => {
                const code = err.response?.data?.code;
                if (code === 'NO_SOURCE_SELECTED') {
                    setCategoriesError(err.response.data.message);
                    return;
                }
                setCategoriesError(err.response?.data?.message || 'Failed to load Security Artifacts');
            });
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
        setVerifiedAlias('');
        setCategories(null);
    }

    if (!verifiedAlias) {
        return (
            <AppShell>
                <h2 style={{ marginBottom: 16 }}>Security Artifacts</h2>
                <div className="card" style={{ maxWidth: 480 }}>
                    <h3 style={{ marginTop: 0 }}>Target Certificate Alias</h3>
                    <p className="helper-text">
                        SAP encrypts Security Content transports with a certificate held in the target
                        tenant's Keystore. Enter that certificate's alias — this is the same{' '}
                        <code>targetCertificateAlias</code> variable used by the "CPI MIG090 Security
                        Artifacts" Postman collection.
                    </p>
                    <form onSubmit={handleVerify}>
                        <input
                            className="input"
                            placeholder="e.g. subject-alternative-name"
                            value={alias}
                            onChange={(event) => setAlias(event.target.value)}
                            style={{ width: '100%', marginBottom: 12 }}
                        />
                        {verifyError && <div className="error-banner" style={{ marginBottom: 12 }}>{verifyError}</div>}
                        <button className="btn btn-primary" type="submit" disabled={verifying}>
                            {verifying ? 'Verifying…' : 'Verify & Continue'}
                        </button>
                    </form>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div>
                    <h2 style={{ margin: 0 }}>Manage Security</h2>
                    <p className="helper-text" style={{ margin: '4px 0 0' }}>
                        Target certificate alias: <span className="mono">{verifiedAlias}</span>
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={handleChangeAlias}>Change alias</button>
            </div>

            {categoriesError && <div className="error-banner">{categoriesError}</div>}

            {!categories && !categoriesError && <div className="empty-state">Loading Security Artifacts from source tenant…</div>}

            {categories && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16 }}>
                    {categories.map((cat) => (
                        <div
                            key={cat.key}
                            className="card"
                            onClick={() => cat.supported && navigate(`/security/${cat.key}`)}
                            title={cat.supported ? undefined : 'Not covered by the MIG090 Security Content Transport API'}
                            style={{
                                cursor: cat.supported ? 'pointer' : 'not-allowed',
                                opacity: cat.supported ? 1 : 0.55,
                                minHeight: 110,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CategoryIcon categoryKey={cat.key} />
                                <strong>{cat.label}</strong>
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 600, textAlign: 'right' }}>
                                {cat.countLabel ? (cat.count ?? '—') : ''}
                            </div>
                            {cat.countLabel && <span className="helper-text">{cat.countLabel}</span>}
                        </div>
                    ))}
                </div>
            )}
        </AppShell>
    );
}