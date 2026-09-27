/**
 * Builds a unified, cross-scope migration report from MIGRATION +
 * MIGRATION_ARTIFACT — no new tables. Scoped to a source/target HOST pair
 * (real tenant hostnames, not per-user UUIDs) so it shows what's been
 * migrated by ANYONE to this real tenant pair — tenant-scoped, not
 * user-scoped.
 *
 * sourceTenant is the full tenant object (with credentials) passed in from
 * the controller so we can fetch live artifact counts per package and
 * correctly determine MIGRATED vs PARTIAL for artifact-by-artifact runs.
 */
const MigrationReportModel = require('../models/MigrationReport.model');
const packageService = require('./package.service');

// Whole-package runs emit their own Package-category row directly from the
// MIGRATION table. SINGLE_ARTIFACT runs are represented by their
// MIGRATION_ARTIFACT rows; a synthesized Package summary row is added below
// for packages where no whole-package run exists.
const PACKAGE_RUN_SCOPES = new Set(['PACKAGE']);

const ARTIFACT_CATEGORY_LABELS = {
  PACKAGE: 'Package Artifact',
  SINGLE_ARTIFACT: 'Package Artifact',
  VARIABLE: 'Variable',
  DATASTORE: 'Data Store',
  NUMBER_RANGE: 'Number Range',
  SECURITY: 'Security Material',
};

