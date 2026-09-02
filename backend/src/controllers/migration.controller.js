// const SourceTenantModel = require('../models/SourceTenant.model');
// const TargetTenantModel = require('../models/TargetTenant.model');
// const migrationService = require('../services/migration.service');
// const MigrationModel = require('../models/Migration.model');

// /** POST /api/migration/start  { packageId, artifactId? } */
// async function start(req, res, next) {
//   try {
//     const { packageId, artifactId } = req.body;
//     if (!packageId) return res.status(400).json({ message: 'packageId is required' });

//     const [sourceTenant, targetTenant] = await Promise.all([
//       SourceTenantModel.findByUser(req.user.userId),
//       TargetTenantModel.findByUser(req.user.userId),
//     ]);

//     if (!sourceTenant || !targetTenant) {
//       return res.status(400).json({ message: 'Connect both source and target tenants first' });
//     }

//     const migrationId = await migrationService.start({
//       user: req.user,
//       sourceTenant,
//       targetTenant,
//       packageId,
//       artifactId,
//     });

//     res.status(202).json({ migrationId, status: 'RUNNING' });
//   } catch (err) {
//     next(err);
//   }
// }

// /** GET /api/migration/:id/status */
// async function getStatus(req, res, next) {
//   try {
//     const status = await migrationService.getStatus(req.params.id, req.user.userId);
//     if (!status) return res.status(404).json({ message: 'Migration not found' });
//     res.json(status);
//   } catch (err) {
//     next(err);
//   }
// }

// /** GET /api/migration/:id/report */
// async function getReport(req, res, next) {
//   try {
//     const report = await migrationService.getReport(req.params.id, req.user.userId);
//     if (!report) return res.status(404).json({ message: 'Migration not found' });
//     res.json(report);
//   } catch (err) {
//     next(err);
//   }
// }

// /** GET /api/migration — history list for the current user */
// async function list(req, res, next) {
//   try {
//     const migrations = await MigrationModel.listForUser(req.user.userId);
//     res.json({ migrations });
//   } catch (err) {
//     next(err);
//   }
// }

// module.exports = { start, getStatus, getReport, list };



// const SourceTenantModel = require('../models/SourceTenant.model');
// const TargetTenantModel = require('../models/TargetTenant.model');
// const migrationService = require('../services/migration.service');
// const MigrationModel = require('../models/Migration.model');
// const MigrationBatchModel = require('../models/MigrationBatch.model');

// /** POST /api/migration/start  { packageId, artifactId? } */
// async function start(req, res, next) {
//   try {
//     const { packageId, artifactId } = req.body;
//     if (!packageId) return res.status(400).json({ message: 'packageId is required' });

//     const [sourceTenant, targetTenant] = await Promise.all([
//       SourceTenantModel.findByUser(req.user.userId),
//       TargetTenantModel.findByUser(req.user.userId),
//     ]);

//     if (!sourceTenant || !targetTenant) {
//       return res.status(400).json({ message: 'Connect both source and target tenants first' });
//     }

//     const migrationId = await migrationService.start({
//       user: req.user,
//       sourceTenant,
//       targetTenant,
//       packageId,
//       artifactId,
//     });

//     res.status(202).json({ migrationId, status: 'RUNNING' });
//   } catch (err) {
//     next(err);
//   }
// }

// /** POST /api/migration/batch/start  { packageIds: string[] } */
// async function startBatch(req, res, next) {
//   try {
//     const { packageIds } = req.body;
//     if (!Array.isArray(packageIds) || packageIds.length === 0) {
//       return res.status(400).json({ message: 'packageIds must be a non-empty array' });
//     }

//     const [sourceTenant, targetTenant] = await Promise.all([
//       SourceTenantModel.findByUser(req.user.userId),
//       TargetTenantModel.findByUser(req.user.userId),
//     ]);

//     if (!sourceTenant || !targetTenant) {
//       return res.status(400).json({ message: 'Connect both source and target tenants first' });
//     }

//     const batchId = await migrationService.startBatch({
//       user: req.user,
//       sourceTenant,
//       targetTenant,
//       packageIds,
//     });

//     res.status(202).json({ batchId, status: 'RUNNING' });
//   } catch (err) {
//     next(err);
//   }
// }

const tenantSelection = require('../services/tenantSelection.service');
const migrationService = require('../services/migration.service');
const MigrationModel = require('../models/Migration.model');
const MigrationBatchModel = require('../models/MigrationBatch.model');

/** POST /api/migration/start  { packageId, artifactId? } */
async function start(req, res, next) {
  try {
    const { packageId, artifactId } = req.body;
    if (!packageId) return res.status(400).json({ message: 'packageId is required' });

    const { sourceTenant, targetTenant } = await tenantSelection.getSelectedTenants(req.user.userId);

    if (!sourceTenant || !targetTenant) {
      return res
        .status(400)
        .json({ code: 'NO_TENANTS_SELECTED', message: 'Select both a source and a target tenant first' });
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

/** POST /api/migration/batch/start  { packageIds: string[] } */
async function startBatch(req, res, next) {
  try {
    const { packageIds } = req.body;
    if (!Array.isArray(packageIds) || packageIds.length === 0) {
      return res.status(400).json({ message: 'packageIds must be a non-empty array' });
    }

    const { sourceTenant, targetTenant } = await tenantSelection.getSelectedTenants(req.user.userId);

    if (!sourceTenant || !targetTenant) {
      return res
        .status(400)
        .json({ code: 'NO_TENANTS_SELECTED', message: 'Select both a source and a target tenant first' });
    }

    const batchId = await migrationService.startBatch({
      user: req.user,
      sourceTenant,
      targetTenant,
      packageIds,
    });

    res.status(202).json({ batchId, status: 'RUNNING' });
  } catch (err) {
    next(err);
  }
}


/** GET /api/migration/batch/active — the current user's in-progress batch, if any. */
async function getActiveBatch(req, res, next) {
  try {
    const batch = await MigrationBatchModel.findActiveForUser(req.user.userId);
    res.json({ batch });
  } catch (err) {
    next(err);
  }
}

/** GET /api/migration/batch/:batchId/status */
async function getBatchStatus(req, res, next) {
  try {
    const status = await migrationService.getBatchStatus(req.params.batchId, req.user.userId);
    if (!status) return res.status(404).json({ message: 'Batch not found' });
    res.json(status);
  } catch (err) {
    next(err);
  }
}

/** GET /api/migration/batch/:batchId/report */
async function getBatchReport(req, res, next) {
  try {
    const report = await migrationService.getBatchReport(req.params.batchId, req.user.userId);
    if (!report) return res.status(404).json({ message: 'Batch not found' });
    res.json(report);
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

module.exports = {
  start,
  startBatch,
  getActiveBatch,
  getBatchStatus,
  getBatchReport,
  getStatus,
  getReport,
  list,
};