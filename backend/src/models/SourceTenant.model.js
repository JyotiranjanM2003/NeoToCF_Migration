// const { v4: uuidv4 } = require('uuid');
// const { query } = require('../config/db');

// const TABLE = 'SOURCE_TENANT';

// async function upsert({
//   userId,
//   tenantName,
//   host,
//   tokenHost,
//   oauthClientId,
//   oauthClientSecretEnc,
//   srcDomain,
//   srcAccountId,
// }) {
//   const existing = await findByUser(userId);
//   if (existing) {
//     await query(
//       `UPDATE ${TABLE} SET TenantName = ?, Host = ?, TokenHost = ?, OAuthClientId = ?,
//          OAuthClientSecretEnc = ?, SrcDomain = ?, SrcAccountId = ?, ConnectionStatus = 'DISCONNECTED'
//        WHERE SourceTenantId = ?`,
//       [tenantName, host, tokenHost, oauthClientId, oauthClientSecretEnc, srcDomain, srcAccountId, existing.SOURCETENANTID]
//     );
//     return existing.SOURCETENANTID;
//   }
//   const id = uuidv4();
//   await query(
//     `INSERT INTO ${TABLE}
//        (SourceTenantId, UserId, TenantName, Host, TokenHost, OAuthClientId, OAuthClientSecretEnc,
//         SrcDomain, SrcAccountId, ConnectionStatus, CreatedAt)
//      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISCONNECTED', CURRENT_TIMESTAMP)`,
//     [id, userId, tenantName, host, tokenHost, oauthClientId, oauthClientSecretEnc, srcDomain, srcAccountId]
//   );
//   return id;
// }

// async function findByUser(userId) {
//   const rows = await query(`SELECT * FROM ${TABLE} WHERE UserId = ?`, [userId]);
//   return rows[0] || null;
// }

// async function setConnectionStatus(sourceTenantId, status) {
//   await query(
//     `UPDATE ${TABLE} SET ConnectionStatus = ?, LastTestedAt = CURRENT_TIMESTAMP WHERE SourceTenantId = ?`,
//     [status, sourceTenantId]
//   );
// }

// module.exports = { upsert, findByUser, setConnectionStatus };



const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'SOURCE_TENANT';

/** Always inserts a new tenant row — used by "Add source tenant". */
async function create({
  userId,
  tenantName,
  host,
  tokenHost,
  oauthClientId,
  oauthClientSecretEnc,
  srcDomain,
  srcAccountId,
}) {
  const id = uuidv4();
  await query(
    `INSERT INTO ${TABLE}
       (SourceTenantId, UserId, TenantName, Host, TokenHost, OAuthClientId, OAuthClientSecretEnc,
        SrcDomain, SrcAccountId, ConnectionStatus, CreatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISCONNECTED', CURRENT_TIMESTAMP)`,
    [id, userId, tenantName, host, tokenHost, oauthClientId, oauthClientSecretEnc, srcDomain, srcAccountId]
  );
  return id;
}

/** Updates one existing tenant row in place — used by "Reconfigure". */
async function update(
  sourceTenantId,
  userId,
  { tenantName, host, tokenHost, oauthClientId, oauthClientSecretEnc, srcDomain, srcAccountId }
) {
  await query(
    `UPDATE ${TABLE} SET TenantName = ?, Host = ?, TokenHost = ?, OAuthClientId = ?,
       OAuthClientSecretEnc = ?, SrcDomain = ?, SrcAccountId = ?, ConnectionStatus = 'DISCONNECTED'
     WHERE SourceTenantId = ? AND UserId = ?`,
    [tenantName, host, tokenHost, oauthClientId, oauthClientSecretEnc, srcDomain, srcAccountId, sourceTenantId, userId]
  );
}

async function listByUser(userId) {
  return query(`SELECT * FROM ${TABLE} WHERE UserId = ? ORDER BY CreatedAt ASC`, [userId]);
}

async function findById(sourceTenantId, userId) {
  const rows = await query(`SELECT * FROM ${TABLE} WHERE SourceTenantId = ? AND UserId = ?`, [
    sourceTenantId,
    userId,
  ]);
  return rows[0] || null;
}

async function setConnectionStatus(sourceTenantId, status) {
  await query(
    `UPDATE ${TABLE} SET ConnectionStatus = ?, LastTestedAt = CURRENT_TIMESTAMP WHERE SourceTenantId = ?`,
    [status, sourceTenantId]
  );
}

module.exports = { create, update, listByUser, findById, setConnectionStatus };