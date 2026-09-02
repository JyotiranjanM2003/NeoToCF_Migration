/**
 * Migration Engine — the 9-step pipeline from the architecture doc §8.
 * Persists progress to MIGRATION / MIGRATION_ARTIFACT / MIGRATION_CONFIGURATION
 * / MIGRATION_LOG as it runs, so the frontend can poll status and the
 * Migration Report can be built purely from these tables afterwards.
 */
//const crypto = require('crypto');
const cfClient = require('./cfClient.service');
const packageService = require('./package.service');
const iflowService = require('./iflow.service');

const MigrationModel = require('../models/Migration.model');
const MigrationArtifactModel = require('../models/MigrationArtifact.model');
const MigrationConfigurationModel = require('../models/MigrationConfiguration.model');
const MigrationLogModel = require('../models/MigrationLog.model');
const TransformRuleModel = require('../models/TransformRule.model');
//const ArtifactSyncStateModel = require('../models/ArtifactSyncState.model');
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

/**
 * Kicks off a single-package (or single-artifact) migration run.
 *
 * @param {object} params
 * @param {object} params.user           - { userId }
 * @param {object} params.sourceTenant
 * @param {object} params.targetTenant
 * @param {string} params.packageId
 * @param {string} [params.artifactId]   - omit for PACKAGE scope
 * @param {string} [params.batchId]      - set when this migration is part of a batch
 * @returns {Promise<string>} migrationId
 */
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

  // Run asynchronously so the API call returns immediately with the
  // migrationId; the frontend polls /migration/:id/status for progress.
  runPipeline({ migrationId, user, sourceTenant, targetTenant, packageId, artifactId, scopeType }).catch(
    async (err) => {
      await MigrationLogModel.log(migrationId, STEPS.REPORT, 'ERROR', describeError(err));
      await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    }
  );

  return migrationId;
}

