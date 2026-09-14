import {
  ShieldCheck,
  KeyRound,
  Lock,
  UserCheck,
  ShieldAlert,
  Database,
  Plug,
  User,
  FileSignature,
  Ticket,
  Server,
  HelpCircle,
} from 'lucide-react';

/**
 * Icon for each top-level Security Artifact category tile
 * (Manage Security landing page). Keys match SECURITY_CATEGORIES[].key
 * in securityArtifactTypes.data.js.
 */
export const CATEGORY_ICONS = {
  securityMaterial: ShieldCheck,
  keystore: KeyRound,
  pgpKeys: Lock,
  certificateUserMappings: UserCheck,
  accessPolicies: ShieldAlert,
  jdbcMaterial: Database,
  connectivityTests: Plug,
};

/**
 * Icon for each sub-type / entry type shown in the Type column inside a
 * category (e.g. inside Security Material: User Credential, Secure
 * Parameter, ...). Keys match listSources[].subTypeKey in
 * securityArtifactTypes.data.js.
 */
export const SUBTYPE_ICONS = {
  userCredentials: User,
  secureParameter: Lock,
  oAuth2ClientCredentials: KeyRound,
  oAuth2SAMLBearerAssertion: FileSignature,
  oAuth2AuthorizationCode: Ticket,
  knownHosts: Server,
  keystore: KeyRound,
  pgpKeys: Lock,
  jdbcDatasource: Database,
};

export function CategoryIcon({ categoryKey, size = 20, ...rest }) {
  const Icon = CATEGORY_ICONS[categoryKey] || HelpCircle;
  return <Icon size={size} {...rest} />;
}

export function SubTypeIcon({ subTypeKey, size = 16, ...rest }) {
  const Icon = SUBTYPE_ICONS[subTypeKey] || HelpCircle;
  return <Icon size={size} {...rest} />;
}