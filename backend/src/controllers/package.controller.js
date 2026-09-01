// const SourceTenantModel = require('../models/SourceTenant.model');
// const packageService = require('../services/package.service');
// const { sendZip } = require('../utils/zipHandler');

// async function requireSourceTenant(req, res) {
//   const tenant = await SourceTenantModel.findByUser(req.user.userId);
//   if (!tenant || tenant.CONNECTIONSTATUS !== 'CONNECTED') {
//     res.status(400).json({ message: 'Connect and verify the source tenant before browsing packages' });
//     return null;
//   }
//   return tenant;
// }

// async function list(req, res, next) {
//   try {
//     const tenant = await requireSourceTenant(req, res);
//     if (!tenant) return;
//     const packages = await packageService.listPackages(tenant);
//     res.json({ packages });
//   } catch (err) {
//     next(err);
//   }
// }

// async function listArtifacts(req, res, next) {
//   try {
//     const tenant = await requireSourceTenant(req, res);
//     if (!tenant) return;
//     const artifacts = await packageService.listArtifacts(tenant, req.params.packageId);
//     res.json({ artifacts });
//   } catch (err) {
//     next(err);
//   }
// }

// async function download(req, res, next) {
//   try {
//     const tenant = await requireSourceTenant(req, res);
//     if (!tenant) return;
//     const zip = await packageService.downloadPackageZip(tenant, req.params.packageId);
//     sendZip(res, zip, `${req.params.packageId}.zip`);
//   } catch (err) {
//     next(err);
//   }
// }

// module.exports = { list, listArtifacts, download };
const SourceTenantModel = require('../models/SourceTenant.model');
const TargetTenantModel = require('../models/TargetTenant.model');
const MigrationModel = require('../models/Migration.model');
const packageService = require('../services/package.service');
const { sendZip } = require('../utils/zipHandler');

async function requireSourceTenant(req, res) {
  const tenant = await SourceTenantModel.findByUser(req.user.userId);
  if (!tenant || tenant.CONNECTIONSTATUS !== 'CONNECTED') {
    res.status(400).json({ message: 'Connect and verify the source tenant before browsing packages' });
    return null;
  }
  return tenant;
}

/**
 * GET /api/packages — live list from the source tenant, enriched with each
 * package's latest migration status against the CURRENT target tenant (if
 * one is connected), so the UI can show "already migrated" without a
 * separate round trip. This is purely our own migration history — no call
 * to the target tenant is made here.
 */
async function list(req, res, next) {
  try {
    const tenant = await requireSourceTenant(req, res);
    if (!tenant) return;

    const packages = await packageService.listPackages(tenant);

    const targetTenant = await TargetTenantModel.findByUser(req.user.userId);
    if (!targetTenant) {
      // No target connected yet — nothing to compare against.
      return res.json({ packages: packages.map((p) => ({ ...p, migrationStatus: null })) });
    }

    const latestByPackage = await MigrationModel.latestStatusByPackageForUser(
      req.user.userId,
      targetTenant.TARGETTENANTID
    );
    const statusMap = new Map(latestByPackage.map((row) => [row.PACKAGENAME, row]));

    const enriched = packages.map((p) => {
      const record = statusMap.get(p.id);
      return {
        ...p,
        migrationStatus: record ? record.STATUS : null,
        lastMigratedAt: record ? record.COMPLETEDAT || record.STARTEDAT : null,
      };
    });

    res.json({ packages: enriched });
  } catch (err) {
    next(err);
  }
}

async function listArtifacts(req, res, next) {
  try {
    const tenant = await requireSourceTenant(req, res);
    if (!tenant) return;
    const artifacts = await packageService.listArtifacts(tenant, req.params.packageId);
    res.json({ artifacts });
  } catch (err) {
    next(err);
  }
}

async function download(req, res, next) {
  try {
    const tenant = await requireSourceTenant(req, res);
    if (!tenant) return;
    const zip = await packageService.downloadPackageZip(tenant, req.params.packageId);
    sendZip(res, zip, `${req.params.packageId}.zip`);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, listArtifacts, download };