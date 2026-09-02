// const TargetTenantModel = require('../models/TargetTenant.model');
// const cfClient = require('../services/cfClient.service');
// const encrypt = require('../utils/encrypt');
// const tokenCache = require('../services/tokenCache.service');
// /**
//  * POST /api/tenants/target
//  * Saves (or updates) the caller's CF tenant connection details, then tests
//  * the connection and persists the resulting status.
//  */
// async function connect(req, res, next) {
//   try {
//     const {
//       tenantName,
//       host,
//       tokenHost,
//       oauthClientId,
//       oauthClientSecret,
//       tgtDomain,
//       cfOrgId,
//       spaceName,
//     } = req.body;

//     if (!host || !tokenHost || !oauthClientId || !oauthClientSecret) {
//       return res.status(400).json({
//         message: 'host, tokenHost, oauthClientId and oauthClientSecret are required',
//       });
//     }

//     const oauthClientSecretEnc = encrypt.encrypt(oauthClientSecret);

//     // const targetTenantId = await TargetTenantModel.upsert({
//     //   userId: req.user.userId,
//     //   tenantName,
//     //   host,
//     //   tokenHost,
//     //   oauthClientId,
//     //   oauthClientSecretEnc,
//     //   tgtDomain,
//     //   cfOrgId,
//     //   spaceName,
//     // });

//     // const tenant = await TargetTenantModel.findByUser(req.user.userId);
//     // const result = await cfClient.testConnection(tenant);
//     const targetTenantId = await TargetTenantModel.upsert({
//       userId: req.user.userId,
//       tenantName,
//       host,
//       tokenHost,
//       oauthClientId,
//       oauthClientSecretEnc,
//       tgtDomain,
//       cfOrgId,
//       spaceName,
//     });

//     // Same reasoning as the source tenant: clear any cached token from the
//     // OLD credentials before testing the newly-saved ones.
//     tokenCache.clear(`target:${targetTenantId}`);

//     const tenant = await TargetTenantModel.findByUser(req.user.userId);
//     const result = await cfClient.testConnection(tenant);
//     await TargetTenantModel.setConnectionStatus(targetTenantId, result.success ? 'CONNECTED' : 'ERROR');

//     res.status(result.success ? 200 : 502).json({
//       targetTenantId,
//       connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
//       message: result.success ? 'Connected to target tenant' : result.message,
//     });
//   } catch (err) {
//     next(err);
//   }
// }

// /** GET /api/tenants/target - returns saved tenant info (secret masked). */
// async function getStatus(req, res, next) {
//   try {
//     const tenant = await TargetTenantModel.findByUser(req.user.userId);
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

// /** POST /api/tenants/target/test - re-test an already-saved connection. */
// // async function testExisting(req, res, next) {
// //   try {
// //     const tenant = await TargetTenantModel.findByUser(req.user.userId);
// //     if (!tenant) return res.status(404).json({ message: 'No target tenant configured yet' });

// //     const result = await cfClient.testConnection(tenant);
// async function testExisting(req, res, next) {
//   try {
//     const tenant = await TargetTenantModel.findByUser(req.user.userId);
//     if (!tenant) return res.status(404).json({ message: 'No target tenant configured yet' });

//     tokenCache.clear(`target:${tenant.TARGETTENANTID}`);

//     const result = await cfClient.testConnection(tenant);
//     await TargetTenantModel.setConnectionStatus(tenant.TARGETTENANTID, result.success ? 'CONNECTED' : 'ERROR');

//     res.status(result.success ? 200 : 502).json({
//       connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
//       message: result.success ? 'Connection healthy' : result.message,
//     });
//   } catch (err) {
//     next(err);
//   }
// }

// module.exports = { connect, getStatus, testExisting };


const TargetTenantModel = require('../models/TargetTenant.model');
const UserTenantSelectionModel = require('../models/UserTenantSelection.model');
const cfClient = require('../services/cfClient.service');
const tokenCache = require('../services/tokenCache.service');
const encrypt = require('../utils/encrypt');
const tenantDeletionService = require('../services/tenantDeletion.service');

