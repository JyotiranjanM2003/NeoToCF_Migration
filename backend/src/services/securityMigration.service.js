/**
 * Security Artifacts migration engine — implements "CPI MIG090 Security
 * Artifacts":
 *
 *   1. Verify TargetCertificateAlias exists in the TARGET tenant's Keystore
 *      (SAP encrypts the transported package with this certificate; only
 *      the target's matching private key can decrypt it on import).
 *   2. List security categories + entries on SOURCE (for the UI — review
 *      only, see note in securityArtifactTypes.data.js).
 *   3. POST /api/v1/SecurityContentTransports on SOURCE with
 *      { TaskId: 'dummyId', Type, TargetCertificateAlias, Mode: 'merge' }.
 *   4. Poll GET /api/v1/SecurityContentTransports('taskId') on SOURCE every
 *      10s (mirrors MIG090's setInterval) until TaskState leaves RUNNING.
 *
 * Persists progress to the existing MIGRATION / MIGRATION_ARTIFACT /
 * MIGRATION_LOG tables with ScopeType='SECURITY', so the existing
 * /api/migration/:id/status and /report endpoints — plus MigrationReport.jsx
 * — work for Security Artifact migrations with zero schema changes.
 */

const neoClient = require('./neoClient.service');
const cfClient = require('./cfClient.service');
const logger = require('../utils/logger');

const MigrationModel = require('../models/Migration.model');
const MigrationArtifactModel = require('../models/MigrationArtifact.model');
const MigrationLogModel = require('../models/MigrationLog.model');

const { SECURITY_CATEGORIES } = require('../data/securityArtifactTypes.data');

const STEPS = {
  TRANSPORT: 'TRANSPORT_SECURITY_CONTENT',
  POLL: 'POLL_TASK_STATUS',
  REPORT: 'REPORT',
};

const POLL_INTERVAL_MS = 10000; // mirrors MIG090's 10s setInterval
const MAX_POLL_ATTEMPTS = 60; // ~10 minutes

// ─── Category catalog helpers ────────────────────────────────────────────────

function findCategory(categoryKey) {
  return SECURITY_CATEGORIES.find((c) => c.key === categoryKey) || null;
}

/**
 * Builds the `Type` value posted to SecurityContentTransports.
 * Only the multi-type "Security Material" category supports narrowing via
 * subTypeKeys — everything else always transports its single default Type.
 */
function buildTransportType(category, subTypeKeys) {
  if (category.key !== 'securityMaterial' || !Array.isArray(subTypeKeys) || subTypeKeys.length === 0) {
    return category.transportType;
  }
  const validKeys = category.listSources
    .map((s) => s.subTypeKey)
    .filter((key) => subTypeKeys.includes(key));
  return validKeys.length > 0 ? validKeys.join(',') : category.transportType;
}

// ─── Listing (review UI only) ────────────────────────────────────────────────

async function fetchEntityCount(sourceTenant, entity) {
  try {
    const data = await neoClient.get(sourceTenant, `/${entity}`);
    return (data?.d?.results || []).length;
  } catch (err) {
    logger.error('securityMigration.fetchEntityCount failed', {
      entity,
      status: err.response?.status,
      detail: err.response?.data || err.message,
    });
    return null; // entity not exposed on this tenant/plan — degrade gracefully
  }
}

/**
 * Tile grid data for the Manage Security landing page.
 *
 * Each supported category needs a count per sub-type (e.g. "Security
 * Material" alone has 6 listSources), and every count is one live OData
 * call to the source tenant. Awaiting them one at a time — as this used
 * to — made a single request to this endpoint take 1-2.5s. The reads are
 * fully independent of each other, so Promise.all fans them all out at
 * once instead; total latency drops to roughly the slowest single call.
 */
async function listCategories(sourceTenant) {
  const countPromises = [];
  const countIndexByCategory = new Map(); // category.key -> [index into countPromises, ...]

  for (const category of SECURITY_CATEGORIES) {
    if (!category.supported || category.listSources.length === 0) continue;

    const indices = [];
    for (const source of category.listSources) {
      indices.push(countPromises.length);
      countPromises.push(fetchEntityCount(sourceTenant, source.entity));
    }
    countIndexByCategory.set(category.key, indices);
  }

  const counts = await Promise.all(countPromises);

  return SECURITY_CATEGORIES.map((category) => {
    if (!category.supported || category.listSources.length === 0) {
      return {
        key: category.key,
        label: category.label,
        countLabel: category.countLabel,
        supported: category.supported,
        count: category.supported ? null : 0,
      };
    }

    const indices = countIndexByCategory.get(category.key) || [];
    let total = 0;
    let anyOk = false;
    for (const i of indices) {
      const count = counts[i];
      if (count !== null) {
        total += count;
        anyOk = true;
      }
    }

    return {
      key: category.key,
      label: category.label,
      countLabel: category.countLabel,
      supported: true,
      count: anyOk ? total : null,
    };
  });
}

