const SourceTenantModel = require('../models/SourceTenant.model');
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

async function list(req, res, next) {
  try {
    const tenant = await requireSourceTenant(req, res);
    if (!tenant) return;
    const packages = await packageService.listPackages(tenant);
    res.json({ packages });
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
