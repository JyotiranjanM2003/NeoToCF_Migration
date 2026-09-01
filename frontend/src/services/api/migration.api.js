// import client from './client';

// export function startMigration({ packageId, artifactId }) {
//   return client.post('/migration/start', { packageId, artifactId }).then((r) => r.data);
// }

// export function getMigrationStatus(id) {
//   return client.get(`/migration/${id}/status`).then((r) => r.data);
// }

// export function getMigrationReport(id) {
//   return client.get(`/migration/${id}/report`).then((r) => r.data);
// }

// export function listMigrations() {
//   return client.get('/migration').then((r) => r.data);
// }


import client from './client';

export function startMigration({ packageId, artifactId }) {
  return client.post('/migration/start', { packageId, artifactId }).then((r) => r.data);
}

export function getMigrationStatus(id) {
  return client.get(`/migration/${id}/status`).then((r) => r.data);
}

export function getMigrationReport(id) {
  return client.get(`/migration/${id}/report`).then((r) => r.data);
}

export function listMigrations() {
  return client.get('/migration').then((r) => r.data);
}

export function startBatchMigration(packageIds) {
  return client.post('/migration/batch/start', { packageIds }).then((r) => r.data);
}

export function getActiveBatch() {
  return client.get('/migration/batch/active').then((r) => r.data);
}

export function getBatchStatus(batchId) {
  return client.get(`/migration/batch/${batchId}/status`).then((r) => r.data);
}

export function getBatchReport(batchId) {
  return client.get(`/migration/batch/${batchId}/report`).then((r) => r.data);
}