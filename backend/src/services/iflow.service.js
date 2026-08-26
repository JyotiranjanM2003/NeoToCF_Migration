/**
 * Reads a single artifact's detail + configuration from the source (Neo)
 * tenant. Mirrors MIG100/MIG110 GetArtifacts + DownloadConfiguration, plus
 * the standard CPI OData $value pattern for a single artifact's zip.
 */
const neoClient = require('./neoClient.service');
const packageService = require('./package.service');

/**
 * Fetches Name/Version/Status/Package for one artifact by finding it inside
 * its package's artifact list (the CPI API doesn't expose "get one designtime
 * artifact regardless of package" directly).
 */
async function getArtifactDetail(sourceTenant, packageId, artifactId) {
  const artifacts = await packageService.listArtifacts(sourceTenant, packageId);
  const artifact = artifacts.find((a) => a.id === artifactId);
  if (!artifact) return null;

  const pkg = await packageService.getPackage(sourceTenant, packageId);

  return {
    ...artifact,
    package: pkg?.Name || packageId,
  };
}

/**
 * GET /IntegrationDesigntimeArtifacts(Id='{id}',Version='active')/Configurations
 * Returns the flat parameter/value list shown on the iFlow detail page.
 */
async function getConfiguration(sourceTenant, artifactId) {
  const data = await neoClient.get(
    sourceTenant,
    `/IntegrationDesigntimeArtifacts(Id='${artifactId}',Version='active')/Configurations`
  );
  const rows = data.d?.results || [];
  return rows.map((r) => ({
    parameter: r.ParameterKey,
    value: r.ParameterValue,
    dataType: r.DataType || 'string',
  }));
}

/**
 * GET /IntegrationDesigntimeArtifacts(Id='{id}',Version='active')/$value
 * Single-artifact zip download, used by the per-iFlow Download button.
 */
async function downloadArtifactZip(sourceTenant, artifactId) {
  return neoClient.getBinary(sourceTenant, `/IntegrationDesigntimeArtifacts(Id='${artifactId}',Version='active')/$value`);
}

module.exports = { getArtifactDetail, getConfiguration, downloadArtifactZip };
