const { query } = require('../config/db');

/** One row per migration run that has a package-level identity (PACKAGE / SINGLE_ARTIFACT). */
async function listMigrationsForTenantPair(sourceHost, targetHost) {
  return query(
    `SELECT MigrationId, PackageName, ScopeType, Status, StartedAt, CompletedAt
     FROM MIGRATION
     WHERE SourceHost = ? AND TargetHost = ?
     ORDER BY StartedAt DESC`,
    [sourceHost, targetHost]
  );
}

/** One row per individual artifact (iFlow, variable, data store, number range, security category). */
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