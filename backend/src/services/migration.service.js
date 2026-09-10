/**
 * Migration Engine — the 9-step pipeline from the architecture doc §8.
 * Persists progress to MIGRATION / MIGRATION_ARTIFACT / MIGRATION_CONFIGURATION
 * / MIGRATION_LOG as it runs, so the frontend can poll status and the
 * Migration Report can be built purely from these tables afterwards.
 */
const cfClient = require('./cfClient.service');
const packageService = require('./package.service');
const iflowService = require('./iflow.service');

const MigrationModel = require('../models/Migration.model');
const MigrationArtifactModel = require('../models/MigrationArtifact.model');
const MigrationConfigurationModel = require('../models/MigrationConfiguration.model');
const MigrationLogModel = require('../models/MigrationLog.model');
const TransformRuleModel = require('../models/TransformRule.model');
const MigrationBatchModel = require('../models/MigrationBatch.model');

const STEPS = {
  GET_PACKAGE: 'GET_PACKAGE',
  GET_ARTIFACTS: 'GET_ARTIFACTS',
  DOWNLOAD: 'DOWNLOAD',
  UPLOAD: 'UPLOAD',
  GET_SOURCE_CONFIG: 'GET_SOURCE_CONFIG',
  TRANSFORM_CONFIG: 'TRANSFORM_CONFIG',
  UPLOAD_CONFIG: 'UPLOAD_CONFIG',
  VALIDATE_TARGET: 'VALIDATE_TARGET',
  REPORT: 'REPORT',
};

async function start({ user, sourceTenant, targetTenant, packageId, artifactId, batchId = null }) {
  const scopeType = artifactId ? 'SINGLE_ARTIFACT' : 'PACKAGE';

  const migrationId = await MigrationModel.create({
    userId: user.userId,
    sourceTenantId: sourceTenant.SOURCETENANTID,
    targetTenantId: targetTenant.TARGETTENANTID,
    packageName: packageId,
    scopeType,
    batchId,
  });

  runPipeline({ migrationId, user, sourceTenant, targetTenant, packageId, artifactId, scopeType }).catch(
    async (err) => {
      await MigrationLogModel.log(migrationId, STEPS.REPORT, 'ERROR', describeError(err));
      await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    }
  );

  return migrationId;
}

async function startBatch({ user, sourceTenant, targetTenant, packageIds }) {
  const batchId = await MigrationBatchModel.create({
    userId: user.userId,
    sourceTenantId: sourceTenant.SOURCETENANTID,
    targetTenantId: targetTenant.TARGETTENANTID,
  });

  runBatchPipeline({ batchId, user, sourceTenant, targetTenant, packageIds }).catch(async () => {
    await MigrationBatchModel.setStatus(batchId, 'FAILED', { completed: true });
  });

  return batchId;
}

async function runBatchPipeline({ batchId, user, sourceTenant, targetTenant, packageIds }) {
  let succeeded = 0;
  let failed = 0;

  for (const packageId of packageIds) {
    const migrationId = await MigrationModel.create({
      userId: user.userId,
      sourceTenantId: sourceTenant.SOURCETENANTID,
      targetTenantId: targetTenant.TARGETTENANTID,
      packageName: packageId,
      scopeType: 'PACKAGE',
      batchId,
    });

    const finalStatus = await runPipeline({
      migrationId,
      sourceTenant,
      targetTenant,
      packageId,
      artifactId: undefined,
      scopeType: 'PACKAGE',
      user,
    });

    if (finalStatus === 'SUCCESS') succeeded += 1;
    else failed += 1;
  }

  const batchStatus = failed === 0 ? 'SUCCESS' : succeeded === 0 ? 'FAILED' : 'PARTIAL';
  await MigrationBatchModel.setStatus(batchId, batchStatus, { completed: true });
}

