import React from 'react';

/**
 * Small square icon badge used in front of a package or artifact name,
 * matching the icon-in-a-rounded-square look of SAP CPI's own package and
 * artifact lists. Uses the app's existing accent color rather than SAP's
 * blue, to stay consistent with the rest of the console's palette.
 *
 * `type` accepts the same artifact-type strings used elsewhere in the app
 * (IFLOW, VALUE_MAPPING, MESSAGE_MAPPING, SCRIPT_COLLECTION, API), plus
 * 'package' for the Packages table. Anything unrecognized falls back to
 * the package/box icon.
 */
const ICONS = {
  PACKAGE: (
    // "box" — reads as a package.
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </>
  ),
  IFLOW: (
    // "share-2" — three connected nodes, reads as a flow/integration.
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </>
  ),
  VALUE_MAPPING: (
    // "shuffle" — crossing arrows, reads as mapping/exchanging values.
    <>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </>
  ),
  MESSAGE_MAPPING: (
    // "mail" — reads as a message.
    <>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22 6 12 13 2 6" />
    </>
  ),
  SCRIPT_COLLECTION: (
    // "code" — angle brackets, reads as scripts.
    <>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </>
  ),
  API: (
    // "globe" — reads as an exposed/network-facing API.
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
};

export default function EntityIcon({ type = 'package', size = 32 }) {
  const key = String(type).toUpperCase();
  const icon = ICONS[key] || ICONS.PACKAGE;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: 'var(--accent-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon}
      </svg>
    </div>
  );
}