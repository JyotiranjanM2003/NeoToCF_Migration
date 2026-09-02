const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'MIGRATION';

async function create({ userId, sourceTenantId, targetTenantId, packageName, scopeType, batchId = null }) {
  const migrationId = uuidv4();
  await query(
    `INSERT INTO ${TABLE}
       (MigrationId, UserId, SourceTenantId, TargetTenantId, PackageName, ScopeType, Status, StartedAt, BatchId)
     VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', CURRENT_TIMESTAMP, ?)`,
    [migrationId, userId, sourceTenantId, targetTenantId, packageName, scopeType, batchId]
  );
  return migrationId;
}

async function setStatus(migrationId, status, { completed = false } = {}) {
  if (completed) {
    await query(`UPDATE ${TABLE} SET Status = ?, CompletedAt = CURRENT_TIMESTAMP WHERE MigrationId = ?`, [
      status,
      migrationId,
    ]);
  } else {
    await query(`UPDATE ${TABLE} SET Status = ? WHERE MigrationId = ?`, [status, migrationId]);
  }
}

async function findById(migrationId, userId) {
  const rows = await query(`SELECT * FROM ${TABLE} WHERE MigrationId = ? AND UserId = ?`, [migrationId, userId]);
  return rows[0] || null;
}

async function listForUser(userId, limit = 50) {
  return query(`SELECT TOP ${Number(limit)} * FROM ${TABLE} WHERE UserId = ? ORDER BY StartedAt DESC`, [userId]);
}

/** All per-package migrations that belong to one batch, in the order they were started. */
async function listForBatch(batchId, userId) {
  return query(`SELECT * FROM ${TABLE} WHERE BatchId = ? AND UserId = ? ORDER BY StartedAt ASC`, [batchId, userId]);
}

// module.exports = { create, setStatus, findById, listForUser, listForBatch };
/**
 * Latest migration record per package (by PackageName, which stores the
 * CPI package's technical ID) for this user + target tenant. Used to show
 * "already migrated" on the Packages list without re-querying the tenant.
 * Only whole-package runs count here (not single-artifact migrations),
 * since "package migrated" should reflect a whole-package run.
 */
async function latestStatusByPackageForUser(userId, targetTenantId) {
  return query(
    `SELECT PackageName, Status, StartedAt, CompletedAt FROM (
       SELECT PackageName, Status, StartedAt, CompletedAt,
              ROW_NUMBER() OVER (PARTITION BY PackageName ORDER BY StartedAt DESC) AS RowNum
       FROM ${TABLE}
       WHERE UserId = ? AND TargetTenantId = ? AND ScopeType = 'PACKAGE'
     ) ranked
     WHERE RowNum = 1`,
    [userId, targetTenantId]
  );
}

async function listBySourceTenant(sourceTenantId) {
  return query(`SELECT * FROM ${TABLE} WHERE SourceTenantId = ?`, [sourceTenantId]);
}

async function listByTargetTenant(targetTenantId) {
  return query(`SELECT * FROM ${TABLE} WHERE TargetTenantId = ?`, [targetTenantId]);
}

async function deleteById(migrationId) {
  await query(`DELETE FROM ${TABLE} WHERE MigrationId = ?`, [migrationId]);
}

module.exports = { create, setStatus, findById, listForUser, listForBatch, latestStatusByPackageForUser, listBySourceTenant, listByTargetTenant, deleteById};