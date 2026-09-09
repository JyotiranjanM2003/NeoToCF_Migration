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
 * @param {boolean} force - true skips the duplicate-migration check server-side
 * @returns {{ migrationId: string, status: 'RUNNING' }}
 *   Throws with response.status === 409 and response.data.code === 'DUPLICATE_DATASTORES'
 *   when duplicates are found and force was not set.
 */
export function startDataStoreMigration(dataStores = [], force = false) {
  return client.post('/datastores/migrate', { dataStores, force }).then((r) => r.data);
}