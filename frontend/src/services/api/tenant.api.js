// import client from './client';

// export function getSourceStatus() {
//   return client.get('/tenants/source').then((r) => r.data);
// }

// export function connectSource(payload) {
//   return client.post('/tenants/source', payload).then((r) => r.data);
// }

// export function testSource() {
//   return client.post('/tenants/source/test').then((r) => r.data);
// }

// export function getTargetStatus() {
//   return client.get('/tenants/target').then((r) => r.data);
// }

// export function connectTarget(payload) {
//   return client.post('/tenants/target', payload).then((r) => r.data);
// }

// export function testTarget() {
//   return client.post('/tenants/target/test').then((r) => r.data);
// }


import client from './client';

// ---------- Source (Neo) ----------
export function listSourceTenants() {
  return client.get('/tenants/source').then((r) => r.data);
}

export function getSourceTenant(id) {
  return client.get(`/tenants/source/${id}`).then((r) => r.data);
}

export function createSourceTenant(payload) {
  return client.post('/tenants/source', payload).then((r) => r.data);
}

export function updateSourceTenant(id, payload) {
  return client.put(`/tenants/source/${id}`, payload).then((r) => r.data);
}

export function testSourceTenant(id) {
  return client.post(`/tenants/source/${id}/test`).then((r) => r.data);
}

export function selectSourceTenant(id) {
  return client.post(`/tenants/source/${id}/select`).then((r) => r.data);
}

// ---------- Target (Cloud Foundry) ----------
export function listTargetTenants() {
  return client.get('/tenants/target').then((r) => r.data);
}

export function getTargetTenant(id) {
  return client.get(`/tenants/target/${id}`).then((r) => r.data);
}

export function createTargetTenant(payload) {
  return client.post('/tenants/target', payload).then((r) => r.data);
}

export function updateTargetTenant(id, payload) {
  return client.put(`/tenants/target/${id}`, payload).then((r) => r.data);
}

export function testTargetTenant(id) {
  return client.post(`/tenants/target/${id}/test`).then((r) => r.data);
}

export function selectTargetTenant(id) {
  return client.post(`/tenants/target/${id}/select`).then((r) => r.data);
}