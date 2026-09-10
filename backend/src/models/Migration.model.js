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

/**
 * Latest migration outcome per variable (keyed by ArtifactId = "variableName::integrationFlow")
 * for this user + target tenant. Joins MIGRATION_ARTIFACT to get per-variable granularity.
 * Used by GET /api/variables/list to show the Status column without an extra round-trip.
 *
 * Only VARIABLE-scoped migrations are included (ScopeType = 'VARIABLE').
 */
async function latestStatusByVariableForUser(userId, targetTenantId) {
  return query(
    `SELECT ma.ArtifactId, ma.ArtifactName, ma.Status, ma.StartedAt, ma.CompletedAt
     FROM (
       SELECT ma2.ArtifactId, ma2.ArtifactName, ma2.Status, m2.StartedAt, m2.CompletedAt,
              ROW_NUMBER() OVER (PARTITION BY ma2.ArtifactId ORDER BY m2.StartedAt DESC) AS RowNum
       FROM MIGRATION_ARTIFACT ma2
       INNER JOIN MIGRATION m2 ON m2.MigrationId = ma2.MigrationId
       WHERE m2.UserId = ? AND m2.TargetTenantId = ? AND m2.ScopeType = 'VARIABLE'
     ) ma
     WHERE ma.RowNum = 1`,
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

/**
 * Most recent STANDALONE (non-batch) RUNNING migration for this user —
 * backs the "continue watching migration" prompt on the Packages page for
 * a migration started via "Migrate whole package" or a single-iFlow
 * "Migrate" button, as opposed to a batch (see MigrationBatch.model.js's
 * findActiveForUser for that case).
 */
async function findActiveForUser(userId) {
  const rows = await query(
    `SELECT TOP 1 * FROM ${TABLE} WHERE UserId = ? AND Status = 'RUNNING' AND BatchId IS NULL ORDER BY StartedAt DESC`,
    [userId]
  );
  return rows[0] || null;
}
module.exports = { create, setStatus, findById, listForUser, listForBatch, latestStatusByPackageForUser, latestStatusByVariableForUser, listBySourceTenant, listByTargetTenant, deleteById, findActiveForUser };