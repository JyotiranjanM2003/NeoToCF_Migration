/**
 * Number Range migration operations.  Authentication, CSRF handling, and
 * tenant sessions deliberately stay in the shared Neo/CF clients.
 */
const neoClient = require('./neoClient.service');
const cfClient = require('./cfClient.service');
const MigrationModel = require('../models/Migration.model');
const MigrationArtifactModel = require('../models/MigrationArtifact.model');



function odataString(value) {
  // OData string literals escape apostrophes by doubling them.
  return String(value).replace(/'/g, "''");
}

function normalizeNumberRange(range = {}) {
  return {
    name: range.Name ?? '',
    description: range.Description ?? '',
    currentValue: range.CurrentValue ?? '',
    minValue: range.MinValue ?? '',
    maxValue: range.MaxValue ?? '',
    rotate: range.Rotate ?? '',
    fieldLength: range.FieldLength ?? '',
  };
}

function buildPayload(range = {}) {
  // Keep the CPI property names and omit values which the source did not set.
  const payload = {};
  for (const property of [
    'CurrentValue', 'Name', 'MinValue', 'MaxValue', 'Description', 'Rotate', 'FieldLength',
  ]) {
    if (range[property] !== undefined && range[property] !== null) {
      payload[property] = range[property];
    }
  }
  return payload;
}

async function listSourceNumberRanges(sourceTenant) {
  const data = await neoClient.get(sourceTenant, '/NumberRanges');
  return (data?.d?.results || []).map(normalizeNumberRange);
}

async function getSourceNumberRange(sourceTenant, name) {
  const data = await neoClient.get(
    sourceTenant,
    `/NumberRanges('${odataString(name)}')`
  );
  return data?.d || null;
}

async function migrateOne(sourceTenant, targetTenant, name) {
  try {
    const sourceRange = await getSourceNumberRange(sourceTenant, name);
    if (!sourceRange || !sourceRange.Name) {
      return { name, status: 'failed', message: 'Number Range was not found on the source tenant' };
    }

    const payload = buildPayload(sourceRange);
    if (!payload.Name) {
      return { name, status: 'failed', message: 'Source Number Range has no name' };
    }

    await cfClient.write(targetTenant, 'post', '/NumberRanges', {
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });
    return { name: payload.Name, status: 'migrated' };
  } catch (err) {
    if (err.response?.status === 409) {
      return { name, status: 'already_exists', message: 'Already exists in target tenant' };
    }
    if (err.response?.status === 404) {
      return { name, status: 'failed', message: 'Number Range was not found on the source tenant' };
    }
    return { name, status: 'failed', message: describeError(err) };
  }
}

// async function migrate(sourceTenant, targetTenant, names) {
//   const selectedNames = names.length > 0
//     ? names
//     : (await listSourceNumberRanges(sourceTenant)).map((range) => range.name).filter(Boolean);

//   const results = [];
//   for (const name of selectedNames) {
//     // Sequential processing avoids overwhelming the target and keeps each
//     // result independent when a source/target request fails.
//     results.push(await migrateOne(sourceTenant, targetTenant, name));
//   }
//   return results;
// }

async function migrate(user, sourceTenant, targetTenant, names) {
  const selectedNames = names.length > 0
    ? names
    : (await listSourceNumberRanges(sourceTenant)).map((range) => range.name).filter(Boolean);

  const migrationId = await MigrationModel.create({
    userId: user.userId,
    sourceTenantId: sourceTenant.SOURCETENANTID,
    targetTenantId: targetTenant.TARGETTENANTID,
    sourceHost: sourceTenant.HOST,
    targetHost: targetTenant.HOST,
    packageName: selectedNames.length === 1 ? `NR:${selectedNames[0]}` : 'NR:BATCH',
    scopeType: 'NUMBER_RANGE',
    batchId: null,
  });

  const results = [];
  let succeeded = 0;
  let failed = 0;

  for (const name of selectedNames) {
    const artifactId = await MigrationArtifactModel.create({
      migrationId,
      artifactId: name,
      artifactName: name,
      artifactType: 'NUMBER_RANGE',
      version: null,
    });

    // Sequential processing avoids overwhelming the target and keeps each
    // result independent when a source/target request fails.
    const result = await migrateOne(sourceTenant, targetTenant, name);
    results.push(result);

    if (result.status === 'failed') {
      failed += 1;
      await MigrationArtifactModel.setStatus(artifactId, 'FAILED', result.message || null);
    } else {
      // 'migrated' and 'already_exists' both mean the range is present on
      // the target tenant — both count as MIGRATED for status-badge purposes.
      succeeded += 1;
      await MigrationArtifactModel.setStatus(artifactId, 'MIGRATED');
    }
  }

  const finalStatus = failed === 0 ? 'SUCCESS' : succeeded === 0 ? 'FAILED' : 'PARTIAL';
  await MigrationModel.setStatus(migrationId, finalStatus, { completed: true });

  return results;
}

function describeError(err) {
  const status = err.response?.status;
  if (status === 401) return 'Tenant authentication failed';
  if (status === 403) return 'Tenant authorization or CSRF validation failed';
  if (status >= 500) return 'Tenant service is currently unavailable';
  if (err.code === 'ECONNABORTED') return 'Tenant request timed out';
  return 'Unable to migrate Number Range';
}

module.exports = {
  listSourceNumberRanges,
  getSourceNumberRange,
  migrate,
  normalizeNumberRange,
  buildPayload,
};
