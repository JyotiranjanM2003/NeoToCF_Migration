const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const TABLE = 'SOURCE_TENANT';

async function upsert({
  userId,
  tenantName,
  host,
  tokenHost,
  oauthClientId,
  oauthClientSecretEnc,
  srcDomain,
  srcAccountId,
}) {
  const existing = await findByUser(userId);
  if (existing) {
    await query(
      `UPDATE ${TABLE} SET TenantName = ?, Host = ?, TokenHost = ?, OAuthClientId = ?,
         OAuthClientSecretEnc = ?, SrcDomain = ?, SrcAccountId = ?, ConnectionStatus = 'DISCONNECTED'
       WHERE SourceTenantId = ?`,
      [tenantName, host, tokenHost, oauthClientId, oauthClientSecretEnc, srcDomain, srcAccountId, existing.SOURCETENANTID]
    );
    return existing.SOURCETENANTID;
  }
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

async function findByUser(userId) {
  const rows = await query(`SELECT * FROM ${TABLE} WHERE UserId = ?`, [userId]);
  return rows[0] || null;
}

async function setConnectionStatus(sourceTenantId, status) {
  await query(
    `UPDATE ${TABLE} SET ConnectionStatus = ?, LastTestedAt = CURRENT_TIMESTAMP WHERE SourceTenantId = ?`,
    [status, sourceTenantId]
  );
}

module.exports = { upsert, findByUser, setConnectionStatus };
