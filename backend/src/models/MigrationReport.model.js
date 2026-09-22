const { query } = require('../config/db');

/**
 * All migration runs for a source/target host pair, across ALL users.
 * Scoping by hostname (not per-user UUID) means any user who points at the
 * same real tenant pair sees the full shared migration history.
 */
async function listMigrationsForTenantPair(sourceHost, targetHost) {
  return query(
    `SELECT MigrationId, PackageName, ScopeType, Status, StartedAt, CompletedAt
     FROM MIGRATION
     WHERE SourceHost = ? AND TargetHost = ?
     ORDER BY StartedAt DESC`,
    [sourceHost, targetHost]
  );
}

/** All artifact rows for a source/target host pair, across ALL users. */
async function listArtifactsForTenantPair(sourceHost, targetHost) {
  return query(
    `SELECT ma.Id, ma.MigrationId, ma.ArtifactId, ma.ArtifactName, ma.ArtifactType,
            ma.Version, ma.Status, ma.ErrorMessage,
            m.ScopeType, m.PackageName, m.StartedAt, m.CompletedAt
     FROM MIGRATION_ARTIFACT ma
     INNER JOIN MIGRATION m ON m.MigrationId = ma.MigrationId
     WHERE m.SourceHost = ? AND m.TargetHost = ?
     ORDER BY m.StartedAt DESC`,
    [sourceHost, targetHost]
  );
}

module.exports = { listMigrationsForTenantPair, listArtifactsForTenantPair };
