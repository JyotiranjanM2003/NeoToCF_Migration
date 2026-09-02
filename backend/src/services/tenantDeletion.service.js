const MigrationModel = require('../models/Migration.model');
const MigrationArtifactModel = require('../models/MigrationArtifact.model');
const MigrationConfigurationModel = require('../models/MigrationConfiguration.model');
const MigrationLogModel = require('../models/MigrationLog.model');
const MigrationBatchModel = require('../models/MigrationBatch.model');
const UserTenantSelectionModel = require('../models/UserTenantSelection.model');
const SourceTenantModel = require('../models/SourceTenant.model');
const TargetTenantModel = require('../models/TargetTenant.model');

/**
 * Deletes a source tenant and everything that references it: every
 * migration run against it (configs → artifacts → logs → the migration
 * row itself), any batch rows, the user's selection if it pointed here,
 * and finally the tenant row. Children are removed before parents to
 * respect FK constraints.
 */
async function deleteSourceTenant(sourceTenantId, userId) {
  const migrations = await MigrationModel.listBySourceTenant(sourceTenantId);
  for (const m of migrations) {
    await MigrationConfigurationModel.deleteForMigration(m.MIGRATIONID);
    await MigrationArtifactModel.deleteForMigration(m.MIGRATIONID);
    await MigrationLogModel.deleteForMigration(m.MIGRATIONID);
    await MigrationModel.deleteById(m.MIGRATIONID);
  }

  await MigrationBatchModel.deleteForSourceTenant(sourceTenantId);
  await UserTenantSelectionModel.clearSourceIfSelected(userId, sourceTenantId);
  await SourceTenantModel.deleteById(sourceTenantId, userId);
}

/** Same idea, for a target tenant. */
async function deleteTargetTenant(targetTenantId, userId) {
  const migrations = await MigrationModel.listByTargetTenant(targetTenantId);
  for (const m of migrations) {
    await MigrationConfigurationModel.deleteForMigration(m.MIGRATIONID);
    await MigrationArtifactModel.deleteForMigration(m.MIGRATIONID);
    await MigrationLogModel.deleteForMigration(m.MIGRATIONID);
    await MigrationModel.deleteById(m.MIGRATIONID);
  }

  await MigrationBatchModel.deleteForTargetTenant(targetTenantId);
  await UserTenantSelectionModel.clearTargetIfSelected(userId, targetTenantId);
  await TargetTenantModel.deleteById(targetTenantId, userId);
}

module.exports = { deleteSourceTenant, deleteTargetTenant };