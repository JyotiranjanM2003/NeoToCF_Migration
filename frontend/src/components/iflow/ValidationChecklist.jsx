import React from 'react';

export default function ValidationChecklist({ validation }) {
  if (!validation) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 12 }}>Migration Validation</h3>
      {validation.checks.map((c) => (
  <div key={c.check} style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: c.passed ? 'var(--accent)' : 'var(--danger)', fontWeight: 700 }}>
        {c.passed ? '✓' : '✗'}
      </span>
      {c.check}
    </div>
    {!c.passed && c.detail && (
      <div className="mono" style={{ marginLeft: 24, marginTop: 2, color: 'var(--danger)', fontSize: 12 }}>
        {c.detail}
      </div>
    )}
  </div>
))}
      <div
        style={{
          marginTop: 12,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: validation.result === 'READY' ? 'var(--accent)' : 'var(--danger)',
        }}
      >
        Result: {validation.result === 'READY' ? 'READY FOR MIGRATION' : 'MIGRATION BLOCKED'}
      </div>
    </div>
  );
}
