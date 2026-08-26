/**
 * Migration Engine — the 9-step pipeline from the architecture doc §8.
 * Persists progress to MIGRATION / MIGRATION_ARTIFACT / MIGRATION_CONFIGURATION
 * / MIGRATION_LOG as it runs, so the frontend can poll status and the
 * Migration Report can be built purely from these tables afterwards.
 */
const neoClient = require('./neoClient.service');
const cfClient = require('./cfClient.service');
const packageService = require('./package.service');
const iflowService = require('./iflow.service');

const MigrationModel = require('../models/Migration.model');
const MigrationArtifactModel = require('../models/MigrationArtifact.model');
const MigrationConfigurationModel = require('../models/MigrationConfiguration.model');
const MigrationLogModel = require('../models/MigrationLog.model');
const TransformRuleModel = require('../models/TransformRule.model');

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
 * Kicks off a migration run. Scope is either the whole package (every
 * artifact inside it) or a single artifact.
 *
 * @param {object} params
 * @param {object} params.user           - { userId }
 * @param {object} params.sourceTenant
 * @param {object} params.targetTenant
 * @param {string} params.packageId
 * @param {string} [params.artifactId]   - omit for PACKAGE scope
 * @returns {Promise<string>} migrationId
 */
async function start({ user, sourceTenant, targetTenant, packageId, artifactId }) {
  const scopeType = artifactId ? 'SINGLE_ARTIFACT' : 'PACKAGE';

  const migrationId = await MigrationModel.create({
    userId: user.userId,
    sourceTenantId: sourceTenant.SOURCETENANTID,
    targetTenantId: targetTenant.TARGETTENANTID,
    packageName: packageId,
    scopeType,
  });

  // Run asynchronously so the API call returns immediately with the
  // migrationId; the frontend polls /migration/:id/status for progress.
  runPipeline({ migrationId, user, sourceTenant, targetTenant, packageId, artifactId, scopeType }).catch(
    async (err) => {
      await MigrationLogModel.log(migrationId, STEPS.REPORT, 'ERROR', err.message);
      await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    }
  );

  return migrationId;
}

async function runPipeline({ migrationId, sourceTenant, targetTenant, packageId, artifactId, scopeType, user }) {
  // ---- Step 1: GET_PACKAGE ----
  await logStep(migrationId, STEPS.GET_PACKAGE, 'STARTED');
  const sourcePackage = await packageService.getPackage(sourceTenant, packageId);
  if (!sourcePackage) {
    await logStep(migrationId, STEPS.GET_PACKAGE, 'ERROR', 'Source package not found');
    await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    return;
  }
  await logStep(migrationId, STEPS.GET_PACKAGE, 'SUCCESS');

  // ---- Step 2: GET_ARTIFACTS ----
  await logStep(migrationId, STEPS.GET_ARTIFACTS, 'STARTED');
  const allArtifacts = await packageService.listArtifacts(sourceTenant, packageId);
  const targetArtifacts =
    scopeType === 'SINGLE_ARTIFACT' ? allArtifacts.filter((a) => a.id === artifactId) : allArtifacts;

  if (targetArtifacts.length === 0) {
    await logStep(migrationId, STEPS.GET_ARTIFACTS, 'ERROR', 'No artifacts found for this scope');
    await MigrationModel.setStatus(migrationId, 'FAILED', { completed: true });
    return;
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

    try {
      await migrateOneArtifact({
        migrationId,
        migrationArtifactId,
        artifact,
        sourceTenant,
        targetTenant,
        packageId,
        sourcePackage,
        transformRules,
      });
      await MigrationArtifactModel.setStatus(migrationArtifactId, 'MIGRATED');
      succeeded += 1;
    } catch (err) {
      await MigrationArtifactModel.setStatus(migrationArtifactId, 'FAILED', err.message);
      failed += 1;
    }
  }

  // ---- Step 9: REPORT ----
  await logStep(migrationId, STEPS.REPORT, 'STARTED');
  const finalStatus = failed === 0 ? 'SUCCESS' : succeeded === 0 ? 'FAILED' : 'PARTIAL';
  await MigrationModel.setStatus(migrationId, finalStatus, { completed: true });
  await logStep(migrationId, STEPS.REPORT, 'SUCCESS', `${succeeded} succeeded, ${failed} failed`);
}

