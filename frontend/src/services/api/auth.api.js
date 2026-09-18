import client from './client';

export function signup({ email, password, fullName }) {
  return client.post('/auth/signup', { email, password, fullName }).then((r) => r.data);
}

export function login({ email, password }) {
  return client.post('/auth/login', { email, password }).then((r) => r.data);
}

export function logout() {
  return client.post('/auth/logout');
}

export function me() {
  return client.get('/auth/me').then((r) => r.data);
}

export function refresh() {
  return client.post('/auth/refresh').then((r) => r.data);
}

export function forgotPassword(email) {
  return client.post('/auth/forgot-password', { email }).then((r) => r.data);
}

export function validateResetToken(token) {
  return client.get(`/auth/reset-password/${token}/validate`).then((r) => r.data);
}

export function resetPassword({ token, password }) {
  return client.post('/auth/reset-password', { token, password }).then((r) => r.data);
}