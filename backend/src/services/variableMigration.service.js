/**
 * Variable Migration Engine — implements the full MIG050 orchestration:
 *
 *  1. List / look up variables on source Neo
 *  2. Ensure/recreate temp OAuth2 credential on target CF
 *  3. Ensure/recreate SAPmigrateVariable package on target CF
 *  4. Per variable: create helper iFlow → configure → deploy → poll MPL
 *  5. Verify variable exists on target
 *  6. Clean up helper iFlow (runtime + designtime)
 *  7. After all variables: clean up package + OAuth cred
 *
 * Persists progress to the existing MIGRATION / MIGRATION_ARTIFACT /
 * MIGRATION_LOG tables with ScopeType='VARIABLE' / ArtifactType='VARIABLE',
 * so the existing /api/migration/:id/status and /report endpoints — plus
 * MigrationReport.jsx — work for variable migrations with zero schema changes.
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
} = require('../data/variablesHelperFlow.data');

// ─── Step labels ─────────────────────────────────────────────────────────────

const STEPS = {
  LIST_VARIABLES: 'LIST_VARIABLES',
  PREPARE_CRED: 'PREPARE_CRED',
  PREPARE_PACKAGE: 'PREPARE_PACKAGE',
  CREATE_FLOW: 'CREATE_FLOW',
  CONFIGURE_FLOW: 'CONFIGURE_FLOW',
  DEPLOY_FLOW: 'DEPLOY_FLOW',
  POLL_MPL: 'POLL_MPL',
  VERIFY_VARIABLE: 'VERIFY_VARIABLE',
  CLEANUP: 'CLEANUP',
  REPORT: 'REPORT',
};

// How long to wait after deploying before polling MPL (ms) — mirrors the
// 20-second setTimeout in MIG050's "Deploy Flow" test script.
const DEPLOY_WAIT_MS = 5000;
// MPL poll interval and max attempts
const MPL_POLL_INTERVAL_MS = 2000;
const MPL_MAX_ATTEMPTS = 12; // ~60 s total

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Lists all variables available on the source Neo tenant.
 * Returns an array of { VariableName, IntegrationFlow, Visibility, ... }.
 */
async function listSourceVariables(sourceTenant) {
  const data = await neoClient.get(sourceTenant, '/Variables');
  return (data?.d?.results || []).map((v) => ({
    variableName: v.VariableName,
    integrationFlow: v.IntegrationFlow || '',
    visibility: v.Visibility || '',
  }));
}

/**
 * Looks up one specific variable on the source Neo tenant.
 * Returns the variable object, or null if not found.
 */
