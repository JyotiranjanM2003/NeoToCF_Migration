/**
 * Reads packages and their artifacts live from the source (Neo) tenant.
 * Nothing here is cached in the DB — every call hits the tenant directly,
 * per the "make everything dynamic" requirement.
 *
 * Mirrors:
 *  - MIG020 Readiness Checks -> Check Pre-Package Content / Load List of Custom Packages
 *  - MIG100 Pre-Packaged Content -> GetSAPContentPackages, GetArtifacts, DownloadConfiguration
 *  - MIG110 Custom Content -> GetCustomPackages, DownloadPackage, GetArtifacts
 */
const neoClient = require('./neoClient.service');
const cfClient = require('./cfClient.service');

/** GET /IntegrationPackages — works for both SAP content and custom packages. */
async function listPackages(sourceTenant) {
  const data = await neoClient.get(sourceTenant, "/IntegrationPackages");
  const packages = data.d?.results || [];
  return packages.map((p) => ({
    id: p.Id,
    name: p.Name,
    version: p.Version,
    mode: p.Mode, // e.g. 'EDIT_ALLOWED', 'READ_ONLY' — hints SAP-delivered vs custom
    description: p.ShortText || p.Description || '',
  }));
}

/**
 * Lists every artifact inside a package, tagged by type, so the frontend
 * can show "IFLOW", "VALUE_MAPPING", etc. next to each row.
 */
async function listArtifacts(sourceTenant, packageId) {
  const [iflowsRes, valueMappingsRes] = await Promise.allSettled([
    neoClient.get(sourceTenant, `/IntegrationPackages('${packageId}')/IntegrationDesigntimeArtifacts`),
    neoClient.get(sourceTenant, `/IntegrationPackages('${packageId}')/ValueMappingDesigntimeArtifacts`),
  ]);

  const artifacts = [];

  if (iflowsRes.status === 'fulfilled') {
    for (const a of iflowsRes.value.d?.results || []) {
      artifacts.push({
        id: a.Id,
        name: a.Name,
        type: 'IFLOW',
        version: a.Version,
        status: mapArtifactStatus(a),
        packageId,
      });
    }
  }

  if (valueMappingsRes.status === 'fulfilled') {
    for (const a of valueMappingsRes.value.d?.results || []) {
      artifacts.push({
        id: a.Id,
        name: a.Name,
        type: 'VALUE_MAPPING',
        version: a.Version,
        status: 'Active',
        packageId,
      });
    }
  }

  return artifacts;
}

function mapArtifactStatus(artifact) {
  // CPI doesn't return a single "Status" field on the designtime list call;
  // treat presence of an active Version as Active, otherwise Draft.
  return artifact.Version ? 'Active' : 'Draft';
}

/** GET /IntegrationPackages('{id}')/$value — whole-package zip download. */
async function downloadPackageZip(sourceTenant, packageId) {
  return neoClient.getBinary(sourceTenant, `/IntegrationPackages('${packageId}')/$value`);
}

/** Existence + basic metadata check, used heavily by the validation engine. */
/**
 * Existence + basic metadata check, used by the validation engine and the
 * migration pipeline. Pass `cfClient` when checking the target (CF) tenant —
 * it uses a different OAuth token endpoint than Neo, so the wrong client
 * here silently fails auth rather than giving a real 404.
 */
async function getPackage(tenant, packageId, client = neoClient) {
  try {
    const data = await client.get(tenant, `/IntegrationPackages('${packageId}')`);
    return data.d || null;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Creates a package on the target tenant. The migration pipeline calls this
 * when the source package doesn't exist yet on the target — CPI rejects an
 * artifact upload into a package that isn't there.
 */
async function createPackage(tenant, { id, name, shortText, version }, client = cfClient) {
  const payload = {
    Id: id,
    Name: name || id,
    ShortText: shortText || '',
    Version: version || '1.0.0',
  };
  await client.write(tenant, 'post', '/IntegrationPackages', {
    data: payload,
    headers: { 'Content-Type': 'application/json' },
  });
}

module.exports = { listPackages, listArtifacts, downloadPackageZip, getPackage, createPackage, mapArtifactStatus };