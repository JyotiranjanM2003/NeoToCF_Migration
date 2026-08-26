const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'APP_USER';

async function createUser({ email, passwordHash, fullName }) {
  const userId = uuidv4();
  await query(
    `INSERT INTO ${TABLE} (UserId, Email, PasswordHash, FullName, CreatedAt)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [userId, email.toLowerCase(), passwordHash, fullName || null]
  );
  return { userId, email: email.toLowerCase(), fullName };
}

async function findByEmail(email) {
  const rows = await query(`SELECT * FROM ${TABLE} WHERE Email = ?`, [email.toLowerCase()]);
  return rows[0] || null;
}

async function findById(userId) {
  const rows = await query(`SELECT * FROM ${TABLE} WHERE UserId = ?`, [userId]);
  return rows[0] || null;
}

async function touchLastLogin(userId) {
  await query(`UPDATE ${TABLE} SET LastLoginAt = CURRENT_TIMESTAMP WHERE UserId = ?`, [userId]);
}

module.exports = { createUser, findByEmail, findById, touchLastLogin };