/** GET /api/tenants/target — list every CF tenant this user has added. */
async function list(req, res, next) {
  try {
    const [tenants, selection] = await Promise.all([
      TargetTenantModel.listByUser(req.user.userId),
      UserTenantSelectionModel.getSelection(req.user.userId),
    ]);

    const selectedId = selection?.TARGETTENANTID || null;

    res.json({
      tenants: tenants.map((t) => ({
        targetTenantId: t.TARGETTENANTID,
        tenantName: t.TENANTNAME,
        host: t.HOST,
        connectionStatus: t.CONNECTIONSTATUS,
        lastTestedAt: t.LASTTESTEDAT,
        selected: t.TARGETTENANTID === selectedId,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/tenants/target/:id — single tenant's non-secret fields, for prefilling the Reconfigure form. */
async function getOne(req, res, next) {
  try {
    const tenant = await TargetTenantModel.findById(req.params.id, req.user.userId);
    if (!tenant) return res.status(404).json({ message: 'Target tenant not found' });

    res.json({
      targetTenantId: tenant.TARGETTENANTID,
      tenantName: tenant.TENANTNAME,
      host: tenant.HOST,
      tokenHost: tenant.TOKENHOST,
      oauthClientId: tenant.OAUTHCLIENTID,
      tgtDomain: tenant.TGTDOMAIN,
      cfOrgId: tenant.CFORGID,
      spaceName: tenant.SPACENAME,
      connectionStatus: tenant.CONNECTIONSTATUS,
      lastTestedAt: tenant.LASTTESTEDAT,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/tenants/target — always adds a NEW tenant, tests it, returns its id + status. */
async function create(req, res, next) {
  try {
    const { tenantName, host, tokenHost, oauthClientId, oauthClientSecret, tgtDomain, cfOrgId, spaceName } =
      req.body;

    if (!host || !tokenHost || !oauthClientId || !oauthClientSecret) {
      return res.status(400).json({
        message: 'host, tokenHost, oauthClientId and oauthClientSecret are required',
      });
    }

    const oauthClientSecretEnc = encrypt.encrypt(oauthClientSecret);

    const targetTenantId = await TargetTenantModel.create({
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

    const result = await testAndPersist(targetTenantId, req.user.userId);
    res.status(result.success ? 201 : 502).json({
      targetTenantId,
      connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
      message: result.success ? 'Connected to target tenant' : result.message,
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/tenants/target/:id — updates an EXISTING tenant's credentials ("Reconfigure"). */
async function update(req, res, next) {
  try {
    const { tenantName, host, tokenHost, oauthClientId, oauthClientSecret, tgtDomain, cfOrgId, spaceName } =
      req.body;

    if (!host || !tokenHost || !oauthClientId || !oauthClientSecret) {
      return res.status(400).json({
        message: 'host, tokenHost, oauthClientId and oauthClientSecret are required',
      });
    }

    const existing = await TargetTenantModel.findById(req.params.id, req.user.userId);
    if (!existing) return res.status(404).json({ message: 'Target tenant not found' });

    const oauthClientSecretEnc = encrypt.encrypt(oauthClientSecret);

    await TargetTenantModel.update(req.params.id, req.user.userId, {
      tenantName,
      host,
      tokenHost,
      oauthClientId,
      oauthClientSecretEnc,
      tgtDomain,
      cfOrgId,
      spaceName,
    });

    const result = await testAndPersist(req.params.id, req.user.userId);
    res.status(result.success ? 200 : 502).json({
      targetTenantId: req.params.id,
      connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
      message: result.success ? 'Connected to target tenant' : result.message,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/tenants/target/:id/test — re-test one specific tenant. */
async function test(req, res, next) {
  try {
    const tenant = await TargetTenantModel.findById(req.params.id, req.user.userId);
    if (!tenant) return res.status(404).json({ message: 'Target tenant not found' });

    const result = await testAndPersist(req.params.id, req.user.userId);
    res.status(result.success ? 200 : 502).json({
      connectionStatus: result.success ? 'CONNECTED' : 'ERROR',
      message: result.success ? 'Connection healthy' : result.message,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/tenants/target/:id/select — marks this tenant as the active target for migrating. */
async function select(req, res, next) {
  try {
    const tenant = await TargetTenantModel.findById(req.params.id, req.user.userId);
    if (!tenant) return res.status(404).json({ message: 'Target tenant not found' });

    await UserTenantSelectionModel.setTargetTenant(req.user.userId, req.params.id);
    res.json({ selected: true, targetTenantId: req.params.id });
  } catch (err) {
    next(err);
  }
}

async function testAndPersist(targetTenantId, userId) {
  tokenCache.clear(`target:${targetTenantId}`);
  const tenant = await TargetTenantModel.findById(targetTenantId, userId);
  const result = await cfClient.testConnection(tenant);
  await TargetTenantModel.setConnectionStatus(targetTenantId, result.success ? 'CONNECTED' : 'ERROR');
  return result;
}
/** DELETE /api/tenants/target/:id — removes the tenant and every migration that used it. */
async function remove(req, res, next) {
  try {
    const tenant = await TargetTenantModel.findById(req.params.id, req.user.userId);
    if (!tenant) return res.status(404).json({ message: 'Target tenant not found' });

    await tenantDeletionService.deleteTargetTenant(req.params.id, req.user.userId);
    res.json({ deleted: true, targetTenantId: req.params.id });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, test, select, remove };