import client from './client';

export function startMigration({ packageId, artifactId, artifactIds }) {
  return client.post('/migration/start', { packageId, artifactId, artifactIds }).then((r) => r.data);
}

export function startBatchMigration({ packageIds }) {
  return client.post('/migration/start-batch', { packageIds }).then((r) => r.data);
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
