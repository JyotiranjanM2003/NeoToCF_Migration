const SourceTenantModel = require('../models/SourceTenant.model');
const neoClient = require('../services/neoClient.service');
const encrypt = require('../utils/encrypt');

/**
 * POST /api/tenants/source
 * Saves (or updates) the caller's Neo tenant connection details, then tests
 * the connection and persists the resulting status.
 */
async function connect(req, res, next) {
  try {
    const { tenantName, host, tokenHost, oauthClientId, oauthClientSecret, srcDomain, srcAccountId } = req.body;

    if (!host || !tokenHost || !oauthClientId || !oauthClientSecret) {
      return res.status(400).json({
        message: 'host, tokenHost, oauthClientId and oauthClientSecret are required',
      });
    }

    const oauthClientSecretEnc = encrypt.encrypt(oauthClientSecret);

    const sourceTenantId = await SourceTenantModel.upsert({
      userId: req.user.userId,
      tenantName,
      host,
      tokenHost,
      oauthClientId,
      oauthClientSecretEnc,
      srcDomain,
      srcAccountId,
    });

    const tenant = await SourceTenantModel.findByUser(req.user.userId);
    const result = await neoClient.testConnection(tenant);

    await SourceTenantModel.setConnectionStatus(sourceTenantId, result.success ? 'CONNECTED' : 'ERROR');

    res.status(result.success ? 200 : 502).json({
      sourceTenantId,
      connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
      message: result.success ? 'Connected to source tenant' : result.message,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/tenants/source - returns saved tenant info (secret masked). */
async function getStatus(req, res, next) {
  try {
    const tenant = await SourceTenantModel.findByUser(req.user.userId);
    if (!tenant) return res.json({ connected: false });

    res.json({
      connected: tenant.CONNECTIONSTATUS === 'CONNECTED',
      tenantName: tenant.TENANTNAME,
      host: tenant.HOST,
      connectionStatus: tenant.CONNECTIONSTATUS,
      lastTestedAt: tenant.LASTTESTEDAT,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/tenants/source/test - re-test an already-saved connection. */
async function testExisting(req, res, next) {
  try {
    const tenant = await SourceTenantModel.findByUser(req.user.userId);
    if (!tenant) return res.status(404).json({ message: 'No source tenant configured yet' });

    const result = await neoClient.testConnection(tenant);
    await SourceTenantModel.setConnectionStatus(tenant.SOURCETENANTID, result.success ? 'CONNECTED' : 'ERROR');

    res.status(result.success ? 200 : 502).json({
      connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
      message: result.success ? 'Connection healthy' : result.message,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { connect, getStatus, testExisting };
