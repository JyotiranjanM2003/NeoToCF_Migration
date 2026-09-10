import client from './client';

export function listNumberRanges() {
  return client.get('/number-ranges').then((response) => response.data);
}

export function getNumberRange(name) {
  return client.get(`/number-ranges/${encodeURIComponent(name)}`).then((response) => response.data);
}

// Pass an empty array to migrate all currently available source Number Ranges.
export function migrateNumberRanges(names = []) {
  return client.post('/number-ranges/migrate', { names }).then((response) => response.data);
}