/** Runs steps 3-8 for a single artifact. Throws on any hard failure. */
async function migrateOneArtifact({
  migrationId,
  migrationArtifactId,
  artifact,
  sourceTenant,
  targetTenant,
  packageId,
  sourcePackage,
  transformRules,
}) {
  // ---- Step 3: DOWNLOAD ----
  await logStep(migrationId, STEPS.DOWNLOAD, 'STARTED', artifact.name);
  const zipBuffer =
    artifact.type === 'IFLOW'
      ? await iflowService.downloadArtifactZip(sourceTenant, artifact.id)
      : await packageService.downloadPackageZip(sourceTenant, packageId); // fallback: package-level zip for non-iFlow types
  await logStep(migrationId, STEPS.DOWNLOAD, 'SUCCESS', artifact.name);

  // ---- Step 4: UPLOAD ----
  await logStep(migrationId, STEPS.UPLOAD, 'STARTED', artifact.name);
  // await uploadArtifact({ targetTenant, packageId, sourcePackage, artifact, zipBuffer });
  await uploadArtifact({ targetTenant, packageId, artifact, zipBuffer });
  await logStep(migrationId, STEPS.UPLOAD, 'SUCCESS', artifact.name);

  if (artifact.type !== 'IFLOW') {
    // Value mappings / other artifact types carry no separate "Configurations"
    // entity in v1 scope — the package-level import above already moved them.
    await logStep(migrationId, STEPS.VALIDATE_TARGET, 'SUCCESS', `${artifact.name} (non-iFlow, config steps skipped)`);
    return;
  }

  // ---- Step 5: GET_SOURCE_CONFIG ----
  await logStep(migrationId, STEPS.GET_SOURCE_CONFIG, 'STARTED', artifact.name);
  const sourceConfig = await iflowService.getConfiguration(sourceTenant, artifact.id);
  await logStep(migrationId, STEPS.GET_SOURCE_CONFIG, 'SUCCESS', `${sourceConfig.length} parameter(s)`);

  // ---- Step 6: TRANSFORM_CONFIG ----
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
  await logStep(migrationId, STEPS.UPLOAD_CONFIG, 'STARTED', artifact.name);
  await uploadConfiguration({ targetTenant, artifactId: artifact.id, config: transformedConfig });
  await logStep(migrationId, STEPS.UPLOAD_CONFIG, 'SUCCESS', artifact.name);

  // ---- Step 8: VALIDATE_TARGET ----
  await logStep(migrationId, STEPS.VALIDATE_TARGET, 'STARTED', artifact.name);
  await cfClient.get(targetTenant, `/IntegrationDesigntimeArtifacts(Id='${artifact.id}',Version='active')`);
  await logStep(migrationId, STEPS.VALIDATE_TARGET, 'SUCCESS', artifact.name);
}

/**
 * Uploads a package/artifact zip to the target tenant.
 * Package-level: POST /IntegrationPackages?Overwrite=true (MIG110 UploadPackage pattern)
 */
// async function uploadArtifact({ targetTenant, packageId, sourcePackage, artifact, zipBuffer }) {
//   if (artifact.type === 'IFLOW' && artifact.__uploadedViaPackage) {
//     return; // already covered by a package-level upload in this run
//   }

//   await cfClient.write(targetTenant, 'post', '/IntegrationPackages', {
//     params: { Overwrite: true },
//     data: zipBuffer,
//     headers: { 'Content-Type': 'application/zip' },
//   });
// }
/**
 * Uploads a package/artifact zip to the target tenant.
 *
 * - Non-iFlow types (v1 fallback): whole-package zip via
 *   POST /IntegrationPackages?Overwrite=true (MIG110 UploadPackage pattern) —
 *   raw binary body, application/zip.
 * - IFLOW: CPI's IntegrationDesigntimeArtifacts API does NOT accept a raw
 *   binary POST like the package endpoint does. It takes a JSON body with
 *   the zip base64-encoded inside ArtifactContent, plus Id/Name/PackageId.
 *   POST creates a new artifact; if it already exists on the target (e.g.
 *   re-running a migration), CPI responds 409/400 and we fall back to PUT
 *   to update the existing one instead.
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
      // Artifact already exists on target — update it instead of creating.
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

function buildConfigBatchPayload(artifactId, config) {
  // Minimal OData $batch multipart body — one ChangeSet per configuration
  // parameter update. Kept as a plain builder so it's easy to unit test.
  const parts = config.map(
    (param) =>
      `PUT IntegrationDesigntimeArtifacts(Id='${artifactId}',Version='active')/Configurations('${param.parameter}') HTTP/1.1\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${JSON.stringify({ ParameterValue: param.targetValue })}\r\n`
  );
  return `--batch_config\r\n${parts.join('--batch_config\r\n')}--batch_config--`;
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

module.exports = { start, getStatus, getReport, STEPS };
