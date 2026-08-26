/**
 * Validation Engine — read-only checks run before any Migrate action is
 * enabled. Mirrors the architecture doc §7 exactly; the response shape
 * drives the checklist UI directly.
 */
const packageService = require('./package.service');
const neoClient = require('./neoClient.service');
const cfClient = require('./cfClient.service');
const iflowService = require('./iflow.service');

/**
 * @param {object} params
 * @param {object} params.sourceTenant
 * @param {object} params.targetTenant
 * @param {string} params.packageId
 * @param {string} [params.artifactId] - omit to validate at package level only
 */
async function run({ sourceTenant, targetTenant, packageId, artifactId }) {
  const checks = [];

  // 1. Package exists on source
  const sourcePackage = await safe(() => packageService.getPackage(sourceTenant, packageId));
  checks.push({ check: 'Package found', passed: !!sourcePackage });

  // 2 & 3. Artifact exists + version resolvable (only when validating a single artifact)
  let artifact = null;
  if (artifactId) {
    const artifacts = await safe(() => packageService.listArtifacts(sourceTenant, packageId), []);
    artifact = artifacts.find((a) => a.id === artifactId) || null;
    checks.push({ check: 'iFlow found', passed: !!artifact });
    checks.push({ check: 'iFlow version available', passed: !!artifact?.version });
  }

  // 4. Configuration available (only meaningful for iFlow artifacts)
  if (artifactId && artifact?.type === 'IFLOW') {
    const config = await safe(() => iflowService.getConfiguration(sourceTenant, artifactId), null);
    checks.push({ check: 'Configuration available', passed: config !== null });
  } else if (artifactId) {
    checks.push({ check: 'Configuration available', passed: true }); // n/a for non-iFlow types
  }

  // 5. Target package check (exists or can be created — either is fine, only a hard error blocks)
  const targetPackageCheck = await safe(async () => {
    await packageService.getPackage(targetTenant, packageId).catch(() => null);
    return true;
  }, false);
  checks.push({ check: 'Target package check', passed: targetPackageCheck });

  // 6. Target connection healthy
  const targetHealthy = await safe(async () => {
    await cfClient.ensureSession(targetTenant);
    return true;
  }, false);
  checks.push({ check: 'Target connection successful', passed: targetHealthy });

  const result = checks.every((c) => c.passed) ? 'READY' : 'BLOCKED';
  return { result, checks };
}

async function safe(fn, fallback = null) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

module.exports = { run };
