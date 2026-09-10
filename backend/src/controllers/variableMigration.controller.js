/**
 * Variable Migration Controller — exposes MIG050 operations as authenticated
 * REST endpoints. Follows the exact same pattern as migration.controller.js:
 * resolve tenants via tenantSelection.service, delegate to the service layer,
 * return immediately with a migrationId for async polling.
 */

const tenantSelection = require('../services/tenantSelection.service');
const variableMigrationService = require('../services/variableMigration.service');
const MigrationModel = require('../models/Migration.model');

/**
 * GET /api/variables/list
 * Lists all variables available on the user's currently-selected source tenant.
 * Returns: { variables: [{ variableName, integrationFlow, visibility }] }
 */
async function list(req, res, next) {
  try {
    const { sourceTenant, targetTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({
        code: 'NO_SOURCE_SELECTED',
        message: 'Select a source tenant first',
      });
    }

    // Fetch variables and (if target is selected) their last migration status in parallel.
    const [variables, statusRows] = await Promise.all([
      variableMigrationService.listSourceVariables(sourceTenant),
      targetTenant
        ? MigrationModel.latestStatusByVariableForUser(req.user.userId, targetTenant.TARGETTENANTID)
        : Promise.resolve([]),
    ]);

    // Build a lookup: "variableName::integrationFlow" → { status, lastMigratedAt }
    const statusMap = {};
    for (const row of statusRows) {
      statusMap[row.ARTIFACTID] = {
        migrationStatus: row.STATUS,
        lastMigratedAt: row.COMPLETEDAT || row.STARTEDAT,
      };
    }

    const enriched = variables.map((v) => {
      const key = `${v.variableName}::${v.integrationFlow}`;
      return { ...v, ...(statusMap[key] || { migrationStatus: null, lastMigratedAt: null }) };
    });

    res.json({ variables: enriched, hasTarget: !!targetTenant });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/variables/lookup?variableName=...&integrationFlow=...
 * Verifies a specific variable exists on the source tenant.
 * Returns: { variable } or 404.
 */
async function lookup(req, res, next) {
  try {
    const { variableName, integrationFlow = '' } = req.query;
    if (!variableName) {
      return res.status(400).json({ message: 'variableName is required' });
    }

    const { sourceTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({
        code: 'NO_SOURCE_SELECTED',
        message: 'Select a source tenant first',
      });
    }

    const variable = await variableMigrationService.lookupSourceVariable(
      sourceTenant,
      variableName,
      integrationFlow
    );

    if (!variable) {
      return res.status(404).json({
        message: `Variable '${variableName}' (flow='${integrationFlow}') not found on source tenant`,
      });
    }

    res.json({ variable });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/variables/migrate
 * Body: { variables?: [{ variableName, integrationFlow }] }
 *   - variables omitted or [] → migrate ALL variables
 *   - variables with entries → selective migration
 *
 * Returns: { migrationId, status: 'RUNNING' }
 * The caller polls GET /api/migration/:migrationId/status (existing endpoint).
 */
async function migrateStart(req, res, next) {
  try {
    const { variables = [] } = req.body;

    // Validate shape
    if (!Array.isArray(variables)) {
      return res.status(400).json({ message: 'variables must be an array' });
    }
    for (const v of variables) {
      if (!v.variableName) {
        return res.status(400).json({ message: 'Each variable entry must have a variableName' });
      }
    }

    const { sourceTenant, targetTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant || !targetTenant) {
      return res.status(400).json({
        code: 'NO_TENANTS_SELECTED',
        message: 'Select both a source and a target tenant first',
      });
    }

    const migrationId = await variableMigrationService.start({
      user: req.user,
      sourceTenant,
      targetTenant,
      variables: variables.map((v) => ({
        variableName: v.variableName,
        integrationFlow: v.integrationFlow || '',
      })),
    });

    res.status(202).json({ migrationId, status: 'RUNNING' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, lookup, migrateStart };
