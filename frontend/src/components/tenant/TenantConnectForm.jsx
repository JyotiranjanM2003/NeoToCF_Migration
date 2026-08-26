import React, { useState } from 'react';

/**
 * Generic tenant credentials form.
 * `fields` describes which inputs to render, in order, so the same
 * component serves both the Neo and CF forms without branching logic.
 */
export default function TenantConnectForm({ fields, initialValues = {}, onSubmit, submitting }) {
  const [values, setValues] = useState(initialValues);

  function handleChange(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit}>
      {fields.map((f) => (
        <div className={`field${f.mono ? ' field-mono' : ''}`} key={f.name}>
          <label htmlFor={f.name}>{f.label}</label>
          <input
            id={f.name}
            type={f.secret ? 'password' : 'text'}
            required={f.required !== false}
            placeholder={f.placeholder}
            value={values[f.name] || ''}
            onChange={(e) => handleChange(f.name, e.target.value)}
          />
          {f.helper && <div className="helper-text">{f.helper}</div>}
        </div>
      ))}
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Connecting…' : 'Save & test connection'}
      </button>
    </form>
  );
}
