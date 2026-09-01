const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'MIGRATION_BATCH';

async function create({ userId, sourceTenantId, targetTenantId }) {
  const batchId = uuidv4();
  await query(
    `INSERT INTO ${TABLE} (BatchId, UserId, SourceTenantId, TargetTenantId, Status, StartedAt)
     VALUES (?, ?, ?, ?, 'RUNNING', CURRENT_TIMESTAMP)`,
    [batchId, userId, sourceTenantId, targetTenantId]
  );
  return batchId;
}

async function setStatus(batchId, status, { completed = false } = {}) {
  if (completed) {
    await query(`UPDATE ${TABLE} SET Status = ?, CompletedAt = CURRENT_TIMESTAMP WHERE BatchId = ?`, [
      status,
      batchId,
    ]);
  } else {
    await query(`UPDATE ${TABLE} SET Status = ? WHERE BatchId = ?`, [status, batchId]);
  }
}

async function findById(batchId, userId) {
  const rows = await query(`SELECT * FROM ${TABLE} WHERE BatchId = ? AND UserId = ?`, [batchId, userId]);
  return rows[0] || null;
}

/** Used by the "continue watching migration" prompt on the Packages page. */
async function findActiveForUser(userId) {
  const rows = await query(
    `SELECT TOP 1 * FROM ${TABLE} WHERE UserId = ? AND Status = 'RUNNING' ORDER BY StartedAt DESC`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = { create, setStatus, findById, findActiveForUser };