/** Runs the 9-step pipeline for one package/artifact. Returns the final migration status string. */
async function runPipeline({ migrationId, sourceTenant, targetTenant, packageId, artifactId, scopeType, user }) {
  // ---- Step 1: GET_PACKAGE ----
  await logStep(migrationId, STEPS.GET_PACKAGE, 'STARTED');
  const sourcePackage = await packageService.getPackage(sourceTenant, packageId);
  if (!sourcePackage) {
    await logStep(migrationId, STEPS.GET_PACKAGE, 'ERROR', 'Source package not found');
    await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    return 'FAILED';
  }
  await logStep(migrationId, STEPS.GET_PACKAGE, 'SUCCESS', 'Source package confirmed');

  try {
    const targetPackage = await packageService.getPackage(targetTenant, packageId, cfClient);
    if (!targetPackage) {
      await logStep(migrationId, STEPS.GET_PACKAGE, 'STARTED', 'Target package not found — creating it');
      await packageService.createPackage(targetTenant, {
        id: packageId,
        name: sourcePackage.Name,
        shortText: sourcePackage.ShortText,
        version: sourcePackage.Version,
      });
      await logStep(migrationId, STEPS.GET_PACKAGE, 'SUCCESS', 'Target package created');
    } else {
      await logStep(migrationId, STEPS.GET_PACKAGE, 'SUCCESS', 'Target package already exists');
    }
  } catch (err) {
    await logStep(migrationId, STEPS.GET_PACKAGE, 'ERROR', describeError(err));
    await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    return 'FAILED';
  }

  // ---- Step 2: GET_ARTIFACTS ----
  await logStep(migrationId, STEPS.GET_ARTIFACTS, 'STARTED');
  const allArtifacts = await packageService.listArtifacts(sourceTenant, packageId);
  const targetArtifacts =
    scopeType === 'SINGLE_ARTIFACT' ? allArtifacts.filter((a) => a.id === artifactId) : allArtifacts;

  if (targetArtifacts.length === 0) {
    await logStep(migrationId, STEPS.GET_ARTIFACTS, 'ERROR', 'No artifacts found for this scope');
    await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    return 'FAILED';
  }
  await logStep(migrationId, STEPS.GET_ARTIFACTS, 'SUCCESS', `${targetArtifacts.length} artifact(s) in scope`);

  const transformRules = await TransformRuleModel.listActiveForUser(user.userId);

  let succeeded = 0;
  let failed = 0;

  // Every artifact type now migrates independently, per-artifact — one
  // artifact being in Draft state (or any other failure) only fails that
  // artifact, not its siblings in the same package.
  for (const artifact of targetArtifacts) {
    const migrationArtifactId = await MigrationArtifactModel.create({
      migrationId,
      artifactId: artifact.id,
      artifactName: artifact.name,
      artifactType: artifact.type,
      version: artifact.version,
    });

    if (artifact.status === 'Draft') {
      const detail =
        `${artifact.name} is in Draft state on the source tenant (never saved as an active version). ` +
        `CPI cannot export draft content via the API — save/activate a version for it in Neo, then migrate again.`;
      await logStep(migrationId, STEPS.DOWNLOAD, 'ERROR', detail);
      await MigrationArtifactModel.setStatus(migrationArtifactId, 'FAILED', detail);
      failed += 1;
      continue;
    }

    try {
      await migrateOneArtifact({
        migrationId,
        migrationArtifactId,
        artifact,
        sourceTenant,
        targetTenant,
        packageId,
        transformRules,
      });
      await MigrationArtifactModel.setStatus(migrationArtifactId, 'MIGRATED');
      succeeded += 1;
    } catch (err) {
      await MigrationArtifactModel.setStatus(migrationArtifactId, 'FAILED', describeError(err));
      failed += 1;
    }
  }

  // ---- Step 9: REPORT ----
  await logStep(migrationId, STEPS.REPORT, 'STARTED');
  const finalStatus = failed === 0 ? 'SUCCESS' : succeeded === 0 ? 'FAILED' : 'PARTIAL';
  await MigrationModel.setStatus(migrationId, finalStatus, { completed: true });
  await logStep(migrationId, STEPS.REPORT, 'SUCCESS', `${succeeded} succeeded, ${failed} failed`);
  return finalStatus;
}

