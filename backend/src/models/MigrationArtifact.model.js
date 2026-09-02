const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'MIGRATION_ARTIFACT';

async function create({ migrationId, artifactId, artifactName, artifactType, version }) {
  const id = uuidv4();
  await query(
    `INSERT INTO ${TABLE} (Id, MigrationId, ArtifactId, ArtifactName, ArtifactType, Version, Status)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
    [id, migrationId, artifactId, artifactName, artifactType, version]
  );
  return id;
}

async function setStatus(id, status, errorMessage = null) {
  await query(`UPDATE ${TABLE} SET Status = ?, ErrorMessage = ? WHERE Id = ?`, [status, errorMessage, id]);
}

async function listForMigration(migrationId) {
  return query(`SELECT * FROM ${TABLE} WHERE MigrationId = ?`, [migrationId]);
}

async function deleteForMigration(migrationId) {
  await query(`DELETE FROM ${TABLE} WHERE MigrationId = ?`, [migrationId]);
}

module.exports = { create, setStatus, listForMigration, deleteForMigration };
