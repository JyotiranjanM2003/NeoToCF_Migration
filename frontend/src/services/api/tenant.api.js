import client from './client';

export function getSourceStatus() {
  return client.get('/tenants/source').then((r) => r.data);
}

export function connectSource(payload) {
  return client.post('/tenants/source', payload).then((r) => r.data);
}

export function testSource() {
  return client.post('/tenants/source/test').then((r) => r.data);
}

export function getTargetStatus() {
  return client.get('/tenants/target').then((r) => r.data);
}

export function connectTarget(payload) {
  return client.post('/tenants/target', payload).then((r) => r.data);
}

export function testTarget() {
  return client.post('/tenants/target/test').then((r) => r.data);
}
