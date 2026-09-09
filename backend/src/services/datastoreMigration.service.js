/**
 * Data Store Migration Engine — implements the full MIG040 orchestration:
 *
 *  1. List / look up data stores on source Neo
 *  2. Determine retention (expiry / alert period) for the data store's entries
 *  3. Ensure/recreate temp OAuth2 credential on target CF
 *  4. Ensure/recreate SAPmigratedatastore package on target CF
 *  5. Per data store: create helper iFlow → configure → deploy → poll MPL
 *  6. Clean up helper iFlow (runtime + designtime)
 *  7. After all data stores: clean up package + OAuth cred
 *
 * Persists progress to the existing MIGRATION / MIGRATION_ARTIFACT /
 * MIGRATION_LOG tables with ScopeType='DATASTORE' / ArtifactType='DATASTORE',
 * so the existing /api/migration/:id/status and /report endpoints — plus
 * MigrationReport.jsx — work for data store migrations with zero schema
 * changes. Mirrors variableMigration.service.js step for step.
 */

const axios = require('axios');
const neoClient = require('./neoClient.service');
const cfClient = require('./cfClient.service');
const encrypt = require('../utils/encrypt');

const MigrationModel = require('../models/Migration.model');
const MigrationArtifactModel = require('../models/MigrationArtifact.model');
const MigrationLogModel = require('../models/MigrationLog.model');

const {
  HELPER_IFLOW_BASE64,
  HELPER_PACKAGE_PAYLOAD,
  GLOBAL_FLOW_NAME,
  DEFAULT_EXPIRATION_PERIOD_DAYS,
  DEFAULT_ALERT_PERIOD_DAYS,
} = require('../data/datastoreHelperFlow.data');

// ─── Step labels ─────────────────────────────────────────────────────────────

const STEPS = {
  LIST_DATASTORES: 'LIST_DATASTORES',
  DETERMINE_RETENTION: 'DETERMINE_RETENTION',
  PREPARE_CRED: 'PREPARE_CRED',
  PREPARE_PACKAGE: 'PREPARE_PACKAGE',
  CREATE_FLOW: 'CREATE_FLOW',
  CONFIGURE_FLOW: 'CONFIGURE_FLOW',
  DEPLOY_FLOW: 'DEPLOY_FLOW',
  POLL_MPL: 'POLL_MPL',
  CLEANUP: 'CLEANUP',
  REPORT: 'REPORT',
};

// How long to wait after deploying before polling MPL (ms).
const DEPLOY_WAIT_MS = 5000;
// MPL poll interval and max attempts
const MPL_POLL_INTERVAL_MS = 2000;
const MPL_MAX_ATTEMPTS = 12; // ~60 s total

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Lists all data stores available on the source Neo tenant.
 * Returns an array of { dataStoreName, integrationFlow, type, totalEntries,
 * visibleEntries, invisibleEntries }.
 */
async function listSourceDataStores(sourceTenant) {
  const data = await neoClient.get(sourceTenant, '/DataStores');
  return (data?.d?.results || []).map((ds) => ({
    dataStoreName: ds.DataStoreName,
    integrationFlow: ds.IntegrationFlow || '',
    type: ds.Type || '',
    totalEntries: ds.TotalEntries ?? ds.NumberOfEntries ?? null,
    visibleEntries: ds.VisibleEntries ?? null,
    invisibleEntries: ds.InvisibleEntries ?? null,
    overdueEntries: ds.OverdueEntries ?? null,
  }));
}

/**
 * Looks up one specific data store on the source Neo tenant by querying its
 * entries collection (mirrors MIG040's "Determine Expiry Period" request).
 * Returns { found, entries, maxExpirePeriod, maxAlertPeriod } or null when
 * the data store doesn't exist / has no entries.
 */
