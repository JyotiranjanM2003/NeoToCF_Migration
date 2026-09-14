import client from './client';

export function listCategories() {
  return client.get('/security-artifacts/categories').then((r) => r.data);
}

export function listCategoryEntries(categoryKey) {
  return client
    .get(`/security-artifacts/categories/${encodeURIComponent(categoryKey)}/entries`)
    .then((r) => r.data);
}

export function verifyTargetCertificateAlias(targetCertificateAlias) {
  return client
    .post('/security-artifacts/verify-alias', { targetCertificateAlias })
    .then((r) => r.data);
}

// subTypeKeys is only meaningful for the 'securityMaterial' category —
// pass [] (or omit) to migrate the category's full default Type.
export function migrateSecurityCategory({ targetCertificateAlias, categoryKey, subTypeKeys = [] }) {
  return client
    .post('/security-artifacts/migrate', { targetCertificateAlias, categoryKey, subTypeKeys })
    .then((r) => r.data);
}