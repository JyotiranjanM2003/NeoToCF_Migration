import React from 'react';

const LABELS = {
  IFLOW: 'iFlow',
  VALUE_MAPPING: 'Value Mapping',
  SCRIPT_COLLECTION: 'Script Collection',
  MESSAGE_MAPPING: 'Message Mapping',
};

export default function ArtifactTypeBadge({ type }) {
  return <span className="badge badge-disconnected">{LABELS[type] || type}</span>;
}
