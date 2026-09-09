/**
 * Frontend API service for MIG040 Data Store Migration.
 * Follows the same pattern as variableMigration.api.js / migration.api.js.
 */
import client from './client';

/** Lists all data stores on the source tenant. */
export function listDataStores() {
  return client.get('/datastores/list').then((r) => r.data);
}

/**
 * Checks a specific data store exists on source and previews its retention
 * settings / entries.
 * @param {string} dataStoreName
 * @param {string} integrationFlow — empty string for global data stores
 * @param {string} type — optional data store type filter
 */
export function lookupDataStore(dataStoreName, integrationFlow = '', type = '') {
  return client
    .get('/datastores/lookup', { params: { dataStoreName, integrationFlow, type } })
    .then((r) => r.data);
}

/**
 * Starts a data store migration.
 * @param {Array<{ dataStoreName: string, integrationFlow: string, type?: string, entryId?: string }>} dataStores
 *   Pass an empty array to migrate ALL data stores.
 * @returns {{ migrationId: string, status: 'RUNNING' }}
 */
export function startDataStoreMigration(dataStores = []) {
  return client.post('/datastores/migrate', { dataStores }).then((r) => r.data);
}