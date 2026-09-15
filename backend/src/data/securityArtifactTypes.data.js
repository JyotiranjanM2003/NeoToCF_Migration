/**
 * Catalog for the "Manage Security" screen — mirrors the tile layout of
 * SAP CPI's own Security Material UI and the "CPI MIG090 Security
 * Artifacts" Postman collection.
 *
 * `transportType` is the exact `Type` value(s) MIG090 posts to
 * POST /api/v1/SecurityContentTransports on the SOURCE tenant. Where a
 * category legitimately bundles several sub-types (Security Material),
 * transportType is the full default comma-list; a custom selection sends
 * a narrower comma-list built from `listSources[].subTypeKey` instead.
 *
 * `listSources` are the OData entity sets read from the SOURCE tenant to
 * populate the review table for that tile. These are for LISTING/REVIEW
 * only — MIG090 has no per-entry migration; it always transports every
 * entry of the Type(s) requested as one encrypted package.
 *
 * CONFIRMED listable via /api/v1 OData:
 *   UserCredentials, SecureParameters, OAuth2ClientCredentials, KeystoreEntries
 *
 * NOT exposed via /api/v1 OData (SAP does not list them via API):
 *   OAuth2SAMLBearerAssertion, OAuth2AuthorizationCode, KnownHosts,
 *   PGPKeys, JDBCDataSources
 *   → These are transport-only: SecurityContentTransports still migrates them.
 *   → Entries for OAuth2SAML / KnownHosts appear in UserCredentials listing.
 */

const SECURITY_CATEGORIES = [
  {
    key: 'securityMaterial',
    label: 'Security Material',
    countLabel: 'Artifacts',
    supported: true,
    transportType:
      'userCredentials,secureParameter,oAuth2ClientCredentials,oAuth2SAMLBearerAssertion,oAuth2AuthorizationCode,knownHosts',
    // Only include entity sets confirmed to exist in the Neo /api/v1 OData API.
    // OAuth2SAMLBearerAssertion, OAuth2AuthorizationCode and KnownHosts all return 404;
    // their entries appear in UserCredentials from the Neo API side.
    listSources: [
      { entity: 'UserCredentials', subTypeKey: 'userCredentials', subTypeLabel: 'User Credential' },
      { entity: 'SecureParameters', subTypeKey: 'secureParameter', subTypeLabel: 'Secure Parameter' },
      { entity: 'OAuth2ClientCredentials', subTypeKey: 'oAuth2ClientCredentials', subTypeLabel: 'OAuth2 Client Credentials' },
    ],
  },
  {
    key: 'keystore',
    label: 'Keystore',
    countLabel: 'Entries',
    supported: true,
    transportType: 'keystore',
    listSources: [{ entity: 'KeystoreEntries', subTypeKey: 'keystore', subTypeLabel: 'Keystore Entry' }],
  },
  {
    key: 'pgpKeys',
    label: 'PGP Keys',
    countLabel: 'PGP Keys',
    supported: true,
    noListing: true, // SAP CPI exposes no OData entity for PGP Keys; migration via SecurityContentTransports still works
    transportType: 'pgpKeys',
    listSources: [],
  },
  {
    key: 'certificateUserMappings',
    label: 'Certificate-to-User Mappings',
    countLabel: 'Artifacts',
    supported: false, // no Type value in MIG090 / SecurityContentTransports
    listSources: [],
  },
  {
    key: 'accessPolicies',
    label: 'Access Policies',
    countLabel: 'Artifacts',
    supported: false, // covered by "CPI MIG080 Access Policies", not MIG090
    listSources: [],
  },
  {
    key: 'jdbcMaterial',
    label: 'JDBC Material',
    countLabel: 'Artifacts',
    supported: true,
    noListing: true, // SAP CPI exposes no OData entity for JDBC items; migration via SecurityContentTransports still works
    transportType: 'jdbcDatasource',
    listSources: [],
  },
  {
    key: 'connectivityTests',
    label: 'Connectivity Tests',
    countLabel: null,
    supported: false, // nothing to transport — not an artifact type
    listSources: [],
  },
];

module.exports = { SECURITY_CATEGORIES };