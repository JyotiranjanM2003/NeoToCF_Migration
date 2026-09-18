const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'PASSWORD_RESET_TOKEN';

async function create({ userId, tokenHash, expiresAt, requestIp }) {
  const id = uuidv4();
  await query(
    `INSERT INTO ${TABLE} (Id, UserId, TokenHash, ExpiresAt, Used, CreatedAt, RequestIp)
     VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, ?)`,
    [id, userId, tokenHash, expiresAt, requestIp || null]
  );
  return { id, userId, tokenHash, expiresAt };
}

/** Returns the token row only if it exists, is unused, and hasn't expired. */
async function findValidByHash(tokenHash) {
  const rows = await query(
    `SELECT * FROM ${TABLE} WHERE TokenHash = ? AND Used = 0 AND ExpiresAt > CURRENT_TIMESTAMP`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function markUsed(id) {
  await query(`UPDATE ${TABLE} SET Used = 1 WHERE Id = ?`, [id]);
}

/** Invalidates every still-live token for a user (called on new request + on successful reset). */
async function invalidateAllForUser(userId) {
  await query(`UPDATE ${TABLE} SET Used = 1 WHERE UserId = ? AND Used = 0`, [userId]);
}

async function deleteExpired() {
  await query(`DELETE FROM ${TABLE} WHERE ExpiresAt <= CURRENT_TIMESTAMP`);
}

module.exports = { create, findValidByHash, markUsed, invalidateAllForUser, deleteExpired };