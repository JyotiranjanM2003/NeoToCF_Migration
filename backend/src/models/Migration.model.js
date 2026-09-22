const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'MIGRATION';

// async function create({ userId, sourceTenantId, targetTenantId, packageName, scopeType, batchId = null }) {
//   const migrationId = uuidv4();
//   await query(
//     `INSERT INTO ${TABLE}
//        (MigrationId, UserId, SourceTenantId, TargetTenantId, PackageName, ScopeType, Status, StartedAt, BatchId)
//      VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', CURRENT_TIMESTAMP, ?)`,
//     [migrationId, userId, sourceTenantId, targetTenantId, packageName, scopeType, batchId]
//   );
//   return migrationId;
// }

async function create({ userId, sourceTenantId, targetTenantId, sourceHost, targetHost, packageName, scopeType, batchId = null }) {
  const migrationId = uuidv4();

  // Guard: if sourceHost/targetHost weren't passed in (undefined/null), look
  // them up from the tenant tables so the columns are never written as NULL.
  // This makes every call site resilient to a missing property on the tenant
  // object regardless of how the tenant was fetched.
  let resolvedSourceHost = sourceHost || null;
  let resolvedTargetHost = targetHost || null;

  if (!resolvedSourceHost || !resolvedTargetHost) {
    const lookups = await Promise.all([
      !resolvedSourceHost
        ? query(`SELECT Host FROM SOURCE_TENANT WHERE SourceTenantId = ?`, [sourceTenantId])
        : Promise.resolve([]),
      !resolvedTargetHost
        ? query(`SELECT Host FROM TARGET_TENANT WHERE TargetTenantId = ?`, [targetTenantId])
        : Promise.resolve([]),
    ]);
    if (!resolvedSourceHost && lookups[0][0]) resolvedSourceHost = lookups[0][0].HOST;
    if (!resolvedTargetHost && lookups[1][0]) resolvedTargetHost = lookups[1][0].HOST;
  }

  await query(
    `INSERT INTO ${TABLE}
       (MigrationId, UserId, SourceTenantId, TargetTenantId, SourceHost, TargetHost, PackageName, ScopeType, Status, StartedAt, BatchId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RUNNING', CURRENT_TIMESTAMP, ?)`,
    [migrationId, userId, sourceTenantId, targetTenantId, resolvedSourceHost, resolvedTargetHost, packageName, scopeType, batchId]
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
// async function latestStatusByPackageForUser(userId, targetTenantId) {
//   return query(
//     `SELECT PackageName, Status, StartedAt, CompletedAt FROM (
//        SELECT PackageName, Status, StartedAt, CompletedAt,
//               ROW_NUMBER() OVER (PARTITION BY PackageName ORDER BY StartedAt DESC) AS RowNum
//        FROM ${TABLE}
//        WHERE UserId = ? AND TargetTenantId = ? AND ScopeType = 'PACKAGE'
//      ) ranked
//      WHERE RowNum = 1`,
//     [userId, targetTenantId]
//   );
// }

// /**
//  * Latest migration outcome per variable (keyed by ArtifactId = "variableName::integrationFlow")
//  * for this user + target tenant. Joins MIGRATION_ARTIFACT to get per-variable granularity.
//  * Used by GET /api/variables/list to show the Status column without an extra round-trip.
//  *
//  * Only VARIABLE-scoped migrations are included (ScopeType = 'VARIABLE').
//  */
// async function latestStatusByVariableForUser(userId, targetTenantId) {
//   return query(
//     `SELECT ma.ArtifactId, ma.ArtifactName, ma.Status, ma.StartedAt, ma.CompletedAt
//      FROM (
//        SELECT ma2.ArtifactId, ma2.ArtifactName, ma2.Status, m2.StartedAt, m2.CompletedAt,
//               ROW_NUMBER() OVER (PARTITION BY ma2.ArtifactId ORDER BY m2.StartedAt DESC) AS RowNum
//        FROM MIGRATION_ARTIFACT ma2
//        INNER JOIN MIGRATION m2 ON m2.MigrationId = ma2.MigrationId
//        WHERE m2.UserId = ? AND m2.TargetTenantId = ? AND m2.ScopeType = 'VARIABLE'
//      ) ma
//      WHERE ma.RowNum = 1`,
//     [userId, targetTenantId]
//   );
// }
/**
 * Latest per-artifact migration status for every artifact inside a given
 * package, for a specific target host. Covers both SINGLE_ARTIFACT runs
 * (user migrated individual iFlows) and PACKAGE runs (whole package was
 * migrated at once). The most recent attempt per ArtifactId wins.
 *
 * Used to enrich the PackageDetail artifact list with MIGRATED / FAILED /
 * NOT MIGRATED per row instead of the source tenant's Active/Draft status.
 */
/**
 * Latest per-artifact migration status for every artifact inside a given
 * package, scoped by the real source/target tenant hostnames so results are
 * shared across all users pointing at the same real tenant pair.
 */
async function latestArtifactStatusByPackageForTenantPair(sourceHost, targetHost, packageName) {
  return query(
    `SELECT ma.ArtifactId, ma.ArtifactName, ma.Status, ma.ErrorMessage,
            m.StartedAt, m.CompletedAt
     FROM (
       SELECT ma2.ArtifactId, ma2.ArtifactName, ma2.Status, ma2.ErrorMessage, ma2.MigrationId,
              ROW_NUMBER() OVER (
                PARTITION BY ma2.ArtifactId
                ORDER BY m2.StartedAt DESC
              ) AS rn
       FROM MIGRATION_ARTIFACT ma2
       INNER JOIN MIGRATION m2 ON m2.MigrationId = ma2.MigrationId
       WHERE m2.SourceHost = ?
         AND m2.TargetHost = ?
         AND m2.PackageName = ?
         AND m2.ScopeType IN ('SINGLE_ARTIFACT', 'PACKAGE')
     ) ma
     INNER JOIN MIGRATION m ON m.MigrationId = ma.MigrationId
     WHERE ma.rn = 1`,
    [sourceHost, targetHost, packageName]
  );
}

/**
 * Latest whole-package migration status per package for this source/target
 * host pair, across ALL users — shared view of what has been migrated to
 * this real target tenant.
 */
async function latestStatusByPackageForTenantPair(sourceHost, targetHost) {
  return query(
    `SELECT PackageName, Status, StartedAt, CompletedAt FROM (
       SELECT PackageName, Status, StartedAt, CompletedAt,
              ROW_NUMBER() OVER (PARTITION BY PackageName ORDER BY StartedAt DESC) AS RowNum
       FROM ${TABLE}
       WHERE SourceHost = ?
         AND TargetHost = ?
         AND ScopeType = 'PACKAGE'
     ) ranked
     WHERE RowNum = 1`,
    [sourceHost, targetHost]
  );
}

/**
 * Per-artifact migration counts per package from SINGLE_ARTIFACT runs,
 * scoped by host pair. Returns raw counts so the caller can compare against
 * the live total to compute MIGRATED / PARTIAL / FAILED correctly.
 */
async function derivedPackageStatusFromArtifactsForTenantPair(sourceHost, targetHost) {
  return query(
    `SELECT
       m.PackageName,
       SUM(CASE WHEN latest.Status = 'MIGRATED' THEN 1 ELSE 0 END) AS MigratedCount,
       SUM(CASE WHEN latest.Status = 'FAILED'   THEN 1 ELSE 0 END) AS FailedCount,
       COUNT(latest.ArtifactId)                                     AS TotalAttempted,
       MAX(m.CompletedAt) AS CompletedAt,
       MAX(m.StartedAt)   AS StartedAt
     FROM (
       SELECT ma.ArtifactId, ma.Status, ma.MigrationId,
              ROW_NUMBER() OVER (
                PARTITION BY ma.ArtifactId
                ORDER BY m2.StartedAt DESC
              ) AS rn
       FROM MIGRATION_ARTIFACT ma
       INNER JOIN ${TABLE} m2 ON m2.MigrationId = ma.MigrationId
       WHERE m2.SourceHost = ?
         AND m2.TargetHost = ?
         AND m2.ScopeType = 'SINGLE_ARTIFACT'
     ) latest
     INNER JOIN ${TABLE} m ON m.MigrationId = latest.MigrationId
     WHERE latest.rn = 1
     GROUP BY m.PackageName`,
    [sourceHost, targetHost]
  );
}

/**
 * Most recent MIGRATION_ARTIFACT row per ArtifactId for a given ScopeType
 * and host pair. Shared across all users of the same real tenant pair.
 */
async function _latestArtifactStatusForTenantPair(sourceHost, targetHost, scopeType) {
  return query(
    `SELECT ma.ArtifactId, ma.ArtifactName, ma.Status, ma.StartedAt, ma.CompletedAt
     FROM (
       SELECT ma2.ArtifactId, ma2.ArtifactName, ma2.Status, m2.StartedAt, m2.CompletedAt,
              ROW_NUMBER() OVER (PARTITION BY ma2.ArtifactId ORDER BY m2.StartedAt DESC) AS RowNum
       FROM MIGRATION_ARTIFACT ma2
       INNER JOIN MIGRATION m2 ON m2.MigrationId = ma2.MigrationId
       WHERE m2.SourceHost = ?
         AND m2.TargetHost = ?
         AND m2.ScopeType = ?
     ) ma
     WHERE ma.RowNum = 1`,
    [sourceHost, targetHost, scopeType]
  );
}

function latestStatusByVariableForTenantPair(sourceHost, targetHost) {
  return _latestArtifactStatusForTenantPair(sourceHost, targetHost, 'VARIABLE');
}

function latestStatusByDataStoreForTenantPair(sourceHost, targetHost) {
  return _latestArtifactStatusForTenantPair(sourceHost, targetHost, 'DATASTORE');
}

function latestStatusByNumberRangeForTenantPair(sourceHost, targetHost) {
  return _latestArtifactStatusForTenantPair(sourceHost, targetHost, 'NUMBER_RANGE');
}

function latestStatusBySecurityForTenantPair(sourceHost, targetHost) {
  return _latestArtifactStatusForTenantPair(sourceHost, targetHost, 'SECURITY');
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
//module.exports = { create, setStatus, findById, listForUser, listForBatch, latestStatusByPackageForUser, latestStatusByVariableForUser, listBySourceTenant, listByTargetTenant, deleteById, findActiveForUser };
//module.exports = { create, setStatus, findById, listForUser, listForBatch, latestStatusByPackageForTargetHost, latestStatusByVariableForTargetHost, listBySourceTenant, listByTargetTenant, deleteById, findActiveForUser };
module.exports = {
  create, setStatus, findById, listForUser, listForBatch,
  latestArtifactStatusByPackageForTenantPair,
  latestStatusByPackageForTenantPair,
  derivedPackageStatusFromArtifactsForTenantPair,
  latestStatusByVariableForTenantPair,
  latestStatusByDataStoreForTenantPair,
  latestStatusByNumberRangeForTenantPair,
  latestStatusBySecurityForTenantPair,
  listBySourceTenant, listByTargetTenant, deleteById, findActiveForUser
};