async function lookupSourceVariable(sourceTenant, variableName, integrationFlow) {
  try {
    const data = await neoClient.get(
      sourceTenant,
      `/Variables(VariableName='${encodeURIComponent(variableName)}',IntegrationFlow='${encodeURIComponent(integrationFlow)}')`
    );
    return data?.d || null;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Starts a variable migration run asynchronously.
 *
 * @param {object} params
 * @param {object} params.user           - { userId }
 * @param {object} params.sourceTenant
 * @param {object} params.targetTenant
 * @param {Array}  params.variables      - [{ variableName, integrationFlow }] — empty = all
 * @returns {Promise<string>} migrationId
 */
async function start({ user, sourceTenant, targetTenant, variables = [] }) {
  const scopeType = 'VARIABLE';
  const packageName = variables.length === 1
    ? `VAR:${variables[0].variableName}`
    : 'VAR:ALL';

  const migrationId = await MigrationModel.create({
    userId: user.userId,
    sourceTenantId: sourceTenant.SOURCETENANTID,
    targetTenantId: targetTenant.TARGETTENANTID,
    packageName,
    scopeType,
    batchId: null,
  });

  // Fire-and-forget — frontend polls /api/migration/:id/status
  runPipeline({ migrationId, user, sourceTenant, targetTenant, variables }).catch(
    async (err) => {
      await MigrationLogModel.log(migrationId, STEPS.REPORT, 'ERROR', describeError(err));
      await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    }
  );

  return migrationId;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

async function runPipeline({ migrationId, user, sourceTenant, targetTenant, variables }) {
  // ── Step 1: resolve variable list ─────────────────────────────────────────
  await log(migrationId, STEPS.LIST_VARIABLES, 'STARTED');

  let variableList = variables;

  if (variableList.length === 0) {
    // Migrate ALL variables
    const all = await listSourceVariables(sourceTenant);
    if (all.length === 0) {
      await log(migrationId, STEPS.LIST_VARIABLES, 'ERROR', 'No variables found on source tenant');
      await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
      return;
    }
    variableList = all;
    await log(migrationId, STEPS.LIST_VARIABLES, 'SUCCESS', `${all.length} variable(s) found`);
  } else {
    // Selective — validate each requested variable exists on source
    for (const v of variableList) {
      const found = await lookupSourceVariable(sourceTenant, v.variableName, v.integrationFlow);
      if (!found) {
        await log(
          migrationId,
          STEPS.LIST_VARIABLES,
          'ERROR',
          `Variable '${v.variableName}' (flow='${v.integrationFlow}') not found on source tenant`
        );
        await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
        return;
      }
    }
    await log(migrationId, STEPS.LIST_VARIABLES, 'SUCCESS', `${variableList.length} variable(s) validated`);
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

  // ── Step 3: create/recreate SAPmigrateVariable package on target ──────────
  await log(migrationId, STEPS.PREPARE_PACKAGE, 'STARTED');
  try {
    await ensureHelperPackage(targetTenant);
    await log(migrationId, STEPS.PREPARE_PACKAGE, 'SUCCESS', 'SAPmigrateVariable package ready');
  } catch (err) {
    await log(migrationId, STEPS.PREPARE_PACKAGE, 'ERROR', describeError(err));
    await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    return;
  }

  // ── Steps 4–7: per-variable migration ────────────────────────────────────
  let succeeded = 0;
  let failed = 0;

  for (const v of variableList) {
    const flowName = v.integrationFlow === '' ? GLOBAL_FLOW_NAME : v.integrationFlow;

    const artifactId = await MigrationArtifactModel.create({
      migrationId,
      artifactId: `${v.variableName}::${v.integrationFlow}`,
      artifactName: v.variableName,
      artifactType: 'VARIABLE',
      version: '1.0',
    });

    try {
      await migrateOneVariable({
        migrationId,
        artifactId,
        variableName: v.variableName,
        integrationFlow: v.integrationFlow,
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

  // ── Step 8: global cleanup (package + OAuth cred) ─────────────────────────
  await log(migrationId, STEPS.CLEANUP, 'STARTED', 'Removing helper package and OAuth credential');
  try {
    await silentDelete(targetTenant, 'delete', `/IntegrationPackages('SAPmigrateVariable')`);
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

// ─── Per-variable steps ───────────────────────────────────────────────────────

async function migrateOneVariable({
  migrationId,
  artifactId,
  variableName,
  integrationFlow,
  flowName,
  credName,
  sourceTenant,
  targetTenant,
}) {
  // Step 4: create helper iFlow
  await log(migrationId, STEPS.CREATE_FLOW, 'STARTED', `${variableName} → iFlow '${flowName}'`);
  await cfClient.write(targetTenant, 'post', '/IntegrationDesigntimeArtifacts', {
    data: {
      Name: flowName,
      Id: flowName,
      PackageId: 'SAPmigrateVariable',
      ArtifactContent: HELPER_IFLOW_BASE64,
    },
    headers: { 'Content-Type': 'application/json' },
  });
  await log(migrationId, STEPS.CREATE_FLOW, 'SUCCESS', flowName);

  // Step 5: configure (sourceTenant, credentials, variableName) via $batch
  await log(migrationId, STEPS.CONFIGURE_FLOW, 'STARTED', variableName);
  const batchBody = buildConfigBatch(flowName, sourceTenant.HOST, credName, variableName);
  await cfClient.write(targetTenant, 'post', '/$batch', {
    data: batchBody,
    headers: { 'Content-Type': 'multipart/mixed;boundary=batch_36522ad7-fc75-4b56-8c71-56071383e77b' },
  });
  await log(migrationId, STEPS.CONFIGURE_FLOW, 'SUCCESS', variableName);

  // Step 6: deploy
  await log(migrationId, STEPS.DEPLOY_FLOW, 'STARTED', flowName);
  const deployStart = new Date().toISOString().replace(/\.\d{3}Z$/, ''); // ISO-8601 without ms
  await cfClient.write(
    targetTenant,
    'post',
    `/DeployIntegrationDesigntimeArtifact?Id='${flowName}'&Version='active'`,
    {}
  );
  await log(migrationId, STEPS.DEPLOY_FLOW, 'SUCCESS', flowName);

  // Step 7: wait then poll MPL
  await log(migrationId, STEPS.POLL_MPL, 'STARTED', `Waiting ${DEPLOY_WAIT_MS / 1000}s for flow execution`);
  await sleep(DEPLOY_WAIT_MS);

  const mplSuccess = await pollMpl(targetTenant, flowName, deployStart);
  if (!mplSuccess) {
    await log(migrationId, STEPS.POLL_MPL, 'ERROR', `No completed MPL entry found for '${flowName}' — variable migration may have failed`);
    throw new Error(`MPL check failed for helper flow '${flowName}': no COMPLETED message found within timeout`);
  }
  await log(migrationId, STEPS.POLL_MPL, 'SUCCESS', `MPL confirmed COMPLETED for '${flowName}'`);

  // Verify variable on target
  await log(migrationId, STEPS.VERIFY_VARIABLE, 'STARTED', variableName);
  const targetFlow = flowName === GLOBAL_FLOW_NAME ? '' : flowName;
  try {
    await cfClient.get(
      targetTenant,
      `/Variables(VariableName='${encodeURIComponent(variableName)}',IntegrationFlow='${encodeURIComponent(targetFlow)}')`
    );
    await log(migrationId, STEPS.VERIFY_VARIABLE, 'SUCCESS', `${variableName} confirmed on target`);
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error(`Variable '${variableName}' not found on target after migration`);
    }
    throw err;
  }

  // Per-variable cleanup: runtime artifact + designtime iFlow
  await log(migrationId, STEPS.CLEANUP, 'STARTED', `Cleaning up helper flow '${flowName}'`);
  await silentDelete(targetTenant, 'delete', `/IntegrationRuntimeArtifacts('${flowName}')`);
  await silentDelete(targetTenant, 'delete', `/IntegrationDesigntimeArtifacts(Id='${flowName}',Version='active')`);
  await log(migrationId, STEPS.CLEANUP, 'SUCCESS', `Helper flow '${flowName}' removed`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives the temporary credential name from the source host.
 * Mirrors MIG050: take everything before the first '-' in sourceHost.
 */
function buildCredentialName(sourceTenant) {
  const host = sourceTenant.HOST || '';
  const prefixEnd = host.indexOf('-');
  const alias = prefixEnd > 0 ? host.substring(0, prefixEnd) : host.split('.')[0];
  return `${alias}sourceOauthCred`;
}

/**
 * Ensures the temp OAuth2 credential exists on target — deletes first if
 * already present, then creates fresh. Mirrors MIG050 pre-request script.
 */
async function ensureOAuthCredential(targetTenant, credName, sourceTenant) {
  // Try to delete if exists (ignore 404)
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
 * Ensures the SAPmigrateVariable package exists on target — deletes first
 * if already present, then creates fresh. Mirrors MIG050 pre-request script.
 */
async function ensureHelperPackage(targetTenant) {
  await silentDelete(targetTenant, 'delete', `/IntegrationPackages('SAPmigrateVariable')`);

  await cfClient.write(targetTenant, 'post', '/IntegrationPackages', {
    data: HELPER_PACKAGE_PAYLOAD,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Builds the OData $batch body that sets sourceTenant, credentials, and
 * variableName on the helper iFlow — mirrors MIG050 "Flow Configurations
 * for Variables" pre-request script exactly, including URL-encoding.
 */
function buildConfigBatch(flowName, sourceHost, credName, variableName) {
  const batchBoundary = 'batch_36522ad7-fc75-4b56-8c71-56071383e77b';
  const changesetBoundary = 'changeset_77162fcd-b8da-41ac-a9f8-9357efbbd621';

  const encodedCred = encodeURIComponent(credName);
  const encodedVar = encodeURIComponent(variableName);

  const params = [
    { key: 'sourceTenant', value: sourceHost },
    { key: 'credentials', value: encodedCred },
    { key: 'variableName', value: encodedVar },
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
 * Mirrors MIG050's 20s wait + inline sendRequest check.
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
 * SAP OData error bodies — matches the pattern in migration.service.js.
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
      try { detail = JSON.stringify(data); } catch { detail = String(data); }
    }
    return `HTTP ${status || '?'}: ${detail}`.slice(0, 1900);
  }
  return err.message || String(err);
}

module.exports = {
  listSourceVariables,
  lookupSourceVariable,
  start,
};
