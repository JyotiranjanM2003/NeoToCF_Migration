// const SourceTenantModel = require('../models/SourceTenant.model');
// const neoClient = require('../services/neoClient.service');
// const encrypt = require('../utils/encrypt');
// const tokenCache = require('../services/tokenCache.service');
// /**
//  * POST /api/tenants/source
//  * Saves (or updates) the caller's Neo tenant connection details, then tests
//  * the connection and persists the resulting status.
//  */
// async function connect(req, res, next) {
//   try {
//     const { tenantName, host, tokenHost, oauthClientId, oauthClientSecret, srcDomain, srcAccountId } = req.body;

//     if (!host || !tokenHost || !oauthClientId || !oauthClientSecret) {
//       return res.status(400).json({
//         message: 'host, tokenHost, oauthClientId and oauthClientSecret are required',
//       });
//     }

//     const oauthClientSecretEnc = encrypt.encrypt(oauthClientSecret);

//     const sourceTenantId = await SourceTenantModel.upsert({
//       userId: req.user.userId,
//       tenantName,
//       host,
//       tokenHost,
//       oauthClientId,
//       oauthClientSecretEnc,
//       srcDomain,
//       srcAccountId,
//     });

//     // Credentials just changed — any cached token from the OLD credentials
//     // must not be reused, or a wrong password here would silently "pass"
//     // using a still-valid token from a previous successful connection.
//     tokenCache.clear(`source:${sourceTenantId}`);
//     const tenant = await SourceTenantModel.findByUser(req.user.userId);
//     const result = await neoClient.testConnection(tenant);

//     await SourceTenantModel.setConnectionStatus(sourceTenantId, result.success ? 'CONNECTED' : 'ERROR');

//     res.status(result.success ? 200 : 502).json({
//       sourceTenantId,
//       connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
//       message: result.success ? 'Connected to source tenant' : result.message,
//     });
//   } catch (err) {
//     next(err);
//   }
// }

// /** GET /api/tenants/source - returns saved tenant info (secret masked). */
// async function getStatus(req, res, next) {
//   try {
//     const tenant = await SourceTenantModel.findByUser(req.user.userId);
//     if (!tenant) return res.json({ connected: false });

//     res.json({
//       connected: tenant.CONNECTIONSTATUS === 'CONNECTED',
//       tenantName: tenant.TENANTNAME,
//       host: tenant.HOST,
//       connectionStatus: tenant.CONNECTIONSTATUS,
//       lastTestedAt: tenant.LASTTESTEDAT,
//     });
//   } catch (err) {
//     next(err);
//   }
// }

// /** POST /api/tenants/source/test - re-test an already-saved connection. */
// // async function testExisting(req, res, next) {
// //   try {
// //     const tenant = await SourceTenantModel.findByUser(req.user.userId);
// //     if (!tenant) return res.status(404).json({ message: 'No source tenant configured yet' });

// //     const result = await neoClient.testConnection(tenant);
// async function testExisting(req, res, next) {
//   try {
//     const tenant = await SourceTenantModel.findByUser(req.user.userId);
//     if (!tenant) return res.status(404).json({ message: 'No source tenant configured yet' });

//     // Force a real re-check rather than trusting a cached token that might
//     // outlive credentials revoked on SAP's side.
//     tokenCache.clear(`source:${tenant.SOURCETENANTID}`);

//     const result = await neoClient.testConnection(tenant);
//     await SourceTenantModel.setConnectionStatus(tenant.SOURCETENANTID, result.success ? 'CONNECTED' : 'ERROR');

//     res.status(result.success ? 200 : 502).json({
//       connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
//       message: result.success ? 'Connection healthy' : result.message,
//     });
//   } catch (err) {
//     next(err);
//   }
// }

// module.exports = { connect, getStatus, testExisting };


const SourceTenantModel = require('../models/SourceTenant.model');
const UserTenantSelectionModel = require('../models/UserTenantSelection.model');
const neoClient = require('../services/neoClient.service');
const tokenCache = require('../services/tokenCache.service');
const encrypt = require('../utils/encrypt');