/** Row-level entries for one tile's "select all / custom select" table. */
async function listCategoryEntries(sourceTenant, categoryKey) {
  const category = findCategory(categoryKey);
  if (!category) return null;

  if (!category.supported) {
    return { key: category.key, label: category.label, supported: false, transportType: null, subTypes: [], entries: [] };
  }

  const entries = [];
  for (const source of category.listSources) {
    try {
      const data = await neoClient.get(sourceTenant, `/${source.entity}`);
      const rows = data?.d?.results || [];
      rows.forEach((row, idx) => {
        entries.push({
          id: `${source.subTypeKey}::${row.Name ?? row.Alias ?? row.Id ?? idx}`,
          name: row.Name ?? row.Alias ?? row.Id ?? `${source.subTypeLabel} #${idx + 1}`,
          subTypeKey: source.subTypeKey,
          subTypeLabel: source.subTypeLabel,
          detail: row.Description ?? row.Type ?? row.KeyType ?? row.ValidNotAfter ?? '',
        });
      });
    } catch (err) {
      // Entity not available on this tenant/plan — skip it, don't fail the page.
    }
  }

  return {
    key: category.key,
    label: category.label,
    supported: true,
    transportType: category.transportType,
    subTypes: category.listSources.map((s) => ({ key: s.subTypeKey, label: s.subTypeLabel })),
    entries,
  };
}

// ─── Target certificate alias verification ───────────────────────────────────

/**
 * Confirms the alias the user entered exists in the TARGET tenant's own
 * Keystore — mirrors the manual pre-check SAP recommends before running
 * MIG090, since a bad alias fails the transport task with an opaque error.
 */
// AFTER — read from sourceTenant via neoClient, not targetTenant via cfClient
async function verifyTargetCertificateAlias(sourceTenant, targetCertificateAlias) {
  const alias = (targetCertificateAlias || '').trim();
  if (!alias) return { valid: false, message: 'Certificate alias is required' };

  try {
    const data = await neoClient.get(sourceTenant, '/KeystoreEntries');
    const entries = data?.d?.results || [];
    const match = entries.find((e) => (e.Alias || '').toLowerCase() === alias.toLowerCase());

    if (!match) {
      return {
        valid: false,
        message: `No keystore entry with alias '${alias}' was found on the source (Neo) tenant. Import this certificate into the source Keystore first, then retry.`,
      };
    }

    return {
      valid: true,
      entry: {
        alias: match.Alias,
        type: match.Type,
        keyType: match.KeyType,
        status: match.Status,
        validNotAfter: match.ValidNotAfter,
      },
    };
  } catch (err) {
    return { valid: false, message: describeError(err) };
  }
}

// ─── Migration pipeline ───────────────────────────────────────────────────────

/**
 * Starts a Security Artifacts migration run asynchronously.
 *
 * @param {object} params
 * @param {object} params.user                    - { userId }
 * @param {object} params.sourceTenant
 * @param {object} params.targetTenant
 * @param {string} params.targetCertificateAlias
 * @param {string} params.categoryKey              - one of SECURITY_CATEGORIES[].key
 * @param {string[]} [params.subTypeKeys]           - only meaningful for 'securityMaterial'
 * @returns {Promise<string>} migrationId
 */
async function start({ user, sourceTenant, targetTenant, targetCertificateAlias, categoryKey, subTypeKeys = [] }) {
  const category = findCategory(categoryKey);
  if (!category || !category.supported) {
    throw Object.assign(new Error('Unsupported or unknown security category'), { statusCode: 400 });
  }

 const verify = await verifyTargetCertificateAlias(sourceTenant, targetCertificateAlias);
  if (!verify.valid) {
    throw Object.assign(new Error(verify.message), { statusCode: 400 });
  }

  const type = buildTransportType(category, subTypeKeys);

  const migrationId = await MigrationModel.create({
    userId: user.userId,
    sourceTenantId: sourceTenant.SOURCETENANTID,
    targetTenantId: targetTenant.TARGETTENANTID,
     sourceHost: sourceTenant.HOST,        // ← add
  targetHost: targetTenant.HOST,        // ← add
    packageName: `SEC:${category.label}`,
    scopeType: 'SECURITY',
    batchId: null,
  });

  // Fire-and-forget — frontend polls /api/migration/:id/status (generic, reused as-is)
  runPipeline({ migrationId, sourceTenant, category, type, targetCertificateAlias: targetCertificateAlias.trim() }).catch(
    async (err) => {
      await log(migrationId, STEPS.REPORT, 'ERROR', describeError(err));
      await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    }
  );

  return migrationId;
}

