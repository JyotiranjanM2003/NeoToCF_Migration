// const SourceTenantModel = require('../models/SourceTenant.model');
// const iflowService = require('../services/iflow.service');
// const { sendZip } = require('../utils/zipHandler');

// async function requireSourceTenant(req, res) {
//   const tenant = await SourceTenantModel.findByUser(req.user.userId);
//   if (!tenant || tenant.CONNECTIONSTATUS !== 'CONNECTED') {
//     res.status(400).json({ message: 'Connect and verify the source tenant first' });
//     return null;
//   }
//   return tenant;
// }

const tenantSelection = require('../services/tenantSelection.service');
const iflowService = require('../services/iflow.service');
const { sendZip } = require('../utils/zipHandler');

async function requireSourceTenant(req, res) {
  const { sourceTenant } = await tenantSelection.getSelectedTenants(req.user.userId);

  if (!sourceTenant) {
    res.status(400).json({ code: 'NO_SOURCE_SELECTED', message: 'Select a source tenant first' });
    return null;
  }
  if (sourceTenant.CONNECTIONSTATUS !== 'CONNECTED') {
    res
      .status(400)
      .json({ code: 'SOURCE_NOT_CONNECTED', message: 'The selected source tenant is not connected — reconfigure it' });
    return null;
  }
  return sourceTenant;
}

/** GET /api/iflows/:id?packageId=... */
async function getDetail(req, res, next) {
  try {
    const tenant = await requireSourceTenant(req, res);
    if (!tenant) return;

    const { packageId } = req.query;
    if (!packageId) return res.status(400).json({ message: 'packageId query param is required' });

    const detail = await iflowService.getArtifactDetail(tenant, packageId, req.params.id);
    if (!detail) return res.status(404).json({ message: 'Artifact not found in that package' });

    let configuration = [];
    if (detail.type === 'IFLOW') {
      configuration = await iflowService.getConfiguration(tenant, req.params.id);
    }

    res.json({ ...detail, configuration });
  } catch (err) {
    next(err);
  }
}

/** GET /api/iflows/:id/configuration */
async function getConfiguration(req, res, next) {
  try {
    const tenant = await requireSourceTenant(req, res);
    if (!tenant) return;
    const configuration = await iflowService.getConfiguration(tenant, req.params.id);
    res.json({ configuration });
  } catch (err) {
    next(err);
  }
}

/** GET /api/iflows/:id/download */
async function download(req, res, next) {
  try {
    const tenant = await requireSourceTenant(req, res);
    if (!tenant) return;
    const zip = await iflowService.downloadArtifactZip(tenant, req.params.id);
    sendZip(res, zip, `${req.params.id}.zip`);
  } catch (err) {
    next(err);
  }
}

module.exports = { getDetail, getConfiguration, download };
