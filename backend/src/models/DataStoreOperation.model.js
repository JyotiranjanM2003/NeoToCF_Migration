const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'DATASTORE_OPERATION';

/**
 * Creates a PENDING row for one data-store operation and returns its Id.
 */
async function create({
  migrationId,
  migrationArtifactId = null,
  userId,
  sourceTenantId,
  targetTenantId,
  dataStoreName,
  integrationFlow = '',
  dataStoreType = '',
  entryId = '',
  helperFlowId = '',
  expiryPeriodDays = null,
  alertPeriodDays = null,
  entryCount = null,
}) {
  const id = uuidv4();
  await query(
    `INSERT INTO ${TABLE}
       (Id, MigrationId, MigrationArtifactId, UserId, SourceTenantId, TargetTenantId,
        DataStoreName, IntegrationFlow, DataStoreType, EntryId, HelperFlowId,
        ExpiryPeriodDays, AlertPeriodDays, EntryCount, Status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      id,
      migrationId,
      migrationArtifactId,
      userId,
      sourceTenantId,
      targetTenantId,
      dataStoreName,
      integrationFlow,
      dataStoreType,
      entryId,
      helperFlowId,
      expiryPeriodDays,
      alertPeriodDays,
      entryCount,
    ]
  );
  return id;
}

async function markRunning(id) {
  await query(`UPDATE ${TABLE} SET Status = 'RUNNING' WHERE Id = ?`, [id]);
}

async function complete(id, status, errorMessage = null) {
  await query(
    `UPDATE ${TABLE} SET Status = ?, ErrorMessage = ?, CompletedAt = CURRENT_TIMESTAMP WHERE Id = ?`,
    [status, errorMessage, id]
  );
}

/** Most recent operations for a user, newest first. */
async function listForUser(userId, limit = 50) {
  return query(
    `SELECT * FROM ${TABLE} WHERE UserId = ? ORDER BY StartedAt DESC LIMIT ?`,
    [userId, limit]
  );
}

/** Full history for one data store (across all runs). */
async function listForDataStore(userId, dataStoreName, integrationFlow = '') {
  return query(
    `SELECT * FROM ${TABLE}
     WHERE UserId = ? AND DataStoreName = ? AND IntegrationFlow = ?
     ORDER BY StartedAt DESC`,
    [userId, dataStoreName, integrationFlow]
  );
}

/** All data-store operation rows tied to one migration run (for a report page). */
async function listForMigration(migrationId) {
  return query(`SELECT * FROM ${TABLE} WHERE MigrationId = ? ORDER BY StartedAt ASC`, [migrationId]);
}

/**
 * Returns the most recent SUCCESSFUL migration of this exact data store
 * (name + flow) to this exact target tenant, or null if never migrated
 * successfully before. Used for duplicate-migration detection.
 */
async function findLatestSuccess(userId, targetTenantId, dataStoreName, integrationFlow = '') {
  const rows = await query(
    `SELECT * FROM ${TABLE}
     WHERE UserId = ? AND TargetTenantId = ? AND DataStoreName = ? AND IntegrationFlow = ?
       AND Status = 'SUCCESS'
     ORDER BY CompletedAt DESC
     LIMIT 1`,
    [userId, targetTenantId, dataStoreName, integrationFlow]
  );
  return rows[0] || null;
}

module.exports = {
  create,
  markRunning,
  complete,
  listForUser,
  listForDataStore,
  listForMigration,
  findLatestSuccess,
};