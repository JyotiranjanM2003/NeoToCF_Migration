/**
 * Reads packages and their artifacts live from the source (Neo) tenant.
 * Nothing here is cached in the DB — every call hits the tenant directly,
 * per the "make everything dynamic" requirement.
 */
const neoClient = require('./neoClient.service');
const cfClient = require('./cfClient.service');

/**
 * Each artifact type lives under its own CPI OData entity set. Used for
 * listing (already proven working) and now also for per-artifact
 * download/upload, mirroring the pattern already proven for iFlows.
 */
const ARTIFACT_ENTITY_SET = {
  IFLOW: 'IntegrationDesigntimeArtifacts',
  VALUE_MAPPING: 'ValueMappingDesigntimeArtifacts',
  MESSAGE_MAPPING: 'MessageMappingDesigntimeArtifacts',
  SCRIPT_COLLECTION: 'ScriptCollectionDesigntimeArtifacts',
};

/** GET /IntegrationPackages — works for both SAP content and custom packages. */
async function listPackages(sourceTenant) {
  const data = await neoClient.get(sourceTenant, '/IntegrationPackages');
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
 * can show "IFLOW", "VALUE_MAPPING", "MESSAGE_MAPPING", "SCRIPT_COLLECTION"
 * next to each row.
 */
async function listArtifacts(sourceTenant, packageId) {
  const [iflowsRes, valueMappingsRes, messageMappingsRes, scriptCollectionsRes] = await Promise.allSettled([
    neoClient.get(sourceTenant, `/IntegrationPackages('${packageId}')/IntegrationDesigntimeArtifacts`),
    neoClient.get(sourceTenant, `/IntegrationPackages('${packageId}')/ValueMappingDesigntimeArtifacts`),
    neoClient.get(sourceTenant, `/IntegrationPackages('${packageId}')/MessageMappingDesigntimeArtifacts`),
    neoClient.get(sourceTenant, `/IntegrationPackages('${packageId}')/ScriptCollectionDesigntimeArtifacts`),
  ]);

  const artifacts = [];

  if (iflowsRes.status === 'fulfilled') {
    for (const a of iflowsRes.value.d?.results || []) {
      artifacts.push({ id: a.Id, name: a.Name, type: 'IFLOW', version: a.Version, status: mapArtifactStatus(a), packageId });
    }
  }

  if (valueMappingsRes.status === 'fulfilled') {
    for (const a of valueMappingsRes.value.d?.results || []) {
      artifacts.push({ id: a.Id, name: a.Name, type: 'VALUE_MAPPING', version: a.Version, status: mapArtifactStatus(a), packageId });
    }
  }

  if (messageMappingsRes.status === 'fulfilled') {
    for (const a of messageMappingsRes.value.d?.results || []) {
      artifacts.push({ id: a.Id, name: a.Name, type: 'MESSAGE_MAPPING', version: a.Version, status: mapArtifactStatus(a), packageId });
    }
  }

  if (scriptCollectionsRes.status === 'fulfilled') {
    for (const a of scriptCollectionsRes.value.d?.results || []) {
      artifacts.push({ id: a.Id, name: a.Name, type: 'SCRIPT_COLLECTION', version: a.Version, status: mapArtifactStatus(a), packageId });
    }
  }

  return artifacts;
}

function mapArtifactStatus(artifact) {
  // CPI doesn't return a single "Status" field on the designtime list call.
  // The catch: for an artifact that's never been saved as a real version,
  // CPI returns the literal STRING "Draft" in the Version field — which is
  // truthy, so a plain existence check wrongly reports it as Active. Only
  // count it Active if Version holds a real version string, not "Draft".
  return artifact.Version && artifact.Version !== 'Draft' ? 'Active' : 'Draft';
}

/** GET /IntegrationPackages('{id}')/$value — whole-package zip download (still used for GET_PACKAGE checks/creation, not per-artifact migration anymore). */
async function downloadPackageZip(sourceTenant, packageId) {
  return neoClient.getBinary(sourceTenant, `/IntegrationPackages('${packageId}')/$value`);
}

/**
 * Downloads ONE artifact's content, regardless of type — picks the right
 * OData entity set for the artifact's type and hits its $value endpoint,
 * the same pattern already proven working for iFlows.
 */
async function downloadArtifactContent(tenant, artifact, client = neoClient) {
  const entitySet = ARTIFACT_ENTITY_SET[artifact.type] || ARTIFACT_ENTITY_SET.IFLOW;
  return client.getBinary(tenant, `/${entitySet}(Id='${artifact.id}',Version='active')/$value`);
}

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

module.exports = {
  listPackages,
  listArtifacts,
  downloadPackageZip,
  downloadArtifactContent,
  getPackage,
  createPackage,
  mapArtifactStatus,
  ARTIFACT_ENTITY_SET,
};