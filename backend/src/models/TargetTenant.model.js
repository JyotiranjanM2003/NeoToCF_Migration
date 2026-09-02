// const { v4: uuidv4 } = require('uuid');
// const { query } = require('../config/db');

// const TABLE = 'TARGET_TENANT';

// async function upsert({
//   userId,
//   tenantName,
//   host,
//   tokenHost,
//   oauthClientId,
//   oauthClientSecretEnc,
//   tgtDomain,
//   cfOrgId,
//   spaceName,
// }) {
//   const existing = await findByUser(userId);
//   if (existing) {
//     await query(
//       `UPDATE ${TABLE} SET TenantName = ?, Host = ?, TokenHost = ?, OAuthClientId = ?,
//          OAuthClientSecretEnc = ?, TgtDomain = ?, CfOrgId = ?, SpaceName = ?, ConnectionStatus = 'DISCONNECTED'
//        WHERE TargetTenantId = ?`,
//       [tenantName, host, tokenHost, oauthClientId, oauthClientSecretEnc, tgtDomain, cfOrgId, spaceName, existing.TARGETTENANTID]
//     );
//     return existing.TARGETTENANTID;
//   }
//   const id = uuidv4();
//   await query(
//     `INSERT INTO ${TABLE}
//        (TargetTenantId, UserId, TenantName, Host, TokenHost, OAuthClientId, OAuthClientSecretEnc,
//         TgtDomain, CfOrgId, SpaceName, ConnectionStatus, CreatedAt)
//      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISCONNECTED', CURRENT_TIMESTAMP)`,
//     [id, userId, tenantName, host, tokenHost, oauthClientId, oauthClientSecretEnc, tgtDomain, cfOrgId, spaceName]
//   );
//   return id;
// }

// async function findByUser(userId) {
//   const rows = await query(`SELECT * FROM ${TABLE} WHERE UserId = ?`, [userId]);
//   return rows[0] || null;
// }

// async function setConnectionStatus(targetTenantId, status) {
//   await query(
//     `UPDATE ${TABLE} SET ConnectionStatus = ?, LastTestedAt = CURRENT_TIMESTAMP WHERE TargetTenantId = ?`,
//     [status, targetTenantId]
//   );
// }

// module.exports = { upsert, findByUser, setConnectionStatus };


const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'TARGET_TENANT';

/** Always inserts a new tenant row — used by "Add target tenant". */
async function create({
  userId,
  tenantName,
  host,
  tokenHost,
  oauthClientId,
  oauthClientSecretEnc,
  tgtDomain,
  cfOrgId,
  spaceName,
}) {
  const id = uuidv4();
  await query(
    `INSERT INTO ${TABLE}
       (TargetTenantId, UserId, TenantName, Host, TokenHost, OAuthClientId, OAuthClientSecretEnc,
        TgtDomain, CfOrgId, SpaceName, ConnectionStatus, CreatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISCONNECTED', CURRENT_TIMESTAMP)`,
    [id, userId, tenantName, host, tokenHost, oauthClientId, oauthClientSecretEnc, tgtDomain, cfOrgId, spaceName]
  );
  return id;
}

/** Updates one existing tenant row in place — used by "Reconfigure". */
async function update(
  targetTenantId,
  userId,
  { tenantName, host, tokenHost, oauthClientId, oauthClientSecretEnc, tgtDomain, cfOrgId, spaceName }
) {
  await query(
    `UPDATE ${TABLE} SET TenantName = ?, Host = ?, TokenHost = ?, OAuthClientId = ?,
       OAuthClientSecretEnc = ?, TgtDomain = ?, CfOrgId = ?, SpaceName = ?, ConnectionStatus = 'DISCONNECTED'
     WHERE TargetTenantId = ? AND UserId = ?`,
    [tenantName, host, tokenHost, oauthClientId, oauthClientSecretEnc, tgtDomain, cfOrgId, spaceName, targetTenantId, userId]
  );
}

async function listByUser(userId) {
  return query(`SELECT * FROM ${TABLE} WHERE UserId = ? ORDER BY CreatedAt ASC`, [userId]);
}

async function findById(targetTenantId, userId) {
  const rows = await query(`SELECT * FROM ${TABLE} WHERE TargetTenantId = ? AND UserId = ?`, [
    targetTenantId,
    userId,
  ]);
  return rows[0] || null;
}

async function setConnectionStatus(targetTenantId, status) {
  await query(
    `UPDATE ${TABLE} SET ConnectionStatus = ?, LastTestedAt = CURRENT_TIMESTAMP WHERE TargetTenantId = ?`,
    [status, targetTenantId]
  );
}

async function deleteById(targetTenantId, userId) {
  await query(`DELETE FROM ${TABLE} WHERE TargetTenantId = ? AND UserId = ?`, [targetTenantId, userId]);
}


module.exports = { create, update, listByUser, findById, setConnectionStatus, deleteById };
//module.exports = { create, update, listByUser, findById, setConnectionStatus };