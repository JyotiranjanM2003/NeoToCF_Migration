const SourceTenantModel = require('../models/SourceTenant.model');
const TargetTenantModel = require('../models/TargetTenant.model');
const migrationService = require('../services/migration.service');
const MigrationModel = require('../models/Migration.model');

/** POST /api/migration/start  { packageId, artifactId? } */
async function start(req, res, next) {
  try {
    const { packageId, artifactId } = req.body;
    if (!packageId) return res.status(400).json({ message: 'packageId is required' });

    const [sourceTenant, targetTenant] = await Promise.all([
      SourceTenantModel.findByUser(req.user.userId),
      TargetTenantModel.findByUser(req.user.userId),
    ]);

    if (!sourceTenant || !targetTenant) {
      return res.status(400).json({ message: 'Connect both source and target tenants first' });
    }

    const migrationId = await migrationService.start({
      user: req.user,
      sourceTenant,
      targetTenant,
      packageId,
      artifactId,
    });

    res.status(202).json({ migrationId, status: 'RUNNING' });
  } catch (err) {
    next(err);
  }
}

/** GET /api/migration/:id/status */
async function getStatus(req, res, next) {
  try {
    const status = await migrationService.getStatus(req.params.id, req.user.userId);
    if (!status) return res.status(404).json({ message: 'Migration not found' });
    res.json(status);
  } catch (err) {
    next(err);
  }
}

/** GET /api/migration/:id/report */
async function getReport(req, res, next) {
  try {
    const report = await migrationService.getReport(req.params.id, req.user.userId);
    if (!report) return res.status(404).json({ message: 'Migration not found' });
    res.json(report);
  } catch (err) {
    next(err);
  }
}

/** GET /api/migration — history list for the current user */
async function list(req, res, next) {
  try {
    const migrations = await MigrationModel.listForUser(req.user.userId);
    res.json({ migrations });
  } catch (err) {
    next(err);
  }
}

module.exports = { start, getStatus, getReport, list };
