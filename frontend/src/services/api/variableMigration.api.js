/**
 * Frontend API service for MIG050 Variable Migration.
 * Follows the same pattern as migration.api.js / package.api.js.
 */
import client from './client';

/** Lists all variables on the source tenant. */
export function listVariables() {
  return client.get('/variables/list').then((r) => r.data);
}

/**
 * Checks a specific variable exists on source.
 * @param {string} variableName
 * @param {string} integrationFlow — empty string for global variables
 */
export function lookupVariable(variableName, integrationFlow = '') {
  return client
    .get('/variables/lookup', { params: { variableName, integrationFlow } })
    .then((r) => r.data);
}

/**
 * Starts a variable migration.
 * @param {Array<{ variableName: string, integrationFlow: string }>} variables
 *   Pass an empty array to migrate ALL variables.
 * @returns {{ migrationId: string, status: 'RUNNING' }}
 */
export function startVariableMigration(variables = []) {
  return client.post('/variables/migrate', { variables }).then((r) => r.data);
}