async function runPipeline({ migrationId, sourceTenant, category, type, targetCertificateAlias }) {
  const artifactId = await MigrationArtifactModel.create({
    migrationId,
    artifactId: type,
    artifactName: category.label,
    artifactType: 'SECURITY',
    version: null,
  });

  await log(migrationId, STEPS.TRANSPORT, 'STARTED', `${category.label} → Type='${type}'`);

  let taskId;
  try {
    const response = await neoClient.write(sourceTenant, 'post', '/SecurityContentTransports', {
      data: { TaskId: 'dummyId', Type: type, TargetCertificateAlias: targetCertificateAlias, Mode: 'merge' },
      headers: { 'Content-Type': 'application/json' },
    });
    taskId = response?.taskId || response?.d?.taskId;
  } catch (err) {
    const message = describeError(err);
    await MigrationArtifactModel.setStatus(artifactId, 'FAILED', message);
    await log(migrationId, STEPS.TRANSPORT, 'ERROR', message);
    await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    await log(migrationId, STEPS.REPORT, 'ERROR', message);
    return;
  }

  if (!taskId) {
    const message = 'SecurityContentTransports did not return a taskId';
    await MigrationArtifactModel.setStatus(artifactId, 'FAILED', message);
    await log(migrationId, STEPS.TRANSPORT, 'ERROR', message);
    await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    return;
  }

  await log(migrationId, STEPS.TRANSPORT, 'SUCCESS', `Task '${taskId}' created — polling status every ${POLL_INTERVAL_MS / 1000}s`);

  const taskState = await pollTask(sourceTenant, taskId);

//   if (taskState === 'COMPLETED') {
//     await MigrationArtifactModel.setStatus(artifactId, 'MIGRATED');
//     await log(migrationId, STEPS.POLL, 'SUCCESS', `${category.label} transport completed`);
//     await MigrationModel.setStatus(migrationId, 'SUCCESS', { completed: true });
//   } else if (taskState === 'PARTIAL_SUCCESS') {
//     const message = `${category.label} transport finished with PARTIAL_SUCCESS — some entries may not have migrated`;
//     await MigrationArtifactModel.setStatus(artifactId, 'PARTIAL', message);
//     await log(migrationId, STEPS.POLL, 'SUCCESS', message);
//     await MigrationModel.setStatus(migrationId, 'PARTIAL', { completed: true });
//   } else {
//     const message = `${category.label} transport task finished with status ${taskState || 'UNKNOWN (timed out waiting)'}`;
//     await MigrationArtifactModel.setStatus(artifactId, 'FAILED', message);
//     await log(migrationId, STEPS.POLL, 'ERROR', message);
//     await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
//   }

// AFTER — match the real terminal states SAP sends
if (taskState === 'SUCCESS' || taskState === 'COMPLETED') {
  await MigrationArtifactModel.setStatus(artifactId, 'MIGRATED');
  await log(migrationId, STEPS.POLL, 'SUCCESS', `${category.label} transport completed`);
  await MigrationModel.setStatus(migrationId, 'SUCCESS', { completed: true });
} else if (taskState === 'PARTIAL_SUCCESS') {
  const message = `${category.label} transport finished with PARTIAL_SUCCESS — some entries may not have migrated`;
  await MigrationArtifactModel.setStatus(artifactId, 'PARTIAL', message);
  await log(migrationId, STEPS.POLL, 'SUCCESS', message);
  await MigrationModel.setStatus(migrationId, 'PARTIAL', { completed: true });
} else {
  const message = `${category.label} transport task finished with status ${taskState || 'UNKNOWN (timed out waiting)'}`;
  await MigrationArtifactModel.setStatus(artifactId, 'FAILED', message);
  await log(migrationId, STEPS.POLL, 'ERROR', message);
  await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
}

  await log(migrationId, STEPS.REPORT, 'SUCCESS', `${category.label} transport task ${taskId} finished with ${taskState || 'TIMEOUT'}`);
}

/** Polls SecurityContentTransports('taskId') on SOURCE until TaskState leaves RUNNING. */
async function pollTask(sourceTenant, taskId) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const data = await neoClient.get(sourceTenant, `/SecurityContentTransports('${taskId}')`);
      const state = data?.d?.TaskState;
      if (state && state !== 'RUNNING') return state;
    } catch (_) {
      // transient — keep polling
    }
  }
  return null; // timed out
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function log(migrationId, step, status, message = null) {
  await MigrationLogModel.log(migrationId, step, status, message);
}

/** Same shape used by numberRange/variableMigration services, for consistent report output. */
function describeError(err) {
  const status = err.response?.status;
  const data = err.response?.data;
  if (data) {
    let detail;
    if (typeof data === 'string') detail = data;
    else if (data?.error?.message?.value) detail = data.error.message.value;
    else if (data?.message) detail = data.message;
    else {
      try { detail = JSON.stringify(data); } catch { detail = String(data); }
    }
    return `HTTP ${status || '?'}: ${detail}`.slice(0, 1900);
  }
  return err.message || String(err);
}

module.exports = {
  listCategories,
  listCategoryEntries,
  verifyTargetCertificateAlias,
  start,
};