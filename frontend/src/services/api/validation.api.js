import client from './client';

export function runValidation({ packageId, artifactId }) {
  return client.post('/validation/run', { packageId, artifactId }).then((r) => r.data);
}
