const UserTenantSelectionModel = require('../models/UserTenantSelection.model');
const SourceTenantModel = require('../models/SourceTenant.model');
const TargetTenantModel = require('../models/TargetTenant.model');

/**
 * Resolves the user's currently-selected source and target tenant rows.
 * Either (or both) may come back null if nothing is selected yet, or if the
 * selected tenant was since deleted — callers decide what that means for
 * their endpoint (e.g. package browsing only needs source; migrating needs
 * both).
 */
async function getSelectedTenants(userId) {
  const selection = await UserTenantSelectionModel.getSelection(userId);
  if (!selection) return { sourceTenant: null, targetTenant: null };

  const [sourceTenant, targetTenant] = await Promise.all([
    selection.SOURCETENANTID ? SourceTenantModel.findById(selection.SOURCETENANTID, userId) : null,
    selection.TARGETTENANTID ? TargetTenantModel.findById(selection.TARGETTENANTID, userId) : null,
  ]);

  return { sourceTenant, targetTenant };
}

module.exports = { getSelectedTenants };