/** Runs steps 3-8 for a single artifact. Throws on any hard failure. */
async function migrateOneArtifact({
  migrationId,
  migrationArtifactId,
  artifact,
  sourceTenant,
  targetTenant,
  packageId,
  transformRules,
}) {
  let currentStep = STEPS.DOWNLOAD;

  try {
    // ---- Step 3: DOWNLOAD ----
    currentStep = STEPS.DOWNLOAD;
    await logStep(migrationId, STEPS.DOWNLOAD, 'STARTED', artifact.name);
    const zipBuffer = await packageService.downloadArtifactContent(sourceTenant, artifact);
    await logStep(migrationId, STEPS.DOWNLOAD, 'SUCCESS', artifact.name);

    // ---- Step 4: UPLOAD ----
    currentStep = STEPS.UPLOAD;
    await logStep(migrationId, STEPS.UPLOAD, 'STARTED', artifact.name);
    await uploadArtifact({ targetTenant, packageId, artifact, zipBuffer });
    await logStep(migrationId, STEPS.UPLOAD, 'SUCCESS', artifact.name);

    if (artifact.type !== 'IFLOW') {
      // Value mappings / message mappings / script collections carry no
      // separate "Configurations" entity in v1 scope.
      currentStep = STEPS.VALIDATE_TARGET;
      await logStep(migrationId, STEPS.VALIDATE_TARGET, 'SUCCESS', `${artifact.name} (non-iFlow, config steps skipped)`);
      return;
    }

    // ---- Step 5: GET_SOURCE_CONFIG ----
    currentStep = STEPS.GET_SOURCE_CONFIG;
    await logStep(migrationId, STEPS.GET_SOURCE_CONFIG, 'STARTED', artifact.name);
    const sourceConfig = await iflowService.getConfiguration(sourceTenant, artifact.id);
    await logStep(migrationId, STEPS.GET_SOURCE_CONFIG, 'SUCCESS', `${sourceConfig.length} parameter(s)`);

    // ---- Step 6: TRANSFORM_CONFIG ----
    currentStep = STEPS.TRANSFORM_CONFIG;
    await logStep(migrationId, STEPS.TRANSFORM_CONFIG, 'STARTED', artifact.name);
    const transformedConfig = sourceConfig.map((param) => {
      const rule = transformRules.find(
        (r) =>
          (!r.PARAMETERSCOPE || r.PARAMETERSCOPE === param.parameter) &&
          typeof param.value === 'string' &&
          param.value.includes(r.FINDVALUE)
      );
      const targetValue = rule ? param.value.split(rule.FINDVALUE).join(rule.REPLACEVALUE) : param.value;
      return { ...param, targetValue, status: rule ? 'TRANSFORMED' : 'CARRIED_OVER' };
    });

    for (const param of transformedConfig) {
      await MigrationConfigurationModel.create({
        migrationArtifactId,
        parameterName: param.parameter,
        parameterDataType: param.dataType,
        sourceValue: param.value,
        targetValue: param.targetValue,
        status: param.status,
      });
    }
    await logStep(migrationId, STEPS.TRANSFORM_CONFIG, 'SUCCESS', artifact.name);

    // ---- Step 7: UPLOAD_CONFIG ----
    currentStep = STEPS.UPLOAD_CONFIG;
    await logStep(migrationId, STEPS.UPLOAD_CONFIG, 'STARTED', artifact.name);
    await uploadConfiguration({ targetTenant, artifactId: artifact.id, config: transformedConfig });
    await logStep(migrationId, STEPS.UPLOAD_CONFIG, 'SUCCESS', artifact.name);

    // ---- Step 8: VALIDATE_TARGET ----
    currentStep = STEPS.VALIDATE_TARGET;
    await logStep(migrationId, STEPS.VALIDATE_TARGET, 'STARTED', artifact.name);
    await cfClient.get(targetTenant, `/IntegrationDesigntimeArtifacts(Id='${artifact.id}',Version='active')`);
    await logStep(migrationId, STEPS.VALIDATE_TARGET, 'SUCCESS', artifact.name);
  } catch (err) {
    await logStep(migrationId, currentStep, 'ERROR', describeError(err));
    throw err;
  }
}

/**
 * Turns an axios error into a readable string that includes the upstream
 * tenant's actual response body when there is one. Handles Buffer response
 * bodies (some CF error responses come back as raw Buffers, which
 * JSON.stringify would otherwise turn into an unreadable byte-array dump).
 */
