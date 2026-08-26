const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'TRANSFORM_RULE';

async function create({ userId, ruleName, findValue, replaceValue, parameterScope }) {
  const id = uuidv4();
  await query(
    `INSERT INTO ${TABLE} (Id, UserId, RuleName, FindValue, ReplaceValue, ParameterScope, IsActive, CreatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    [id, userId, ruleName, findValue, replaceValue, parameterScope || null]
  );
  return id;
}

async function listActiveForUser(userId) {
  return query(`SELECT * FROM ${TABLE} WHERE UserId = ? AND IsActive = 1`, [userId]);
}

async function remove(id, userId) {
  await query(`DELETE FROM ${TABLE} WHERE Id = ? AND UserId = ?`, [id, userId]);
}

module.exports = { create, listActiveForUser, remove };
