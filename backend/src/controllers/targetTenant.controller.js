const TargetTenantModel = require('../models/TargetTenant.model');
const cfClient = require('../services/cfClient.service');
const encrypt = require('../utils/encrypt');
const tokenCache = require('../services/tokenCache.service');
/**
 * POST /api/tenants/target
 * Saves (or updates) the caller's CF tenant connection details, then tests
 * the connection and persists the resulting status.
 */
async function connect(req, res, next) {
  try {
    const {
      tenantName,
      host,
      tokenHost,
      oauthClientId,
      oauthClientSecret,
      tgtDomain,
      cfOrgId,
      spaceName,
    } = req.body;

    if (!host || !tokenHost || !oauthClientId || !oauthClientSecret) {
      return res.status(400).json({
        message: 'host, tokenHost, oauthClientId and oauthClientSecret are required',
      });
    }

    const oauthClientSecretEnc = encrypt.encrypt(oauthClientSecret);

    // const targetTenantId = await TargetTenantModel.upsert({
    //   userId: req.user.userId,
    //   tenantName,
    //   host,
    //   tokenHost,
    //   oauthClientId,
    //   oauthClientSecretEnc,
    //   tgtDomain,
    //   cfOrgId,
    //   spaceName,
    // });

    // const tenant = await TargetTenantModel.findByUser(req.user.userId);
    // const result = await cfClient.testConnection(tenant);
    const targetTenantId = await TargetTenantModel.upsert({
      userId: req.user.userId,
      tenantName,
      host,
      tokenHost,
      oauthClientId,
      oauthClientSecretEnc,
      tgtDomain,
      cfOrgId,
      spaceName,
    });

    // Same reasoning as the source tenant: clear any cached token from the
    // OLD credentials before testing the newly-saved ones.
    tokenCache.clear(`target:${targetTenantId}`);

    const tenant = await TargetTenantModel.findByUser(req.user.userId);
    const result = await cfClient.testConnection(tenant);
    await TargetTenantModel.setConnectionStatus(targetTenantId, result.success ? 'CONNECTED' : 'ERROR');

    res.status(result.success ? 200 : 502).json({
      targetTenantId,
      connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
      message: result.success ? 'Connected to target tenant' : result.message,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/tenants/target - returns saved tenant info (secret masked). */
async function getStatus(req, res, next) {
  try {
    const tenant = await TargetTenantModel.findByUser(req.user.userId);
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

/** POST /api/tenants/target/test - re-test an already-saved connection. */
// async function testExisting(req, res, next) {
//   try {
//     const tenant = await TargetTenantModel.findByUser(req.user.userId);
//     if (!tenant) return res.status(404).json({ message: 'No target tenant configured yet' });

//     const result = await cfClient.testConnection(tenant);
async function testExisting(req, res, next) {
  try {
    const tenant = await TargetTenantModel.findByUser(req.user.userId);
    if (!tenant) return res.status(404).json({ message: 'No target tenant configured yet' });

    tokenCache.clear(`target:${tenant.TARGETTENANTID}`);

    const result = await cfClient.testConnection(tenant);
    await TargetTenantModel.setConnectionStatus(tenant.TARGETTENANTID, result.success ? 'CONNECTED' : 'ERROR');

    res.status(result.success ? 200 : 502).json({
      connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
      message: result.success ? 'Connection healthy' : result.message,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { connect, getStatus, testExisting };