async function buildReport(sourceHost, targetHost, sourceTenant = null) {
  const [migrations, artifacts] = await Promise.all([
    MigrationReportModel.listMigrationsForTenantPair(sourceHost, targetHost),
    MigrationReportModel.listArtifactsForTenantPair(sourceHost, targetHost),
  ]);

  // MIGRATION.PACKAGENAME remains the technical package ID because it is
  // used by migration/status queries. Resolve a separate display name for
  // package rows in the user-facing report.
  const packageDisplayNames = await getPackageDisplayNames(sourceTenant);

  const rows = [];

  // Track which packages already have a whole-package run row so we don't
  // double-emit a Package row for them in the synthesis step below.
  const packagesWithFullRun = new Set();

  for (const m of migrations) {
    if (!PACKAGE_RUN_SCOPES.has(m.SCOPETYPE)) continue;
    packagesWithFullRun.add(m.PACKAGENAME);
    rows.push({
      migrationId: m.MIGRATIONID,
      category: 'Package',
      name: packageDisplayNames.get(m.PACKAGENAME) || m.PACKAGENAME,
      type: 'Package',
      status: normalizeStatus(m.STATUS),
      startedAt: m.STARTEDAT,
      completedAt: m.COMPLETEDAT,
      errorMessage: null,
    });
  }

  // Emit individual artifact rows and simultaneously accumulate per-package
  // stats for SINGLE_ARTIFACT runs so we can synthesize a Package summary row.
  //
  // packageArtifactStats: packageName -> Map<artifactId, latestArtifactRow>
  // We keep only the most recent run per artifactId (artifacts list is already
  // ordered StartedAt DESC from the query) so retries are counted correctly.
  const packageArtifactStats = new Map();

  for (const a of artifacts) {
    rows.push({
      migrationId: a.MIGRATIONID,
      category: ARTIFACT_CATEGORY_LABELS[a.SCOPETYPE] || a.SCOPETYPE,
      name: a.ARTIFACTNAME,
      type: a.ARTIFACTTYPE,
      status: normalizeStatus(a.STATUS),
      startedAt: a.STARTEDAT,
      completedAt: a.COMPLETEDAT,
      errorMessage: a.ERRORMESSAGE || null,
    });

    // Only accumulate for SINGLE_ARTIFACT runs on packages with no full run.
    if (a.SCOPETYPE !== 'SINGLE_ARTIFACT' || packagesWithFullRun.has(a.PACKAGENAME)) continue;

    if (!packageArtifactStats.has(a.PACKAGENAME)) {
      packageArtifactStats.set(a.PACKAGENAME, new Map());
    }
    const byArtifact = packageArtifactStats.get(a.PACKAGENAME);

    // Keep only the most-recent attempt per artifactId (list is already DESC).
    if (!byArtifact.has(a.ARTIFACTID)) {
      byArtifact.set(a.ARTIFACTID, a);
    }
  }

  // Fetch live artifact counts for every package that has SINGLE_ARTIFACT
  // migrations so we can compare migrated count against the real package total.
  // Without this, "1 migrated out of 1 attempted" looks like full success even
  // when the package actually has more artifacts that were never touched.
  // Failures are non-fatal — fall back to attempted count only.
  const liveTotalMap = new Map(); // packageName -> total artifact count
  if (sourceTenant && packageArtifactStats.size > 0) {
    await Promise.allSettled(
      Array.from(packageArtifactStats.keys()).map(async (packageName) => {
        try {
          const arts = await packageService.listArtifacts(sourceTenant, packageName);
          liveTotalMap.set(packageName, arts.length);
        } catch {
          // leave missing — falls back to attempted count below
        }
      })
    );
  }

  // Synthesize one Package summary row per package migrated artifact-by-artifact.
  for (const [packageName, byArtifact] of packageArtifactStats) {
    const artifactRows  = Array.from(byArtifact.values());
    const migratedCount = artifactRows.filter((a) => a.STATUS === 'MIGRATED').length;
    const failedCount   = artifactRows.filter((a) => a.STATUS === 'FAILED').length;
    const attempted     = artifactRows.length;

    // Use the live total if available; if total > attempted, some artifacts
    // were never touched at all — package is at best PARTIAL.
    const totalInPackage = liveTotalMap.has(packageName)
      ? liveTotalMap.get(packageName)
      : attempted;

    let status;
    if (migratedCount === totalInPackage && totalInPackage > 0) {
      status = 'MIGRATED';
    } else if (migratedCount > 0) {
      status = 'PARTIAL';
    } else if (failedCount === attempted && attempted > 0) {
      status = 'FAILED';
    } else {
      status = 'PENDING';
    }

    // Use the timestamp of the most-recent artifact run for this package.
    const latestArtifact = artifactRows.reduce((latest, a) =>
      new Date(a.STARTEDAT || 0) > new Date(latest.STARTEDAT || 0) ? a : latest
    );

    rows.push({
      migrationId: latestArtifact.MIGRATIONID,
      category: 'Package',
      name: packageDisplayNames.get(packageName) || packageName,
      type: 'Artifact-by-Artifact',
      status,
      startedAt: latestArtifact.STARTEDAT,
      completedAt: latestArtifact.COMPLETEDAT,
      errorMessage: null,
    });
  }

  rows.sort((x, y) => new Date(y.startedAt || 0) - new Date(x.startedAt || 0));

  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    { total: 0, MIGRATED: 0, FAILED: 0, PARTIAL: 0, RUNNING: 0, PENDING: 0 }
  );

  return { rows, summary };
}

async function getPackageDisplayNames(sourceTenant) {
  if (!sourceTenant) return new Map();

  try {
    const packages = await packageService.listPackages(sourceTenant);
    return new Map(packages.map((pkg) => [pkg.id, pkg.name]));
  } catch {
    // Keep the report available if the source tenant is temporarily
    // unavailable; the technical ID is a safe fallback.
    return new Map();
  }
}

/**
 * Collapses the different raw status vocabularies (MIGRATION uses SUCCESS,
 * MIGRATION_ARTIFACT uses MIGRATED) into one consistent set for the report.
 */
function normalizeStatus(rawStatus) {
  switch (rawStatus) {
    case 'SUCCESS':
    case 'MIGRATED':
      return 'MIGRATED';
    case 'FAILED':
    case 'BLOCKED':
      return 'FAILED';
    case 'PARTIAL':
      return 'PARTIAL';
    case 'RUNNING':
      return 'RUNNING';
    default:
      return 'PENDING';
  }
}

module.exports = { buildReport };