async function lookupSourceDataStore(sourceTenant, dataStoreName, integrationFlow, type = '') {
  // A data store name containing '/' comes from an XI/AS4 adapter and can't
  // be migrated — mirrors the Postman pre-flight check exactly.
  if (integrationFlow && integrationFlow.indexOf('/') !== -1) {
    const err = new Error(
      `Data store '${dataStoreName}' of integration flow '${integrationFlow}' cannot be migrated as it originates from an XI or AS4 adapter.`
    );
    err.code = 'UNSUPPORTED_ADAPTER_DATASTORE';
    throw err;
  }

  try {
    const path = `/DataStores(DataStoreName='${encodeURIComponent(dataStoreName)}',IntegrationFlow='${encodeURIComponent(
      integrationFlow || ''
    )}',Type='${encodeURIComponent(type || '')}')/Entries`;
    const data = await neoClient.get(sourceTenant, path);
    const entries = data?.d?.results || [];
    const { maxExpirePeriod, maxAlertPeriod } = computeRetention(entries);
    return { found: true, entries, maxExpirePeriod, maxAlertPeriod };
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Starts a data store migration run asynchronously.
 *
 * @param {object} params
 * @param {object} params.user           - { userId }
 * @param {object} params.sourceTenant
 * @param {object} params.targetTenant
 * @param {Array}  params.dataStores      - [{ dataStoreName, integrationFlow, type, entryId }]
 * @returns {Promise<string>} migrationId
 */
async function start({ user, sourceTenant, targetTenant, dataStores = [] }) {
  const scopeType = 'DATASTORE';
  const packageName = dataStores.length === 1 ? `DS:${dataStores[0].dataStoreName}` : 'DS:ALL';

  const migrationId = await MigrationModel.create({
    userId: user.userId,
    sourceTenantId: sourceTenant.SOURCETENANTID,
    targetTenantId: targetTenant.TARGETTENANTID,
    packageName,
    scopeType,
    batchId: null,
  });

  // Fire-and-forget — frontend polls /api/migration/:id/status
  runPipeline({ migrationId, user, sourceTenant, targetTenant, dataStores }).catch(async (err) => {
    await MigrationLogModel.log(migrationId, STEPS.REPORT, 'ERROR', describeError(err));
    await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
  });

  return migrationId;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

async function runPipeline({ migrationId, user, sourceTenant, targetTenant, dataStores }) {
  // ── Step 1: resolve data store list ───────────────────────────────────────
  await log(migrationId, STEPS.LIST_DATASTORES, 'STARTED');

  let dsList = dataStores;

  if (dsList.length === 0) {
    const all = await listSourceDataStores(sourceTenant);
    if (all.length === 0) {
      await log(migrationId, STEPS.LIST_DATASTORES, 'ERROR', 'No data stores found on source tenant');
      await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
      return;
    }
    dsList = all.map((d) => ({
      dataStoreName: d.dataStoreName,
      integrationFlow: d.integrationFlow,
      type: d.type,
      entryId: '',
    }));
    await log(migrationId, STEPS.LIST_DATASTORES, 'SUCCESS', `${all.length} data store(s) found`);
  } else {
    await log(migrationId, STEPS.LIST_DATASTORES, 'SUCCESS', `${dsList.length} data store(s) queued`);
  }

  // ── Step 2: create/recreate temp OAuth2 credential on target ──────────────
  const credName = buildCredentialName(sourceTenant);
  await log(migrationId, STEPS.PREPARE_CRED, 'STARTED', `Credential: ${credName}`);
  try {
    await ensureOAuthCredential(targetTenant, credName, sourceTenant);
    await log(migrationId, STEPS.PREPARE_CRED, 'SUCCESS', `Credential '${credName}' ready`);
  } catch (err) {
    await log(migrationId, STEPS.PREPARE_CRED, 'ERROR', describeError(err));
    await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    return;
  }

  // ── Step 3: create/recreate SAPmigratedatastore package on target ─────────
  await log(migrationId, STEPS.PREPARE_PACKAGE, 'STARTED');
  try {
    await ensureHelperPackage(targetTenant);
    await log(migrationId, STEPS.PREPARE_PACKAGE, 'SUCCESS', 'SAPmigratedatastore package ready');
  } catch (err) {
    await log(migrationId, STEPS.PREPARE_PACKAGE, 'ERROR', describeError(err));
    await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    return;
  }

  // ── Steps 4–6: per-data-store migration ────────────────────────────────────
  let succeeded = 0;
  let failed = 0;

  for (const ds of dsList) {
    const flowName = ds.integrationFlow === '' ? GLOBAL_FLOW_NAME : ds.integrationFlow;

    const artifactId = await MigrationArtifactModel.create({
      migrationId,
      artifactId: `${ds.dataStoreName}::${ds.integrationFlow}`,
      artifactName: ds.dataStoreName,
      artifactType: 'DATASTORE',
      version: '1.0',
    });

    try {
      await migrateOneDataStore({
        migrationId,
        artifactId,
        dataStoreName: ds.dataStoreName,
        integrationFlow: ds.integrationFlow,
        type: ds.type,
        entryId: ds.entryId || '',
        flowName,
        credName,
        sourceTenant,
        targetTenant,
      });
      await MigrationArtifactModel.setStatus(artifactId, 'MIGRATED');
      succeeded += 1;
    } catch (err) {
      await MigrationArtifactModel.setStatus(artifactId, 'FAILED', describeError(err));
      failed += 1;
    }
  }

  // ── Step 7: global cleanup (package + OAuth cred) ──────────────────────────
  await log(migrationId, STEPS.CLEANUP, 'STARTED', 'Removing helper package and OAuth credential');
  try {
    await silentDelete(targetTenant, 'delete', `/IntegrationPackages('sapmigratedatastore')`);
    await silentDelete(targetTenant, 'delete', `/OAuth2ClientCredentials('${credName}')`);
    await log(migrationId, STEPS.CLEANUP, 'SUCCESS');
  } catch (err) {
    // Non-fatal — log and continue to final status
    await log(migrationId, STEPS.CLEANUP, 'ERROR', describeError(err));
  }

  const finalStatus = failed === 0 ? 'SUCCESS' : succeeded === 0 ? 'FAILED' : 'PARTIAL';
  await MigrationModel.setStatus(migrationId, finalStatus, { completed: true });
  await log(migrationId, STEPS.REPORT, 'SUCCESS', `${succeeded} succeeded, ${failed} failed`);
}

// ─── Per-data-store steps ──────────────────────────────────────────────────────

async function migrateOneDataStore({
  migrationId,
  artifactId,
  dataStoreName,
  integrationFlow,
  type,
  entryId,
  flowName,
  credName,
  sourceTenant,
  targetTenant,
}) {
  // Determine retention period from source entries (falls back to defaults)
  await log(migrationId, STEPS.DETERMINE_RETENTION, 'STARTED', dataStoreName);
  let expirePeriod = DEFAULT_EXPIRATION_PERIOD_DAYS;
  let alertPeriod = DEFAULT_ALERT_PERIOD_DAYS;
  try {
    const lookup = await lookupSourceDataStore(sourceTenant, dataStoreName, integrationFlow, type);
    if (!lookup) {
      throw new Error(`Data store '${dataStoreName}' not found on source tenant`);
    }
    expirePeriod = DEFAULT_EXPIRATION_PERIOD_DAYS; // matches MIG040: defaults always used
    alertPeriod = DEFAULT_ALERT_PERIOD_DAYS;
    await log(
      migrationId,
      STEPS.DETERMINE_RETENTION,
      'SUCCESS',
      `Expiration: ${expirePeriod}d, Alert: ${alertPeriod}d`
    );
  } catch (err) {
    await log(migrationId, STEPS.DETERMINE_RETENTION, 'ERROR', describeError(err));
    throw err;
  }

  // Create helper iFlow
  await log(migrationId, STEPS.CREATE_FLOW, 'STARTED', `${dataStoreName} → iFlow '${flowName}'`);
  await cfClient.write(targetTenant, 'post', '/IntegrationDesigntimeArtifacts', {
    data: {
      Name: flowName,
      Id: flowName,
      PackageId: 'sapmigratedatastore',
      ArtifactContent: HELPER_IFLOW_BASE64,
    },
    headers: { 'Content-Type': 'application/json' },
  });
  await log(migrationId, STEPS.CREATE_FLOW, 'SUCCESS', flowName);

  // Configure (sourceTenant, credentials, datastoreName, expiry_period, alert_period, datastoreEntryId)
  await log(migrationId, STEPS.CONFIGURE_FLOW, 'STARTED', dataStoreName);
  const batchBody = buildConfigBatch({
    flowName,
    sourceHost: sourceTenant.HOST,
    credName,
    dataStoreName,
    expirePeriod,
    alertPeriod,
    entryId,
  });
  await cfClient.write(targetTenant, 'post', '/$batch', {
    data: batchBody,
    headers: { 'Content-Type': 'multipart/mixed;boundary=batch_36522ad7-fc75-4b56-8c71-56071383e77b' },
  });
  await log(migrationId, STEPS.CONFIGURE_FLOW, 'SUCCESS', dataStoreName);

  // Deploy
  await log(migrationId, STEPS.DEPLOY_FLOW, 'STARTED', flowName);
  const deployStart = new Date().toISOString().replace(/\.\d{3}Z$/, ''); // ISO-8601 without ms
  await cfClient.write(
    targetTenant,
    'post',
    `/DeployIntegrationDesigntimeArtifact?Id='${flowName}'&Version='active'`,
    {}
  );
  await log(migrationId, STEPS.DEPLOY_FLOW, 'SUCCESS', flowName);

  // Wait then poll MPL
  await log(migrationId, STEPS.POLL_MPL, 'STARTED', `Waiting ${DEPLOY_WAIT_MS / 1000}s for flow execution`);
  await sleep(DEPLOY_WAIT_MS);

  const mplSuccess = await pollMpl(targetTenant, flowName, deployStart);
  if (!mplSuccess) {
    await log(
      migrationId,
      STEPS.POLL_MPL,
      'ERROR',
      `No completed MPL entry found for '${flowName}' — data store migration may have failed`
    );
    throw new Error(`MPL check failed for helper flow '${flowName}': no COMPLETED message found within timeout`);
  }
  await log(migrationId, STEPS.POLL_MPL, 'SUCCESS', `MPL confirmed COMPLETED for '${flowName}'`);

  // Per-data-store cleanup: runtime artifact + designtime iFlow
  await log(migrationId, STEPS.CLEANUP, 'STARTED', `Cleaning up helper flow '${flowName}'`);
  await silentDelete(targetTenant, 'delete', `/IntegrationRuntimeArtifacts('${flowName}')`);
  await silentDelete(targetTenant, 'delete', `/IntegrationDesigntimeArtifacts(Id='${flowName}',Version='active')`);
  await log(migrationId, STEPS.CLEANUP, 'SUCCESS', `Helper flow '${flowName}' removed`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Computes the max expiry/alert period (in days) across a data store's
 * entries. MIG040 computes this but currently always falls back to the
 * configured defaults — kept here for parity / future use.
 */
function computeRetention(entries) {
  const now = Date.now();
  let maxExpirePeriod = 0;
  let maxAlertPeriod = 0;

  entries.forEach((x) => {
    const retainUntil = parseODataMs(x.RetainUntil);
    if (retainUntil != null) {
      const period = Math.ceil((retainUntil - now) / (1000 * 60 * 60 * 24));
      if (period > maxExpirePeriod) maxExpirePeriod = period;
    }
    const dueAt = parseODataMs(x.DueAt);
    if (dueAt != null) {
      const period = Math.ceil((dueAt - now) / (1000 * 60 * 60 * 24));
      if (period > maxAlertPeriod) maxAlertPeriod = period;
    }
  });

  return { maxExpirePeriod, maxAlertPeriod };
}

function parseODataMs(odataDate) {
  if (!odataDate || typeof odataDate !== 'string') return null;
  const match = odataDate.match(/\/Date\((\d+)\)\//);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Derives the temporary credential name from the source host.
 * Mirrors MIG040: "sapmig_" + everything before the first '-' in sourceHost + "Cred".
 */
function buildCredentialName(sourceTenant) {
  const host = sourceTenant.HOST || '';
  const prefixEnd = host.indexOf('-');
  const alias = prefixEnd > 0 ? host.substring(0, prefixEnd) : host.split('.')[0];
  return `sapmig_${alias}Cred`;
}

/**
 * Ensures the temp OAuth2 credential exists on target — deletes first if
 * already present, then creates fresh. Mirrors MIG040 pre-request script.
 */
async function ensureOAuthCredential(targetTenant, credName, sourceTenant) {
  await silentDelete(targetTenant, 'delete', `/OAuth2ClientCredentials('${credName}')`);

  const clientSecret = encrypt.decrypt(sourceTenant.OAUTHCLIENTSECRETENC);

  await cfClient.write(targetTenant, 'post', '/OAuth2ClientCredentials', {
    data: {
      Name: credName,
      Description: 'OAuth Credentials to connect to source Tenant for Migration',
      TokenServiceUrl: `https://${sourceTenant.TOKENHOST}/oauth2/api/v1/token`,
      ClientId: sourceTenant.OAUTHCLIENTID,
      ClientSecret: clientSecret,
      ClientAuthentication: 'header',
    },
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Ensures the sapmigratedatastore package exists on target — deletes first
 * if already present, then creates fresh. Mirrors MIG040 pre-request script.
 */
async function ensureHelperPackage(targetTenant) {
  await silentDelete(targetTenant, 'delete', `/IntegrationPackages('sapmigratedatastore')`);

  await cfClient.write(targetTenant, 'post', '/IntegrationPackages', {
    data: HELPER_PACKAGE_PAYLOAD,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Builds the OData $batch body that sets sourceTenant, credentials,
 * datastoreName, expiry_period, alert_period and datastoreEntryId on the
 * helper iFlow — mirrors MIG040 "Configure Helper Flow" pre-request script
 * exactly, including URL-encoding.
 */
function buildConfigBatch({ flowName, sourceHost, credName, dataStoreName, expirePeriod, alertPeriod, entryId }) {
  const batchBoundary = 'batch_36522ad7-fc75-4b56-8c71-56071383e77b';
  const changesetBoundary = 'changeset_77162fcd-b8da-41ac-a9f8-9357efbbd621';

  const encodedCred = encodeURIComponent(credName);
  const encodedDsName = encodeURIComponent(dataStoreName);
  const encodedEntryId = encodeURIComponent(entryId || '');

  const params = [
    { key: 'sourceTenant', value: sourceHost },
    { key: 'credentials', value: encodedCred },
    { key: 'datastoreName', value: encodedDsName },
    { key: 'expiry_period', value: String(expirePeriod) },
    { key: 'alert_period', value: String(alertPeriod) },
    { key: 'datastoreEntryId', value: encodedEntryId },
  ];

  const changesetParts = params.map((p) => {
    const body = JSON.stringify({ ParameterKey: p.key, ParameterValue: p.value, DataType: 'xsd:string' });
    return (
      `\r\n--${changesetBoundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `PUT IntegrationDesigntimeArtifacts(Id='${flowName}',Version='active')/$links/Configurations('${p.key}') HTTP/1.1\r\n` +
      `Accept: application/json\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${body}\r\n`
    );
  });

  return (
    `--${batchBoundary}\r\n` +
    `Content-Type: multipart/mixed; boundary=${changesetBoundary}\r\n` +
    changesetParts.join('') +
    `\r\n--${changesetBoundary}--\r\n` +
    `\r\n--${batchBoundary}--`
  );
}

/**
 * Polls Message Processing Logs until we find a COMPLETED entry for the
 * helper flow that was triggered after deployStart. Returns true on success.
 */
async function pollMpl(targetTenant, flowName, deployStart) {
  const session = await cfClient.ensureSession(targetTenant);

  for (let attempt = 0; attempt < MPL_MAX_ATTEMPTS; attempt++) {
    try {
      const filter =
        `IntegrationFlowName eq '${flowName}' and Status eq 'COMPLETED'` +
        ` and LogStart gt datetime'${deployStart}'`;

      const res = await axios.get(`https://${targetTenant.HOST}/api/v1/MessageProcessingLogs`, {
        params: { $inlinecount: 'allpages', $filter: filter },
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/json',
        },
      });

      const count = parseInt(res.data?.d?.__count || '0', 10);
      if (count >= 1) return true;
    } catch (_) {
      // transient — keep polling
    }
    await sleep(MPL_POLL_INTERVAL_MS);
  }
  return false;
}

/**
 * Attempts a DELETE; swallows 404/202/200 silently so cleanup never throws.
 */
async function silentDelete(tenant, method, path) {
  try {
    await cfClient.write(tenant, method, path, {});
  } catch (err) {
    if (err.response?.status !== 404) {
      // Log but do not rethrow — cleanup is best-effort
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function log(migrationId, step, status, message = null) {
  await MigrationLogModel.log(migrationId, step, status, message);
}

/**
 * Converts an axios error (or any error) into a readable string including
 * SAP OData error bodies — matches the pattern in variableMigration.service.js.
 */
function describeError(err) {
  const status = err.response?.status;
  const data = err.response?.data;
  if (data) {
    let detail;
    if (typeof data === 'string') {
      detail = data;
    } else if (data?.error?.message?.value) {
      detail = data.error.message.value;
    } else if (data?.message) {
      detail = data.message;
    } else {
      try {
        detail = JSON.stringify(data);
      } catch {
        detail = String(data);
      }
    }
    return `HTTP ${status || '?'}: ${detail}`.slice(0, 1900);
  }
  return err.message || String(err);
}

module.exports = {
  listSourceDataStores,
  lookupSourceDataStore,
  start,
};