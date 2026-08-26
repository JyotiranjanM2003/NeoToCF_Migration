const SourceTenantModel = require('../models/SourceTenant.model');
const TargetTenantModel = require('../models/TargetTenant.model');
const validationService = require('../services/validation.service');

/** POST /api/validation/run  { packageId, artifactId? } */
async function run(req, res, next) {
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

    const result = await validationService.run({ sourceTenant, targetTenant, packageId, artifactId });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { run };
