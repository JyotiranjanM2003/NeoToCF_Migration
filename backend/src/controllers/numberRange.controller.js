const tenantSelection = require('../services/tenantSelection.service');
const numberRangeService = require('../services/numberRange.service');

async function list(req, res, next) {
  try {
    const { sourceTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({ code: 'NO_SOURCE_SELECTED', message: 'No source tenant selected. Please select a source tenant first.' });
    }
    res.json({ numberRanges: await numberRangeService.listSourceNumberRanges(sourceTenant) });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const { sourceTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({ code: 'NO_SOURCE_SELECTED', message: 'No source tenant selected. Please select a source tenant first.' });
    }
    const numberRange = await numberRangeService.getSourceNumberRange(sourceTenant, req.params.name);
    if (!numberRange) return res.status(404).json({ message: 'Number Range not found on source tenant' });
    res.json({ numberRange: numberRangeService.normalizeNumberRange(numberRange) });
  } catch (err) {
    next(err);
  }
}

async function migrate(req, res, next) {
  try {
    const { names = [] } = req.body;
    if (!Array.isArray(names) || names.some((name) => typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ message: 'names must be an array of Number Range names' });
    }
    const { sourceTenant, targetTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({ code: 'NO_SOURCE_SELECTED', message: 'No source tenant selected. Please select a source tenant first.' });
    }
    if (!targetTenant) {
      return res.status(400).json({ code: 'NO_TARGET_SELECTED', message: 'No target tenant selected. Please select a target tenant first.' });
    }
    const results = await numberRangeService.migrate(sourceTenant, targetTenant, names.map((name) => name.trim()));
    res.json({ results });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, migrate };
