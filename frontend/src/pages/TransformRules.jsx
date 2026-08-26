import React, { useEffect, useState } from 'react';
import AppShell from '../components/layout/AppShell.jsx';
import client from '../services/api/client';

export default function TransformRules() {
  const [rules, setRules] = useState(null);
  const [form, setForm] = useState({ ruleName: '', findValue: '', replaceValue: '', parameterScope: '' });
  const [error, setError] = useState('');

  function load() {
    client.get('/transform-rules').then((r) => setRules(r.data.rules));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await client.post('/transform-rules', form);
      setForm({ ruleName: '', findValue: '', replaceValue: '', parameterScope: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save rule');
    }
  }

  async function handleDelete(id) {
    await client.delete(`/transform-rules/${id}`);
    load();
  }

  return (
    <AppShell>
      <h2 style={{ marginBottom: 4 }}>Config Transform Rules</h2>
      <p>
        Simple find/replace rules applied to configuration values during migration (e.g. source host →
        target host). Matched by substring within each parameter's value.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ maxWidth: 480, marginBottom: 24 }}>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Rule name (optional)</label>
            <input value={form.ruleName} onChange={(e) => setForm({ ...form, ruleName: e.target.value })} />
          </div>
          <div className="field field-mono">
            <label>Find value</label>
            <input
              required
              placeholder="abc-tmn.hci.eu1.hana.ondemand.com"
              value={form.findValue}
              onChange={(e) => setForm({ ...form, findValue: e.target.value })}
            />
          </div>
          <div className="field field-mono">
            <label>Replace value</label>
            <input
              required
              placeholder="xyz-tmn.cfapps.eu10.hana.ondemand.com"
              value={form.replaceValue}
              onChange={(e) => setForm({ ...form, replaceValue: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Restrict to parameter (optional)</label>
            <input
              placeholder="Leave blank to apply to all parameters"
              value={form.parameterScope}
              onChange={(e) => setForm({ ...form, parameterScope: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Add rule
          </button>
        </form>
      </div>

      {rules?.length === 0 && <div className="empty-state">No transform rules yet.</div>}

      {rules?.map((r) => (
        <div
          key={r.ID}
          className="card"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}
        >
          <div className="mono" style={{ fontSize: 13 }}>
            {r.FINDVALUE} → {r.REPLACEVALUE}
            {r.PARAMETERSCOPE && <span className="helper-text"> (only {r.PARAMETERSCOPE})</span>}
          </div>
          <button className="btn btn-secondary" onClick={() => handleDelete(r.ID)}>
            Remove
          </button>
        </div>
      ))}
    </AppShell>
  );
}