/**
 * Kicks off a BATCH migration — several packages, run one after another,
 * each as its own MIGRATION row linked by BatchId. Sequential (not
 * parallel) on purpose: concurrent OAuth/XSRF token refreshes against the
 * same tenant session are a good way to trip up the token cache.
 *
 * @param {object} params
 * @param {object} params.user
 * @param {object} params.sourceTenant
 * @param {object} params.targetTenant
 * @param {string[]} params.packageIds
 * @returns {Promise<string>} batchId
 */
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

  // Ensure the package exists on the TARGET too, creating it if missing —
  // CPI rejects an artifact upload into a package that doesn't exist yet on
  // the destination tenant.
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

  for (const artifact of targetArtifacts) {
    const migrationArtifactId = await MigrationArtifactModel.create({
      migrationId,
      artifactId: artifact.id,
      artifactName: artifact.name,
      artifactType: artifact.type,
      version: artifact.version,
    });

    // try {
    //   const uploadAction = await migrateOneArtifact({
    //     migrationId,
    //     migrationArtifactId,
    //     artifact,
    //     sourceTenant,
    //     targetTenant,
    //     packageId,
    //     transformRules,
    //     userId: user.userId,
    //   });
    //   const finalStatus =
    //     uploadAction === 'SKIPPED' ? 'SKIPPED' : uploadAction === 'UPDATED' ? 'UPDATED' : 'MIGRATED';
    //   await MigrationArtifactModel.setStatus(migrationArtifactId, finalStatus);
    //   succeeded += 1;
    // } catch (err) {
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

/**
 * Runs steps 3-8 for a single artifact. Throws on any hard failure.
 * Returns the upload outcome ('CREATED' | 'UPDATED' | 'SKIPPED') on success.
 */
async function migrateOneArtifact({
  migrationId,
  migrationArtifactId,
  artifact,
  sourceTenant,
  targetTenant,
  packageId,
  transformRules,
  // userId,
}) {
  let currentStep = STEPS.DOWNLOAD;

  try {
    // ---- Step 3: DOWNLOAD ----
    currentStep = STEPS.DOWNLOAD;
    await logStep(migrationId, STEPS.DOWNLOAD, 'STARTED', artifact.name);
    const zipBuffer =
      artifact.type === 'IFLOW'
        ? await iflowService.downloadArtifactZip(sourceTenant, artifact.id)
        : await packageService.downloadPackageZip(sourceTenant, packageId); // fallback: package-level zip for non-iFlow types
    await logStep(migrationId, STEPS.DOWNLOAD, 'SUCCESS', artifact.name);

    // ---- Step 4: UPLOAD ----
    // currentStep = STEPS.UPLOAD;
    // await logStep(migrationId, STEPS.UPLOAD, 'STARTED', artifact.name);
    // const uploadAction = await uploadArtifact({ userId, targetTenant, packageId, artifact, zipBuffer });
    // await logStep(
    //   migrationId,
    //   STEPS.UPLOAD,
    //   'SUCCESS',
    //   uploadAction === 'SKIPPED'
    //     ? `${artifact.name} — already up to date, no changes to upload`
    //     : uploadAction === 'UPDATED'
    //     ? `${artifact.name} — updated existing artifact on target`
    //     : `${artifact.name} — created new artifact on target`
    // );
   
    // if (artifact.type !== 'IFLOW') {
    //   // Value mappings / other artifact types carry no separate "Configurations"
    //   // entity in v1 scope — the package-level import above already moved them.
    //   currentStep = STEPS.VALIDATE_TARGET;
    //   await logStep(migrationId, STEPS.VALIDATE_TARGET, 'SUCCESS', `${artifact.name} (non-iFlow, config steps skipped)`);
    //   return uploadAction;
    // }

    // if (uploadAction === 'SKIPPED') {
    //   // Nothing changed — configuration was already in sync as of the last
    //   // successful run, so there's nothing new to push either.
    //   currentStep = STEPS.VALIDATE_TARGET;
    //   await logStep(migrationId, STEPS.VALIDATE_TARGET, 'SUCCESS', `${artifact.name} (unchanged, config steps skipped)`);
    //   return uploadAction;
    // }
     currentStep = STEPS.UPLOAD;
    await logStep(migrationId, STEPS.UPLOAD, 'STARTED', artifact.name);
    await uploadArtifact({ targetTenant, packageId, artifact, zipBuffer });
    await logStep(migrationId, STEPS.UPLOAD, 'SUCCESS', artifact.name);

    if (artifact.type !== 'IFLOW') {
      // Value mappings / other artifact types carry no separate "Configurations"
      // entity in v1 scope — the package-level import above already moved them.
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
      return {
        ...param,
        targetValue,
        status: rule ? 'TRANSFORMED' : 'CARRIED_OVER',
      };
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
    // This is the fix: log the REAL upstream error against the step that
    // failed, instead of letting it disappear into a generic FAILED status.
    await logStep(migrationId, currentStep, 'ERROR', describeError(err));
    throw err;
  }
  //   currentStep = STEPS.VALIDATE_TARGET;
  //   await logStep(migrationId, STEPS.VALIDATE_TARGET, 'STARTED', artifact.name);
  //   await cfClient.get(targetTenant, `/IntegrationDesigntimeArtifacts(Id='${artifact.id}',Version='active')`);
  //   await logStep(migrationId, STEPS.VALIDATE_TARGET, 'SUCCESS', artifact.name);

  //   return uploadAction;
  // } catch (err) {
  //   // Log the REAL upstream error against the step that failed, instead of
  //   // letting it disappear into a generic FAILED status.
  //   await logStep(migrationId, currentStep, 'ERROR', describeError(err));
  //   throw err;
  // }

  
}

/**
 * Turns an axios error (or anything else) into a readable string that
 * includes the upstream tenant's actual response body when there is one —
 * SAP OData errors are usually { error: { message: { value: '...' } } } —
 * so the Migration Report log shows the real cause, not just "Request
 * failed with status code 400".
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

/**
 * Uploads (or updates, or skips) an artifact on the target tenant.
 * Returns 'CREATED' | 'UPDATED' | 'SKIPPED'.
 *
 * Skip decision is based on comparing the CURRENT source zip's hash against
 * OUR OWN record of the hash we last successfully uploaded (ARTIFACT_SYNC_STATE)
 * — not against a re-downloaded copy from the target. CPI re-packages zips
 * internally (different timestamps/manifest), so a byte comparison against
 * the target's stored copy never matches even when nothing actually changed.
 */
// async function uploadArtifact({ userId, targetTenant, packageId, artifact, zipBuffer }) {
//   if (artifact.type !== 'IFLOW') {
//     await cfClient.write(targetTenant, 'post', '/IntegrationPackages', {
//       params: { Overwrite: true },
//       data: zipBuffer,
//       headers: { 'Content-Type': 'application/zip' },
//     });
//     return 'CREATED';
//   }

//   const sourceHash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
//   const syncState = await ArtifactSyncStateModel.find(userId, packageId, artifact.id);

//   if (syncState && syncState.CONTENTHASH === sourceHash) {
//     return 'SKIPPED';
//   }

//   const exists = await targetArtifactExists(targetTenant, artifact.id);

//   const payload = {
//     Id: artifact.id,
//     Name: artifact.name,
//     PackageId: packageId,
//     ArtifactContent: zipBuffer.toString('base64'),
//   };

//   if (!exists) {
//     await cfClient.write(targetTenant, 'post', '/IntegrationDesigntimeArtifacts', {
//       data: payload,
//       headers: { 'Content-Type': 'application/json' },
//     });
//   } else {
//     await cfClient.write(
//       targetTenant,
//       'put',
//       `/IntegrationDesigntimeArtifacts(Id='${artifact.id}',Version='active')`,
//       { data: payload, headers: { 'Content-Type': 'application/json' } }
//     );
//   }

//   await ArtifactSyncStateModel.upsert({ userId, packageId, artifactId: artifact.id, contentHash: sourceHash });
//   return exists ? 'UPDATED' : 'CREATED';
// }

// /** Existence check via the metadata endpoint — same call VALIDATE_TARGET uses. */
// async function targetArtifactExists(targetTenant, artifactId) {
//   try {
//     await cfClient.get(targetTenant, `/IntegrationDesigntimeArtifacts(Id='${artifactId}',Version='active')`);
//     return true;
//   } catch (err) {
//     if (err.response?.status === 404) return false;
//     throw err;
//   }
// }


/**
 * Uploads a package/artifact zip to the target tenant.
 * POST creates a new artifact; if it already exists on the target (e.g.
 * re-running a migration), CPI responds 409/400 and we fall back to PUT
 * to update the existing one instead.
 */
async function uploadArtifact({ targetTenant, packageId, artifact, zipBuffer }) {
  if (artifact.type !== 'IFLOW') {
    await cfClient.write(targetTenant, 'post', '/IntegrationPackages', {
      params: { Overwrite: true },
      data: zipBuffer,
      headers: { 'Content-Type': 'application/zip' },
    });
    return;
  }

  const payload = {
    Id: artifact.id,
    Name: artifact.name,
    PackageId: packageId,
    ArtifactContent: zipBuffer.toString('base64'),
  };

  try {
    await cfClient.write(targetTenant, 'post', '/IntegrationDesigntimeArtifacts', {
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 409 || status === 400) {
      await cfClient.write(
        targetTenant,
        'put',
        `/IntegrationDesigntimeArtifacts(Id='${artifact.id}',Version='active')`,
        { data: payload, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      throw err;
    }
  }
}
/**
 * Uploads configuration parameters to the target artifact via $batch,
 * mirroring the MIG100/MIG110 UploadConfigurations pattern.
 */
async function uploadConfiguration({ targetTenant, artifactId, config }) {
  const batchBody = buildConfigBatchPayload(artifactId, config);
  await cfClient.write(targetTenant, 'post', '/$batch', {
    data: batchBody,
    headers: { 'Content-Type': 'multipart/mixed;boundary=batch_config' },
  });
}

/**
 * Builds a spec-correct OData v2 $batch multipart body. PUT/POST/DELETE
 * requests must be wrapped in a nested "changeset" (its own multipart
 * boundary), and every part needs Content-Type: application/http +
 * Content-Transfer-Encoding: binary before the embedded HTTP request line —
 * without these, CPI's batch parser can't find the method/entity.
 */
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

/** Live status for a batch — one entry per package, each with its own artifact list. */
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

/** Full report for a batch — each package's migration with its artifacts, config, and logs. */
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