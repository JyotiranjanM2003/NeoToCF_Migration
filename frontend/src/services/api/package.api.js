import client from './client';

export function listPackages() {
  return client.get('/packages').then((r) => r.data);
}

export function listArtifacts(packageId) {
  return client.get(`/packages/${encodeURIComponent(packageId)}/artifacts`).then((r) => r.data);
}

export function downloadPackage(packageId) {
  return client
    .get(`/packages/${encodeURIComponent(packageId)}/download`, { responseType: 'blob' })
    .then((r) => r.data);
}
