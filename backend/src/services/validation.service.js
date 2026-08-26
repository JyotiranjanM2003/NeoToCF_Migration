/**
 * Validation Engine — read-only checks run before any Migrate action is
 * enabled. Mirrors the architecture doc §7; the response shape drives the
 * checklist UI directly. Each check now also carries a `detail` message
 * when it fails, so a failure doesn't disappear into a bare X — the actual
 * upstream error is visible in the UI instead of being discarded.
 */
const packageService = require('./package.service');
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
  const sourcePackageAttempt = await attempt(() => packageService.getPackage(sourceTenant, packageId));
  checks.push({
    check: 'Package found',
    passed: sourcePackageAttempt.ok && !!sourcePackageAttempt.value,
    detail: !sourcePackageAttempt.ok
      ? sourcePackageAttempt.detail
      : !sourcePackageAttempt.value
      ? 'Package not found on source'
      : undefined,
  });

  // 2 & 3. Artifact exists + version resolvable (only when validating a single artifact)
  let artifact = null;
  if (artifactId) {
    const artifactsAttempt = await attempt(() => packageService.listArtifacts(sourceTenant, packageId));
    const artifacts = artifactsAttempt.ok ? artifactsAttempt.value : [];
    artifact = artifacts.find((a) => a.id === artifactId) || null;

    checks.push({
      check: 'iFlow found',
      passed: !!artifact,
      detail: !artifactsAttempt.ok
        ? artifactsAttempt.detail
        : !artifact
        ? 'Artifact not found in this package'
        : undefined,
    });
    checks.push({ check: 'iFlow version available', passed: !!artifact?.version });
  }

  // 4. Configuration available (only meaningful for iFlow artifacts)
  if (artifactId && artifact?.type === 'IFLOW') {
    const configAttempt = await attempt(() => iflowService.getConfiguration(sourceTenant, artifactId));
    checks.push({
      check: 'Configuration available',
      passed: configAttempt.ok,
      detail: !configAttempt.ok ? configAttempt.detail : undefined,
    });
  } else if (artifactId) {
    checks.push({ check: 'Configuration available', passed: true }); // n/a for non-iFlow types
  }

  // 5. Target package check — missing is fine (the migration pipeline
  // creates it automatically); only a genuine connectivity/auth failure
  // should block here.
  const targetPackageAttempt = await attempt(() => packageService.getPackage(targetTenant, packageId, cfClient));
  checks.push({
    check: 'Target package check',
    passed: targetPackageAttempt.ok,
    detail: !targetPackageAttempt.ok ? targetPackageAttempt.detail : undefined,
  });

  // 6. Target connection healthy
  const targetHealthyAttempt = await attempt(() => cfClient.ensureSession(targetTenant));
  checks.push({
    check: 'Target connection successful',
    passed: targetHealthyAttempt.ok,
    detail: !targetHealthyAttempt.ok ? targetHealthyAttempt.detail : undefined,
  });

  const result = checks.every((c) => c.passed) ? 'READY' : 'BLOCKED';
  return { result, checks };
}

/** Runs fn and captures either its resolved value or a readable error detail. */
async function attempt(fn) {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err) {
    return { ok: false, detail: describeError(err) };
  }
}

/**
 * Turns an axios error into a readable string that includes the upstream
 * tenant's actual response body when there is one — SAP OData errors are
 * usually { error: { message: { value: '...' } } }.
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

module.exports = { run };