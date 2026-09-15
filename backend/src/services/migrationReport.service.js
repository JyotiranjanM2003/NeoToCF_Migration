/**
 * Builds a unified, cross-scope migration report from MIGRATION +
 * MIGRATION_ARTIFACT — no new tables. Scoped to a source/target Host pair
 * (not UserId), so it shows what's been migrated by ANYONE to this real
 * tenant pair, consistent with the rest of the app.
 */
const MigrationReportModel = require('../models/MigrationReport.model');

// The overall migration run itself is only meaningful as its own report
// row for scopes that represent "a package" — everything else is fully
// represented by its MIGRATION_ARTIFACT rows.
const PACKAGE_RUN_SCOPES = new Set(['PACKAGE', 'SINGLE_ARTIFACT']);

const ARTIFACT_CATEGORY_LABELS = {
  PACKAGE: 'Package Artifact',
  SINGLE_ARTIFACT: 'Package Artifact',
  VARIABLE: 'Variable',
  DATASTORE: 'Data Store',
  NUMBER_RANGE: 'Number Range',
  SECURITY: 'Security Material',
};

async function buildReport(sourceHost, targetHost) {
  const [migrations, artifacts] = await Promise.all([
    MigrationReportModel.listMigrationsForTenantPair(sourceHost, targetHost),
    MigrationReportModel.listArtifactsForTenantPair(sourceHost, targetHost),
  ]);

  const rows = [];

  for (const m of migrations) {
    if (!PACKAGE_RUN_SCOPES.has(m.SCOPETYPE)) continue;
    rows.push({
      migrationId: m.MIGRATIONID,
      category: 'Package',
      name: m.PACKAGENAME,
      type: m.SCOPETYPE === 'SINGLE_ARTIFACT' ? 'Single Artifact Run' : 'Package',
      status: normalizeStatus(m.STATUS),
      startedAt: m.STARTEDAT,
      completedAt: m.COMPLETEDAT,
      errorMessage: null,
    });
  }

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

/** Collapses the different raw status vocabularies (MIGRATION uses SUCCESS,
 * MIGRATION_ARTIFACT uses MIGRATED) into one consistent set for the report. */
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