const { query } = require('../config/db');

const TABLE = 'USER_TENANT_SELECTION';

async function getSelection(userId) {
  const rows = await query(`SELECT * FROM ${TABLE} WHERE UserId = ?`, [userId]);
  return rows[0] || null;
}

/** Sets the active source tenant, leaving whatever target was selected (if any) untouched. */
async function setSourceTenant(userId, sourceTenantId) {
  const existing = await getSelection(userId);
  if (existing) {
    await query(`UPDATE ${TABLE} SET SourceTenantId = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE UserId = ?`, [
      sourceTenantId,
      userId,
    ]);
  } else {
    await query(
      `INSERT INTO ${TABLE} (UserId, SourceTenantId, TargetTenantId, UpdatedAt) VALUES (?, ?, NULL, CURRENT_TIMESTAMP)`,
      [userId, sourceTenantId]
    );
  }
}

/** Sets the active target tenant, leaving whatever source was selected (if any) untouched. */
async function setTargetTenant(userId, targetTenantId) {
  const existing = await getSelection(userId);
  if (existing) {
    await query(`UPDATE ${TABLE} SET TargetTenantId = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE UserId = ?`, [
      targetTenantId,
      userId,
    ]);
  } else {
    await query(
      `INSERT INTO ${TABLE} (UserId, SourceTenantId, TargetTenantId, UpdatedAt) VALUES (?, NULL, ?, CURRENT_TIMESTAMP)`,
      [userId, targetTenantId]
    );
  }
}

module.exports = { getSelection, setSourceTenant, setTargetTenant };