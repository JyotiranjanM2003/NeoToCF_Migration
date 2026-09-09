/**
 * Data Store Migration Controller — exposes MIG040 operations as
 * authenticated REST endpoints. Follows the exact same pattern as
 * variableMigration.controller.js: resolve tenants via tenantSelection
 * service, delegate to the service layer, return immediately with a
 * migrationId for async polling.
 */

const tenantSelection = require('../services/tenantSelection.service');
const datastoreMigrationService = require('../services/datastoreMigration.service');

/**
 * GET /api/datastores/list
 * Lists all data stores available on the user's currently-selected source tenant.
 * Returns: { dataStores: [{ dataStoreName, integrationFlow, type, totalEntries, ... }] }
 */
async function list(req, res, next) {
  try {
    const { sourceTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({
        code: 'NO_SOURCE_SELECTED',
        message: 'Select a source tenant first',
      });
    }

    const dataStores = await datastoreMigrationService.listSourceDataStores(sourceTenant);
    res.json({ dataStores });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/datastores/lookup?dataStoreName=...&integrationFlow=...&type=...
 * Verifies a specific data store exists on the source tenant and returns its
 * entries plus the retention period that would be used during migration.
 * Returns: { dataStore } or 404.
 */
async function lookup(req, res, next) {
  try {
    const { dataStoreName, integrationFlow = '', type = '' } = req.query;
    if (!dataStoreName) {
      return res.status(400).json({ message: 'dataStoreName is required' });
    }

    const { sourceTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({
        code: 'NO_SOURCE_SELECTED',
        message: 'Select a source tenant first',
      });
    }

    const result = await datastoreMigrationService.lookupSourceDataStore(
      sourceTenant,
      dataStoreName,
      integrationFlow,
      type
    );

    if (!result) {
      return res.status(404).json({
        message: `Data store '${dataStoreName}' (flow='${integrationFlow}') not found on source tenant`,
      });
    }

    res.json({ dataStore: result });
  } catch (err) {
    if (err.code === 'UNSUPPORTED_ADAPTER_DATASTORE') {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}

/**
 * POST /api/datastores/migrate
 * Body: { dataStores?: [{ dataStoreName, integrationFlow, type?, entryId? }] }
 *   - dataStores omitted or [] → migrate ALL data stores
 *   - dataStores with entries → selective migration (optionally one entry only)
 *
 * Returns: { migrationId, status: 'RUNNING' }
 * The caller polls GET /api/migration/:migrationId/status (existing endpoint).
 */
async function migrateStart(req, res, next) {
  try {
    const { dataStores = [] } = req.body;

    if (!Array.isArray(dataStores)) {
      return res.status(400).json({ message: 'dataStores must be an array' });
    }
    for (const d of dataStores) {
      if (!d.dataStoreName) {
        return res.status(400).json({ message: 'Each data store entry must have a dataStoreName' });
      }
    }

    const { sourceTenant, targetTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant || !targetTenant) {
      return res.status(400).json({
        code: 'NO_TENANTS_SELECTED',
        message: 'Select both a source and a target tenant first',
      });
    }

    const migrationId = await datastoreMigrationService.start({
      user: req.user,
      sourceTenant,
      targetTenant,
      dataStores: dataStores.map((d) => ({
        dataStoreName: d.dataStoreName,
        integrationFlow: d.integrationFlow || '',
        type: d.type || '',
        entryId: d.entryId || '',
      })),
    });

    res.status(202).json({ migrationId, status: 'RUNNING' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, lookup, migrateStart };