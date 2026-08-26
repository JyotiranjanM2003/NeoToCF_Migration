import client from './client';

export function getIflowDetail(id, packageId) {
  return client.get(`/iflows/${encodeURIComponent(id)}`, { params: { packageId } }).then((r) => r.data);
}

export function downloadIflow(id) {
  return client.get(`/iflows/${encodeURIComponent(id)}/download`, { responseType: 'blob' }).then((r) => r.data);
}
