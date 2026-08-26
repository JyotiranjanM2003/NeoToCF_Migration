import React from 'react';

export default function ValidationChecklist({ validation }) {
  if (!validation) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 12 }}>Migration Validation</h3>
      {validation.checks.map((c) => (
        <div key={c.check} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: c.passed ? 'var(--accent)' : 'var(--danger)', fontWeight: 700 }}>
            {c.passed ? '✓' : '✗'}
          </span>
          {c.check}
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