/** GET /api/tenants/source — list every Neo tenant this user has added. */
async function list(req, res, next) {
  try {
    const [tenants, selection] = await Promise.all([
      SourceTenantModel.listByUser(req.user.userId),
      UserTenantSelectionModel.getSelection(req.user.userId),
    ]);

    const selectedId = selection?.SOURCETENANTID || null;

    res.json({
      tenants: tenants.map((t) => ({
        sourceTenantId: t.SOURCETENANTID,
        tenantName: t.TENANTNAME,
        host: t.HOST,
        connectionStatus: t.CONNECTIONSTATUS,
        lastTestedAt: t.LASTTESTEDAT,
        selected: t.SOURCETENANTID === selectedId,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/tenants/source/:id — single tenant's non-secret fields, for prefilling the Reconfigure form. */
async function getOne(req, res, next) {
  try {
    const tenant = await SourceTenantModel.findById(req.params.id, req.user.userId);
    if (!tenant) return res.status(404).json({ message: 'Source tenant not found' });

    res.json({
      sourceTenantId: tenant.SOURCETENANTID,
      tenantName: tenant.TENANTNAME,
      host: tenant.HOST,
      tokenHost: tenant.TOKENHOST,
      oauthClientId: tenant.OAUTHCLIENTID,
      srcDomain: tenant.SRCDOMAIN,
      srcAccountId: tenant.SRCACCOUNTID,
      connectionStatus: tenant.CONNECTIONSTATUS,
      lastTestedAt: tenant.LASTTESTEDAT,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/tenants/source — always adds a NEW tenant, tests it, returns its id + status. */
async function create(req, res, next) {
  try {
    const { tenantName, host, tokenHost, oauthClientId, oauthClientSecret, srcDomain, srcAccountId } = req.body;

    if (!host || !tokenHost || !oauthClientId || !oauthClientSecret) {
      return res.status(400).json({
        message: 'host, tokenHost, oauthClientId and oauthClientSecret are required',
      });
    }

    const oauthClientSecretEnc = encrypt.encrypt(oauthClientSecret);

    const sourceTenantId = await SourceTenantModel.create({
      userId: req.user.userId,
      tenantName,
      host,
      tokenHost,
      oauthClientId,
      oauthClientSecretEnc,
      srcDomain,
      srcAccountId,
    });

    const result = await testAndPersist(sourceTenantId, req.user.userId);
    res.status(result.success ? 201 : 502).json({
      sourceTenantId,
      connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
      message: result.success ? 'Connected to source tenant' : result.message,
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/tenants/source/:id — updates an EXISTING tenant's credentials ("Reconfigure"). */
async function update(req, res, next) {
  try {
    const { tenantName, host, tokenHost, oauthClientId, oauthClientSecret, srcDomain, srcAccountId } = req.body;

    if (!host || !tokenHost || !oauthClientId || !oauthClientSecret) {
      return res.status(400).json({
        message: 'host, tokenHost, oauthClientId and oauthClientSecret are required',
      });
    }

    const existing = await SourceTenantModel.findById(req.params.id, req.user.userId);
    if (!existing) return res.status(404).json({ message: 'Source tenant not found' });

    const oauthClientSecretEnc = encrypt.encrypt(oauthClientSecret);

    await SourceTenantModel.update(req.params.id, req.user.userId, {
      tenantName,
      host,
      tokenHost,
      oauthClientId,
      oauthClientSecretEnc,
      srcDomain,
      srcAccountId,
    });

    const result = await testAndPersist(req.params.id, req.user.userId);
    res.status(result.success ? 200 : 502).json({
      sourceTenantId: req.params.id,
      connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
      message: result.success ? 'Connected to source tenant' : result.message,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/tenants/source/:id/test — re-test one specific tenant. */
async function test(req, res, next) {
  try {
    const tenant = await SourceTenantModel.findById(req.params.id, req.user.userId);
    if (!tenant) return res.status(404).json({ message: 'Source tenant not found' });

    const result = await testAndPersist(req.params.id, req.user.userId);
    res.status(result.success ? 200 : 502).json({
      connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
      message: result.success ? 'Connection healthy' : result.message,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/tenants/source/:id/select — marks this tenant as the active source for browsing/migrating. */
async function select(req, res, next) {
  try {
    const tenant = await SourceTenantModel.findById(req.params.id, req.user.userId);
    if (!tenant) return res.status(404).json({ message: 'Source tenant not found' });

    await UserTenantSelectionModel.setSourceTenant(req.user.userId, req.params.id);
    res.json({ selected: true, sourceTenantId: req.params.id });
  } catch (err) {
    next(err);
  }
}

/**
 * Clears any cached OAuth/XSRF token for this tenant (credentials just
 * changed, so a stale token from the old ones must not be reused), then
 * runs a real connectivity test and persists the result.
 */
async function testAndPersist(sourceTenantId, userId) {
  tokenCache.clear(`source:${sourceTenantId}`);
  const tenant = await SourceTenantModel.findById(sourceTenantId, userId);
  const result = await neoClient.testConnection(tenant);
  await SourceTenantModel.setConnectionStatus(sourceTenantId, result.success ? 'CONNECTED' : 'ERROR');
  return result;
}

module.exports = { list, getOne, create, update, test, select };