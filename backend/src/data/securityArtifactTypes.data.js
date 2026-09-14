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
 * NOTE: `PGPKeys` and `JDBCDataSources` entity-set names are best-effort
 * (not independently confirmed against SAP's Security Content OData
 * metadata). If your tenant exposes them under a different name, update
 * the `entity` value here — listing degrades gracefully (shows '—') if
 * the name is wrong, it won't break the page. `UserCredentials`,
 * `SecureParameters`, `OAuth2ClientCredentials` and `KeystoreEntries`
 * are confirmed.
 */

const SECURITY_CATEGORIES = [
  {
    key: 'securityMaterial',
    label: 'Security Material',
    countLabel: 'Artifacts',
    supported: true,
    transportType:
      'userCredentials,secureParameter,oAuth2ClientCredentials,oAuth2SAMLBearerAssertion,oAuth2AuthorizationCode,knownHosts',
    listSources: [
      { entity: 'UserCredentials', subTypeKey: 'userCredentials', subTypeLabel: 'User Credential' },
      { entity: 'SecureParameters', subTypeKey: 'secureParameter', subTypeLabel: 'Secure Parameter' },
      { entity: 'OAuth2ClientCredentials', subTypeKey: 'oAuth2ClientCredentials', subTypeLabel: 'OAuth2 Client Credentials' },
      { entity: 'OAuth2SAMLBearerAssertion', subTypeKey: 'oAuth2SAMLBearerAssertion', subTypeLabel: 'OAuth2 SAML Bearer Assertion' },
      { entity: 'OAuth2AuthorizationCode', subTypeKey: 'oAuth2AuthorizationCode', subTypeLabel: 'OAuth2 Authorization Code' },
      { entity: 'KnownHosts', subTypeKey: 'knownHosts', subTypeLabel: 'Known Host' },
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
    transportType: 'pgpKeys',
    listSources: [{ entity: 'PGPKeys', subTypeKey: 'pgpKeys', subTypeLabel: 'PGP Key' }],
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
    transportType: 'jdbcDatasource',
    listSources: [{ entity: 'JDBCDataSources', subTypeKey: 'jdbcDatasource', subTypeLabel: 'JDBC Data Source' }],
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