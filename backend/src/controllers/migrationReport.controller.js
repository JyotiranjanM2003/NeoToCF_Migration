const tenantSelection = require('../services/tenantSelection.service');
const migrationReportService = require('../services/migrationReport.service');

async function getReport(req, res, next) {
  try {
    const { sourceTenant, targetTenant } = await tenantSelection.getSelectedTenants(req.user.userId);
    if (!sourceTenant) {
      return res.status(400).json({ code: 'NO_SOURCE_SELECTED', message: 'No source tenant selected. Please select a source tenant first.' });
    }
    if (!targetTenant) {
      return res.status(400).json({ code: 'NO_TARGET_SELECTED', message: 'No target tenant selected. Please select a target tenant first.' });
    }

    // Pass host strings (not per-user UUIDs) so the report is shared across
    // all users who point at the same real tenant pair.
    const report = await migrationReportService.buildReport(
      sourceTenant.HOST,
      targetTenant.HOST,
      sourceTenant
    );
    res.json({ sourceHost: sourceTenant.HOST, targetHost: targetTenant.HOST, ...report });
  } catch (err) {
    next(err);
  }
}

module.exports = { getReport };
