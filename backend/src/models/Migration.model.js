const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'MIGRATION';

async function create({ userId, sourceTenantId, targetTenantId, packageName, scopeType }) {
  const migrationId = uuidv4();
  await query(
    `INSERT INTO ${TABLE}
       (MigrationId, UserId, SourceTenantId, TargetTenantId, PackageName, ScopeType, Status, StartedAt)
     VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', CURRENT_TIMESTAMP)`,
    [migrationId, userId, sourceTenantId, targetTenantId, packageName, scopeType]
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

module.exports = { create, setStatus, findById, listForUser };