function describeError(err) {
  const status = err.response?.status;
  let data = err.response?.data;

  if (Buffer.isBuffer(data)) {
    data = decodeBufferLikeBody(data);
  } else if (data && data.type === 'Buffer' && Array.isArray(data.data)) {
    data = decodeBufferLikeBody(Buffer.from(data.data));
  }

  if (data) {
    let detail;
    if (typeof data === 'string') {
      detail = data;
    } else if (data?.error?.message?.value) {
      detail = data.error.message.value;
    } else if (data?.error?.code && data?.error?.message) {
      detail = `${data.error.code}: ${typeof data.error.message === 'string' ? data.error.message : JSON.stringify(data.error.message)}`;
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

function decodeBufferLikeBody(buffer) {
  const text = buffer.toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Uploads (or updates) an artifact on the target tenant. Routes to the
 * artifact's own type-specific entity set (same one used to list it) rather
 * than the whole-package import — this is the fix that lets one artifact
 * migrate independently of its siblings' draft/active state.
 * POST creates a new artifact; if it already exists on the target (e.g.
 * re-running a migration), CPI responds 409/400 and we fall back to PUT.
 */
async function uploadArtifact({ targetTenant, packageId, artifact, zipBuffer }) {
  const entitySet = packageService.ARTIFACT_ENTITY_SET[artifact.type] || packageService.ARTIFACT_ENTITY_SET.IFLOW;

  const payload = {
    Id: artifact.id,
    Name: artifact.name,
    PackageId: packageId,
    ArtifactContent: zipBuffer.toString('base64'),
  };

  try {
    await cfClient.write(targetTenant, 'post', `/${entitySet}`, {
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 409 || status === 400) {
      await cfClient.write(targetTenant, 'put', `/${entitySet}(Id='${artifact.id}',Version='active')`, {
        data: payload,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      throw err;
    }
  }
}

async function uploadConfiguration({ targetTenant, artifactId, config }) {
  const batchBody = buildConfigBatchPayload(artifactId, config);
  await cfClient.write(targetTenant, 'post', '/$batch', {
    data: batchBody,
    headers: { 'Content-Type': 'multipart/mixed;boundary=batch_config' },
  });
}

function buildConfigBatchPayload(artifactId, config) {
  const batchBoundary = 'batch_config';
  const changesetBoundary = 'changeset_config';

  const changesetParts = config.map((param) => {
    const body = JSON.stringify({ ParameterValue: param.targetValue });
    return (
      `--${changesetBoundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `PUT IntegrationDesigntimeArtifacts(Id='${artifactId}',Version='active')/Configurations('${param.parameter}') HTTP/1.1\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n` +
      `${body}\r\n`
    );
  });

  const changeset =
    `--${batchBoundary}\r\n` +
    `Content-Type: multipart/mixed; boundary=${changesetBoundary}\r\n\r\n` +
    changesetParts.join('') +
    `--${changesetBoundary}--\r\n`;

  return `${changeset}--${batchBoundary}--`;
}

async function getStatus(migrationId, userId) {
  const migration = await MigrationModel.findById(migrationId, userId);
  if (!migration) return null;
  const artifacts = await MigrationArtifactModel.listForMigration(migrationId);
  return { migration, artifacts };
}

async function getReport(migrationId, userId) {
  const migration = await MigrationModel.findById(migrationId, userId);
  if (!migration) return null;

  const artifacts = await MigrationArtifactModel.listForMigration(migrationId);
  const artifactsWithConfig = await Promise.all(
    artifacts.map(async (a) => ({
      ...a,
      configuration: await MigrationConfigurationModel.listForArtifact(a.ID || a.Id),
    }))
  );
  const logs = await MigrationLogModel.listForMigration(migrationId);

  return { migration, artifacts: artifactsWithConfig, logs };
}

async function logStep(migrationId, step, status, message = null) {
  await MigrationLogModel.log(migrationId, step, status, message);
}

async function getBatchStatus(batchId, userId) {
  const batch = await MigrationBatchModel.findById(batchId, userId);
  if (!batch) return null;

  const migrations = await MigrationModel.listForBatch(batchId, userId);
  const migrationsWithArtifacts = await Promise.all(
    migrations.map(async (migration) => ({
      migration,
      artifacts: await MigrationArtifactModel.listForMigration(migration.MIGRATIONID),
    }))
  );

  return { batch, migrations: migrationsWithArtifacts };
}

async function getBatchReport(batchId, userId) {
  const batch = await MigrationBatchModel.findById(batchId, userId);
  if (!batch) return null;

  const migrations = await MigrationModel.listForBatch(batchId, userId);
  const migrationsWithDetail = await Promise.all(
    migrations.map(async (migration) => {
      const artifacts = await MigrationArtifactModel.listForMigration(migration.MIGRATIONID);
      const artifactsWithConfig = await Promise.all(
        artifacts.map(async (a) => ({
          ...a,
          configuration: await MigrationConfigurationModel.listForArtifact(a.ID || a.Id),
        }))
      );
      const logs = await MigrationLogModel.listForMigration(migration.MIGRATIONID);
      return { migration, artifacts: artifactsWithConfig, logs };
    })
  );

  return { batch, migrations: migrationsWithDetail };
}

module.exports = { start, startBatch, getStatus, getReport, getBatchStatus, getBatchReport, STEPS };