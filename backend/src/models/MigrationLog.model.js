const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'MIGRATION_LOG';

async function log(migrationId, step, status, message = null) {
  const id = uuidv4();
  await query(
    `INSERT INTO ${TABLE} (Id, MigrationId, Step, Status, Message, Timestamp)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [id, migrationId, step, status, message]
  );
  return id;
}

async function listForMigration(migrationId) {
  return query(`SELECT * FROM ${TABLE} WHERE MigrationId = ? ORDER BY Timestamp ASC`, [migrationId]);
}

module.exports = { log, listForMigration };
