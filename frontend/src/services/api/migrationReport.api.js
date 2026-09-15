import client from './client';

export function getMigrationReport() {
  return client.get('/migration-report').then((r) => r.data);
}