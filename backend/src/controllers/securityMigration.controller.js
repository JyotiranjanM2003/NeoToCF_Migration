const tenantSelection = require('../services/tenantSelection.service');
const securityMigrationService = require('../services/securityMigration.service');

/** GET /api/security-artifacts/categories */
async function listCategories(req, res, next) {
  try {
    const { sourceTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({ code: 'NO_SOURCE_SELECTED', message: 'No source tenant selected. Please select a source tenant first.' });
    }
    res.json({ categories: await securityMigrationService.listCategories(sourceTenant) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/security-artifacts/categories/:categoryKey/entries */
async function listCategoryEntries(req, res, next) {
  try {
    const { sourceTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({ code: 'NO_SOURCE_SELECTED', message: 'No source tenant selected. Please select a source tenant first.' });
    }
    const result = await securityMigrationService.listCategoryEntries(sourceTenant, req.params.categoryKey);
    if (!result) return res.status(404).json({ message: 'Unknown security category' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** POST /api/security-artifacts/verify-alias  { targetCertificateAlias } */
// AFTER
async function verifyAlias(req, res, next) {
  try {
    const { targetCertificateAlias } = req.body;
    const { sourceTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({ code: 'NO_SOURCE_SELECTED', message: 'No source tenant selected. Please select a source tenant first.' });
    }
    res.json(await securityMigrationService.verifyTargetCertificateAlias(sourceTenant, targetCertificateAlias));
  } catch (err) {
    next(err);
  }
}

/** POST /api/security-artifacts/migrate  { targetCertificateAlias, categoryKey, subTypeKeys? } */
async function migrate(req, res, next) {
  try {
    const { targetCertificateAlias, categoryKey, subTypeKeys = [] } = req.body;

    if (!targetCertificateAlias || !targetCertificateAlias.trim()) {
      return res.status(400).json({ message: 'targetCertificateAlias is required' });
    }
    if (!categoryKey) {
      return res.status(400).json({ message: 'categoryKey is required' });
    }

    const { sourceTenant, targetTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({ code: 'NO_SOURCE_SELECTED', message: 'No source tenant selected. Please select a source tenant first.' });
    }
    if (!targetTenant) {
      return res.status(400).json({ code: 'NO_TARGET_SELECTED', message: 'No target tenant selected. Please select a target tenant first.' });
    }

    const migrationId = await securityMigrationService.start({
      user: req.user,
      sourceTenant,
      targetTenant,
      targetCertificateAlias,
      categoryKey,
      subTypeKeys,
    });

    res.status(202).json({ migrationId, status: 'RUNNING' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
}

module.exports = { listCategories, listCategoryEntries, verifyAlias, migrate };