const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'MIGRATION_CONFIGURATION';

async function create({ migrationArtifactId, parameterName, parameterDataType, sourceValue, targetValue, status }) {
  const id = uuidv4();
  await query(
    `INSERT INTO ${TABLE}
       (Id, MigrationArtifactId, ParameterName, ParameterDataType, SourceValue, TargetValue, Status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, migrationArtifactId, parameterName, parameterDataType, sourceValue, targetValue, status || 'PENDING']
  );
  return id;
}

async function setStatus(id, status) {
  await query(`UPDATE ${TABLE} SET Status = ? WHERE Id = ?`, [status, id]);
}

async function listForArtifact(migrationArtifactId) {
  return query(`SELECT * FROM ${TABLE} WHERE MigrationArtifactId = ?`, [migrationArtifactId]);
}
/** Deletes every configuration row belonging to any artifact of this migration. */
async function deleteForMigration(migrationId) {
  await query(
    `DELETE FROM ${TABLE} WHERE MigrationArtifactId IN (SELECT Id FROM MIGRATION_ARTIFACT WHERE MigrationId = ?)`,
    [migrationId]
  );
}
module.exports = { create, setStatus, listForArtifact, deleteForMigration };
